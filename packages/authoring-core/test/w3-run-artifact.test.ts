import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { masteryDisqualifying, type MasteryHintFacts } from '@profesor-ia/domain-engine';
import { AUTHORIZED_CALCULUS_VERSION, parse, verify } from '@profesor-ia/logic-core';
import { describe, expect, it } from 'vitest';

import {
  KC_CATALOG,
  W3_REJECTION_CODES,
  type KcId,
  type PrivateSolution,
  type W3ItemRecord,
} from '../src/index.js';

/**
 * Guarda de los artefactos de la corrida W3 (T-H5-05), materializados el
 * 2026-08-22 con `scripts/content/w3-generate-run.mjs`.
 *
 * Comprueba las dos cosas que el diseño de W3 separa físicamente y que un
 * volcado descuidado volvería a juntar:
 *
 * 1. **Ningún registro público lleva solución.** `W3ItemRecord` no tiene campo
 *    para el certificado; si alguien serializara el registro entero de otra
 *    forma, aquí se ve.
 * 2. **Todo certificado privado re-verifica con `logic-core`.** Un certificado
 *    guardado que no verifica no es «una prueba vieja»: es una inconsistencia
 *    entre buscador y verificador (P-I §13.1, nivel 3).
 *
 * Y que los rechazos usan **solo** códigos de la lista cerrada: un código libre
 * sería un canal por el que colar indicaciones sobre la solución al regenerar.
 */
const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);

