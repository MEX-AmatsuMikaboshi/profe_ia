import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUTHORIZED_CALCULUS_VERSION, verify } from '@profesor-ia/logic-core';
import { describe, expect, it } from 'vitest';

import { W3_REJECTION_CODES, type PrivateSolution, type W3ItemRecord } from '../src/index.js';

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
      expect(corrida.items.some((i) => i.targetKcs.includes(kcId))).toBe(true);
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
