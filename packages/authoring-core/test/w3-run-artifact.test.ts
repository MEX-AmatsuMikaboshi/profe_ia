import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { masteryDisqualifying, type MasteryHintFacts } from '@profesor-ia/domain-engine';
import { AUTHORIZED_CALCULUS_VERSION, parse, verify } from '@profesor-ia/logic-core';
import {
  CAL09_FROZEN_MANIFEST,
  classifyComplexity,
  complexityIndex,
  type StructuralComplexityProfile,
} from '@profesor-ia/proof-search';
import { describe, expect, it } from 'vitest';

import {
  KC_CATALOG,
  expectedHintRules,
  hintNamesForeignRule,
  probeRuleClosureViolations,
  surfaceControlViolations,
  surfaceOverlapCensus,
  probesExemptFromRuleClosure,
  W3_REJECTION_CODES,
  type KcId,
  type PrivateSolution,
  type ProbeRuleClosureInput,
  type Reserve,
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
  readonly complexityCalibration: {
    readonly parameterId: string;
    readonly version: string;
    readonly sampleHash: string;
  };
  readonly surfaceCensus: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly probesExemptFromRuleClosure: readonly string[];
  readonly probeReservesNotGenerated: readonly {
    readonly kcId: string;
    readonly reserve: string;
    readonly reason: string;
  }[];
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

/**
 * Sondas del banco con las reglas que sus certificados usan **de verdad**.
 *
 * La secuencia de enseñanza se lee del artefacto de Rol B en vez de escribirse
 * aquí: es el orden congelado contra el que hay que comprobar, y copiarlo
 * dejaría la prueba pasando cuando la secuencia cambiara.
 */
const secuencia = leerJsonConCabecera<{ readonly teachingSequence: readonly KcId[] }>(
  'objectives/objectives.yaml',
).teachingSequence;

const sondasDelBanco: readonly ProbeRuleClosureInput[] = publicados.map((item) => ({
  itemId: item.candidateId,
  reserve: item.bankFunction as Reserve,
  targetKcId: item.targetKcs[0] as KcId,
  ruleIdsInCertificate: (certificadosPorId.get(item.candidateId) ?? []).map((l) => l.rule),
}));

describe('clausura de reglas del banco publicado (D-65, G1)', () => {
  it('ninguna sonda exige una regla que su fase no haya enseñado', () => {
    // **Esta prueba afirmaba el defecto y ahora afirma su ausencia**, que es el
    // movimiento previsto cuando se regenera: hasta el banco del 2026-08-22
    // exigía `expect(afectadas.size).toBe(70)`, con la causa en las cuatro
    // plantillas de envoltura —`cond_meta` importaba `→I`, `conj_premisa` `∧E` y
    // `disy_meta` `∨I`—. El rediseño de D-68 varía el núcleo del KC por
    // estructura de los operandos, multiplicidad y dirección, y ninguno de esos
    // ejes importa una regla ajena.
    //
    // Que el número fuera 70 y ahora sea 0 es lo que demuestra que la
    // regeneración arregló lo que dice arreglar. Si esta prueba pasara sin haber
    // pasado antes por el 70, no probaría nada.
    const violaciones = probeRuleClosureViolations(sondasDelBanco, secuencia);
    expect(violaciones).toEqual([]);

    // Y lo que la guarda deja fuera sigue contado: las sondas de los cuatro KC
    // que no enseñan regla —KC01, KC02, KC08 y KC18—. Un recorte sin contar se
    // lee como cobertura completa.
    expect(probesExemptFromRuleClosure(sondasDelBanco)).toHaveLength(128);
  });

  it('la comprobación no pasa por vacío: mira sondas de verdad y todas las reservas', () => {
    // Sin esto, un banco sin sondas —o un `bankFunction` que dejara de casar con
    // `Reserve`— daría cero violaciones y parecería un banco sano. Es lo que
    // sostiene la prueba de arriba ahora que su aserto es `[]`.
    const deMedicion = sondasDelBanco.filter((s) =>
      ['probes_baseline', 'probes_intervention', 'retention', 'TRANSFER_MEASUREMENT'].includes(
        s.reserve,
      ),
    );
    expect(deMedicion.length).toBe(548);
    expect(deMedicion.every((s) => s.ruleIdsInCertificate.length > 0)).toBe(true);
    // Y las sondas cuya clausura **sí** se juzga son mayoría: 548 menos las 128
    // exentas. Sin esta línea, un catálogo que perdiera los `ruleId` dejaría
    // todo el banco exento y la prueba de arriba pasaría por vacío.
    expect(deMedicion.length - probesExemptFromRuleClosure(sondasDelBanco).length).toBe(420);
  });

  it('KC03 no tiene sondas primarias, y eso está declarado y contado', () => {
    // No es un hueco: la regla de KC03 es `R`, que solo opera dentro de una
    // subprueba, y toda regla que abre una subprueba se enseña después. Con el
    // horizonte «hasta el KC medido inclusive» la única regla disponible es `R`,
    // y con `R` sola la meta es siempre una premisa. La ausencia se publica en
    // el informe en vez de dejarse notar por el conteo.
    expect(corrida.probeReservesNotGenerated).toEqual([
      expect.objectContaining({ kcId: 'KC03', reserve: 'probes_baseline' }),
      expect.objectContaining({ kcId: 'KC03', reserve: 'probes_intervention' }),
    ]);
    for (const ausencia of corrida.probeReservesNotGenerated) {
      expect(ausencia.reason.length).toBeGreaterThan(80);
    }
    // `sondasDelBanco` lleva el banco entero, así que hay que quedarse con las
    // reservas de medición: los seis reactivos de enseñanza de KC03 siguen ahí y
    // no son sondas.
    const kc03 = sondasDelBanco.filter(
      (s) => s.targetKcId === 'KC03' && MEASUREMENT_RESERVES.includes(s.reserve),
    );
    expect(new Set(kc03.map((s) => s.reserve))).toEqual(
      new Set(['retention', 'TRANSFER_MEASUREMENT']),
    );
  });

  it('las dos sondas de KC03 que quedan sí reiteran: miden lo que dicen medir', () => {
    // La primera pareja escrita para el rediseño construía la meta de la
    // subprueba con `∧I` y su certificado no tenía un solo `R`: eran sondas de
    // reiteración que no medían reiteración —el mismo `incorrect_kc_label` que
    // W4 encontró en `kc03-transf`—. `R` solo es forzosa cuando la conclusión de
    // la subprueba **es** una fórmula accesible entera.
    const kc03 = sondasDelBanco.filter(
      (s) => s.targetKcId === 'KC03' && MEASUREMENT_RESERVES.includes(s.reserve),
    );
    expect(kc03.length).toBe(4);
    for (const sonda of kc03) {
      expect(sonda.ruleIdsInCertificate, `${sonda.itemId} no reitera`).toContain('R');
    }
  });
});

describe('fidelidad de las reglas que nombran las pistas (D-67, G4)', () => {
  it('ninguna pista nombra una regla que no corresponde a su enunciado', () => {
    // **Afirmaba el defecto y ahora afirma su ausencia.** Hasta el banco del
    // 2026-08-22 esta lista tenía los diez `kc16-*#2`: la pista mandaba a `¬E`
    // desde `¬¬A`, y `¬E` es «φ, ¬φ ⊢ ⊥», que no saca `A` de `¬¬A`. No revelaba
    // de más: enseñaba una aplicación falsa de la regla, que es peor, y el libro
    // cerrado no tenía código para eso.
    //
    // La comprobación usa `hintNamesForeignRule()`, que es el mismo código que
    // la guarda: una prueba que reimplementara el criterio no probaría que el
    // criterio aplicado sea ése. Desde D-68 la guarda corre además **dentro** de
    // `assertHintSet()`, así que un banco con este defecto ya no se puede
    // publicar: los reactivos caerían con `hint_policy_violation`.
    const malas: string[] = [];
    for (const item of publicados) {
      const esperado = expectedHintRules(item.statement);
      for (const pista of item.hints) {
        if (hintNamesForeignRule(pista.text, esperado).length > 0) {
          malas.push(`${item.candidateId}#${pista.level}`);
        }
      }
    }
    expect(malas.sort()).toEqual([]);
  });

  it('esa comprobación no pasa por vacío: el resto del banco sí nombra la regla correcta', () => {
    const conCláusulaDirectiva = publicados.filter((item) =>
      item.hints.some((h) => /(?:introduce|elimina)[n]? (?:es|son)/u.test(h.text)),
    );
    expect(conCláusulaDirectiva.length).toBeGreaterThan(500);
    const fueraDeKc16 = conCláusulaDirectiva.filter((i) => !i.targetKcs.includes('KC16'));
    for (const item of fueraDeKc16) {
      const esperado = expectedHintRules(item.statement);
      for (const pista of item.hints) {
        expect(
          hintNamesForeignRule(pista.text, esperado),
          `${item.candidateId}#${pista.level}`,
        ).toEqual([]);
      }
    }
  });
});

/** Enunciados del banco en la forma que pide el control de superficie. */
const superficieDe = (item: ReactivoPublicado) => ({
  itemId: item.candidateId,
  reserve: item.bankFunction as Reserve,
  targetKcId: item.targetKcs[0] as string,
  premises: item.statement.premises,
  goal: item.statement.goal,
});
/** Las cuatro reservas de medición, para filtrar el banco entero. */
const MEASUREMENT_RESERVES: readonly string[] = [
  'probes_baseline',
  'probes_intervention',
  'retention',
  'TRANSFER_MEASUREMENT',
];
const ENSENANZA_NO_TRANSFERENCIA = [
  'diagnostic',
  'guided_practice',
  'independent_practice',
  'recovery',
  'replacement',
];

describe('control de superficie de §5.11 (D-67, G3)', () => {
  const sondas = publicados
    .filter((i) =>
      ['probes_baseline', 'probes_intervention', 'retention', 'TRANSFER_MEASUREMENT'].includes(
        i.bankFunction,
      ),
    )
    .map(superficieDe);
  const ensenanza = publicados
    .filter((i) => ENSENANZA_NO_TRANSFERENCIA.includes(i.bankFunction))
    .map(superficieDe);

  it('ninguna sonda de transferencia repite las premisas practicadas', () => {
    // **Afirmaba el defecto y ahora afirma su ausencia.** Hasta el banco del
    // 2026-08-22 eran treinta `TRANSFER_MEASUREMENT` con las mismas premisas y
    // las mismas letras que un reactivo ya practicado, porque `sonda-conj_meta`
    // envolvía la **meta** y dejaba las premisas intactas. §5.11 exige de
    // transferencia «una forma superficial suficientemente distinta de las
    // prácticas inmediatas».
    const hallazgos = surfaceControlViolations(sondas, ensenanza);
    expect(hallazgos).toEqual([]);
  });

  it('el censo dice que el solapamiento desapareció, no solo que no hay violación', () => {
    // Fuera de transferencia ninguna autoridad fija un umbral de superficie, así
    // que compartir premisas se cuenta y no se rechaza. Por eso el censo es la
    // medida que importa: antes decía `premises_literal: 55` y
    // `premises_renaming: 99` en `probes_intervention` y `premises_literal: 30`
    // en `retention`; ahora **toda** sonda del banco es superficialmente
    // distinta de la enseñanza de su KC.
    const censo = surfaceOverlapCensus(sondas, ensenanza);
    expect(censo.probes_baseline).toEqual({
      statement_renaming: 0,
      premises_literal: 0,
      premises_renaming: 0,
      distinct: 238,
    });
    expect(censo.probes_intervention).toEqual({
      statement_renaming: 0,
      premises_literal: 0,
      premises_renaming: 0,
      distinct: 238,
    });
    expect(censo.retention).toMatchObject({ premises_literal: 0, distinct: 36 });
    expect(censo.TRANSFER_MEASUREMENT).toMatchObject({ premises_literal: 0, distinct: 36 });
    for (const fila of Object.values(censo)) expect(fila.statement_renaming).toBe(0);
  });

  it('el censo del informe es el que produjo W3, no uno recalculado aquí', () => {
    // Si la prueba recalculara el censo y no lo contrastara con el publicado, un
    // informe que dejara de escribirlo —o que escribiera otro— pasaría sin que
    // nadie lo viera, y el censo es justamente lo que demuestra que el control
    // operó durante la corrida y no solo en esta prueba.
    expect(corrida.surfaceCensus).toEqual(surfaceOverlapCensus(sondas, ensenanza));
  });
});

describe('la calibración con la que se midió el banco (D-66)', () => {
  it('el banco está medido con la calibración vigente, y lo declara', () => {
    // **Afirmaba el defecto y ahora afirma su ausencia.** Hasta el banco del
    // 2026-08-22 eran 561 de 571 índices en la escala retirada `cal-09-v1`: la
    // re-congelación de D-66 los dejó obsoletos y el informe no registraba con
    // qué calibración se había medido, así que un banco viejo y uno nuevo eran
    // indistinguibles.
    //
    // Ahora se comprueban las dos cosas a la vez —el índice recomputado coincide
    // **y** el informe declara la versión—, porque cada una sin la otra se puede
    // satisfacer sin ser cierta.
    const desactualizados = publicados.filter((item) => {
      const almacenado = (item as unknown as { complexityIndex: number }).complexityIndex;
      const recomputado = complexityIndex(
        (item as unknown as { complexity: StructuralComplexityProfile }).complexity,
        CAL09_FROZEN_MANIFEST,
      );
      return Math.abs(almacenado - recomputado) > 1e-6;
    });
    expect(CAL09_FROZEN_MANIFEST.version).toBe('cal-09-v2');
    expect(desactualizados).toEqual([]);
    expect(corrida.complexityCalibration).toMatchObject({
      parameterId: 'CAL-09',
      version: 'cal-09-v2',
      sampleHash: CAL09_FROZEN_MANIFEST.sampleHash,
    });
  });

  it('pero ningún reactivo cambia de estrato, así que las aceptaciones de W3 sobreviven', () => {
    // Importa para planificar: la re-calibración mueve los números, no las
    // decisiones. `complexity_target_mismatch` compara **estratos**, y ninguno
    // se mueve, así que regenerar no debería cambiar qué se acepta.
    const cambianDeEstrato = publicados.filter((item) => {
      const i = item as unknown as {
        complexity: StructuralComplexityProfile;
        measuredComplexityTier: string;
      };
      return classifyComplexity(i.complexity, CAL09_FROZEN_MANIFEST) !== i.measuredComplexityTier;
    });
    expect(cambianDeEstrato).toEqual([]);
  });
});

describe('los artefactos de W4 frente al banco vigente (D-68)', () => {
  const muestraW4 = leerJsonConCabecera<{
    readonly generatedAt: string;
    readonly population: readonly { readonly artifactId: string }[];
  }>('audits/w4-preaudit-sample.yaml');

  it('FIJA EL DESAJUSTE DE HOY: la muestra de W4 es del banco anterior', () => {
    // El rediseño de las plantillas de sonda (D-68) regeneró W3, y la muestra de
    // auditoría previa se sacó del banco de 571 reactivos del 2026-08-22. Los
    // juicios de defecto que hay sobre ella son trabajo humano y **no se
    // reciclan**: la auditoría se repite sobre el banco nuevo, en su turno del
    // orden de trabajo —después de la selección A/B/C—.
    //
    // Lo que esta prueba impide es que ese desajuste pase inadvertido. Sin ella,
    // `w4-preaudit-sample.yaml` seguiría describiendo una población que ya no
    // existe y nada lo diría; es el mismo agujero que D-66 cerró exigiendo que
    // el banco registrara su calibración.
    //
    // **Se sustituye por la contraria —`toEqual([])` y poblaciones iguales—
    // cuando se vuelva a correr W4.**
    const vivos = new Set(publicados.map((i) => i.candidateId));
    const desaparecidos = muestraW4.population
      .map((x) => x.artifactId)
      .filter((id) => !vivos.has(id));
    expect(desaparecidos.length).toBe(14);
    expect(muestraW4.population.length).not.toBe(publicados.length);
  });

  it('esa comprobación no pasa por vacío: la muestra existe y tiene población', () => {
    // Un artefacto ausente o vacío daría cero desaparecidos y se leería como
    // muestra al día.
    expect(muestraW4.population.length).toBeGreaterThan(500);
    expect(publicados.length).toBeGreaterThan(500);
  });
});