function leerJsonConCabecera<T>(ruta: string): T {
  return JSON.parse(readFileSync(join(CONTENIDO, ruta), 'utf8').replace(/^(#[^\n]*\n)+/, '')) as T;
}

interface CorridaW3 {
  readonly frozenOrder: { readonly variantId: string; readonly measuredOn: string };
  readonly candidates: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly rejectionsByCode: Readonly<Record<string, readonly string[]>>;
  readonly criticIndependence: { readonly independent: boolean };
  readonly coverageGaps: readonly { readonly kcId: string; readonly parameterId: string }[];
  readonly items: readonly W3ItemRecord[];
}

const corrida = leerJsonConCabecera<CorridaW3>('audits/w3-run.yaml');
const soluciones = leerJsonConCabecera<{ privateSolutions: readonly PrivateSolution[] }>(
  'solutions-private/w3-solutions.yaml',
);

/** Claves con las que una solución podría haberse colado al registro público. */
const CLAVES_DE_SOLUCION = ['solution', 'proof', 'certificate', 'derivation', 'lines', 'steps'];

describe('corrida W3 materializada (T-H5-05)', () => {
  it('corrió con el orden congelado sobre el paquete real, no sobre la muestra L0', () => {
    expect(corrida.frozenOrder.measuredOn).toBe('real_content_package');
    expect(corrida.frozenOrder.variantId).not.toBe('');
  });

  it('ningún registro público de reactivo lleva la solución', () => {
    for (const item of corrida.items) {
      for (const clave of CLAVES_DE_SOLUCION) {
        expect(clave in item, `${item.candidateId} expone ${clave}`).toBe(false);
      }
    }
  });

  it('todo certificado privado vuelve a verificar con logic-core', () => {
    expect(soluciones.privateSolutions.length).toBeGreaterThan(0);
    for (const solucion of soluciones.privateSolutions) {
      expect(solucion.authorizedCalculusVersion).toBe(AUTHORIZED_CALCULUS_VERSION);
      const veredicto = verify({
        lines: solucion.certificate.lines,
        goal: solucion.certificate.lines[solucion.certificate.lines.length - 1]?.formula ?? '',
      });
      expect(veredicto.valid, `${solucion.itemId} no re-verifica`).toBe(true);
      expect(veredicto.goalReached).toBe(true);
    }
  });

  it('hay un certificado privado por reactivo aceptado, y ninguno de más', () => {
    const aceptados = corrida.items.filter((i) => i.accepted).map((i) => i.candidateId);
    expect(aceptados).toHaveLength(corrida.accepted);
    expect([...soluciones.privateSolutions].map((s) => s.itemId).sort()).toEqual([...aceptados].sort());
  });

  it('los rechazos usan solo códigos de la lista cerrada', () => {
    for (const codigo of Object.keys(corrida.rejectionsByCode)) {
      expect(W3_REJECTION_CODES as readonly string[]).toContain(codigo);
    }
    expect(corrida.accepted + corrida.rejected).toBe(corrida.candidates);
  });

  it('el crítico consta como NO independiente: su acuerdo no es evidencia para congelar', () => {
    expect(corrida.criticIndependence.independent).toBe(false);
  });

  it('los huecos de cobertura se declaran sobre los dieciocho KC, sin sacar ninguno', () => {
    // No se tapan quitando el KC del piloto: un KC fuera de la lista dejaría la
    // cobertura completa justo donde falta todo (D-18). Lo que se comprueba es
    // que los huecos que haya estén **dichos**, no que no los haya.
    const kcsConHueco = new Set(corrida.coverageGaps.map((g) => g.kcId));
    for (const kcId of kcsConHueco) {
      expect(corrida.items.some((i) => i.targetKcs.some((k) => k === kcId))).toBe(true);
    }
  });

  it('KC13 tiene reactivos: es la regresión del arreglo de ∨E (D-56)', () => {
    // Esta prueba nació al revés. Cuando se escribió, fijaba que KC13 estaba a
    // **cero** porque el buscador no construía `∨E` y ninguna premisa
    // disyuntiva era utilizable. Arreglado el buscador, la afirmación de
    // entonces caducó: se sustituye por la contraria, que es la que ahora hay
    // que defender. Si `∨E` volviera a desaparecer, esto cae.
    const kc13 = corrida.items.filter((i) => i.targetKcs.includes('KC13') && i.accepted);
    expect(kc13.length).toBeGreaterThan(0);
  });
});

/**
 * Reactivos publicados en `items/`, que es el banco que el resto del sistema
 * lee. Se recorren las carpetas en vez de nombrarlas: la lista de carpetas la
 * fija §4.3 del plan y nombrarlas aquí duplicaría esa autoridad en un sitio que
 * puede quedarse viejo.
 */
interface ReactivoPublicado {
  readonly candidateId: string;
  readonly bankFunction: string;
  readonly targetKcs: readonly string[];
  readonly statement: { readonly premises: readonly string[]; readonly goal: string };
  readonly hints: readonly {
    readonly level: 1 | 2 | 3 | 4 | 5;
    readonly text: string;
    readonly proposedMasteryDisqualifying: boolean;
    readonly masteryFacts: MasteryHintFacts;
  }[];
}

const publicados: readonly ReactivoPublicado[] = readdirSync(join(CONTENIDO, 'items'), {
  withFileTypes: true,
})
  .filter((entrada) => entrada.isDirectory())
  .flatMap(
    (entrada) =>
      leerJsonConCabecera<{ readonly items: readonly ReactivoPublicado[] }>(
        `items/${entrada.name}/items.yaml`,
      ).items,
  );

/**
 * Reactivos cuyo certificado **no** contiene la regla que su KC declara.
 *
 * Vive aparte para que el control positivo ejercite exactamente el mismo
 * código que la comprobación. Una prueba de detección que reimplementa la
 * comprobación no prueba que la comprobación detecte nada.
 *
 * La regla se busca en las **líneas** del certificado, no en `rulesUsed`: la
 * reiteración se inserta al linealizar y no consta en el término de derivación,
 * así que `rulesUsed` diría que ningún reactivo de KC03 usa `R`.
 */
function reactivosSinSuRegla(
  items: readonly ReactivoPublicado[],
  certificados: ReadonlyMap<string, readonly { readonly rule: string }[]>,
): { readonly comprobados: number; readonly incumplen: readonly string[] } {
  const incumplen: string[] = [];
  let comprobados = 0;
  for (const item of items) {
    const regla = KC_CATALOG[item.targetKcs[0] as KcId]?.ruleId;
    if (regla === undefined) continue;
    comprobados += 1;
    const lineas = certificados.get(item.candidateId) ?? [];
    if (!lineas.some((l) => l.rule === regla)) incumplen.push(item.candidateId);
  }
  return { comprobados, incumplen };
}

const certificadosPorId = new Map(
  soluciones.privateSolutions.map((s) => [s.itemId, s.certificate.lines]),
);

describe('banco publicado en items/ (T-H5-05)', () => {
  it('publica todos los aceptados, y ninguno de más', () => {
    // Regresión de un defecto silencioso: `items/` tiene nueve carpetas y hay
    // diez reservas —`TRANSFER_MASTERY` y `TRANSFER_MEASUREMENT` comparten
    // `transfer/`—, así que escribir un archivo por reserva hacía que la segunda
    // **sobrescribiera** a la primera. Los 17 reactivos de `TRANSFER_MASTERY`
    // estaban en el informe y en los certificados, y no en el banco. El informe
    // seguía cuadrando: por eso hace falta comprobar el banco, no el informe.
    const aceptados = corrida.items.filter((i) => i.accepted).map((i) => i.candidateId);
    expect([...publicados].map((i) => i.candidateId).sort()).toEqual([...aceptados].sort());
  });

  it('cada reactivo ejercita la regla que su KC declara', () => {
    const { comprobados, incumplen } = reactivosSinSuRegla(publicados, certificadosPorId);
    // Sin esta línea, un banco vacío —o unos KC todos sin `ruleId`— haría pasar
    // la comprobación por vacío.
    expect(comprobados).toBeGreaterThan(0);
    expect(incumplen).toEqual([]);
  });

  it('esa comprobación ve un certificado que no usa la regla de su KC', () => {
    // Control positivo con el defecto real que encontró W4: `kc03-transf` decía
    // ser de reiteración y su certificado obtenía el consecuente por `∧E` dentro
    // de la subprueba. Es el mismo código, con el certificado de entonces.
    const comoAntes = new Map<string, readonly { readonly rule: string }[]>([
      [
        'kc03-transf',
        [
          { rule: 'PR' },
          { rule: 'AS' },
          { rule: '∧E' },
          { rule: '→I' },
        ],
      ],
    ]);
    const item = publicados.find((i) => i.candidateId === 'kc03-transf');
    expect(item, 'kc03-transf ya no está en el banco').toBeDefined();
    const { comprobados, incumplen } = reactivosSinSuRegla([item as ReactivoPublicado], comoAntes);
    expect(comprobados).toBe(1);
    expect(incumplen).toEqual(['kc03-transf']);
  });

  it('las pistas se derivan del reactivo, no son una plantilla constante', () => {
    // Lo que W4 registró como observación sin código: tres pistas iguales para
    // todos no filtran solución —y por eso pasaban la comprobación de fuga— pero
    // tampoco «indican el siguiente tipo de operación» de *este* reactivo (§8.6).
    const porNivel = new Map<number, Set<string>>();
    for (const item of publicados) {
      for (const pista of item.hints) {
        porNivel.set(pista.level, (porNivel.get(pista.level) ?? new Set()).add(pista.text));
      }
    }
    for (const [nivel, textos] of porNivel) {
      expect(textos.size, `el nivel ${nivel} tiene un solo texto para todo el banco`).toBeGreaterThan(1);
    }
    // Y la variación no es cosmética: sigue a la forma de la meta. Dos reactivos
    // con metas de conectivo principal distinto no comparten pista de nivel 3.
    const nivel3 = new Map<string, string>();
    for (const item of publicados) {
      const texto = item.hints.find((h) => h.level === 3)?.text ?? '';
      const clave = parse(item.statement.goal).kind;
      const previo = nivel3.get(clave);
      if (previo !== undefined) continue;
      nivel3.set(clave, texto);
    }
    expect(new Set(nivel3.values()).size).toBe(nivel3.size);
  });

  it('la propuesta de masteryDisqualifying coincide con la política autoritativa', () => {
    // No es que la propuesta deba coincidir por definición —no es autoritativa—,
    // sino que si no coincide el linter de paquete (`T-H5-13`) rechaza el freeze
    // con `authoritative_mastery_flags`. La primera corrida proponía `false` en
    // los tres niveles y DEC-HINT-AUTHORITY-001 descalifica **siempre** de nivel
    // 2 en adelante: eran 1114 discrepancias esperando en el freeze.
    const discrepancias: string[] = [];
    let contadas = 0;
    for (const item of publicados) {
      for (const pista of item.hints) {
        contadas += 1;
        expect(pista.masteryFacts?.level, `${item.candidateId}#${pista.level} sin hechos`).toBe(
          pista.level,
        );
        if (masteryDisqualifying(pista.masteryFacts) !== pista.proposedMasteryDisqualifying) {
          discrepancias.push(`${item.candidateId}#${pista.level}`);
        }
      }
    }
    expect(contadas).toBeGreaterThan(0);
    expect(discrepancias).toEqual([]);
  });
});
