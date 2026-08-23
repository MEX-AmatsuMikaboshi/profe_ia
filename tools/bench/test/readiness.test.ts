import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MATERIAL_CASE_SET,
  REFRESH_2026_08_18,
  REFRESH_2026_08_23,
  REFRESH_WINDOW_5D,
  assessMaterialReadiness,
  formatReadiness,
  loadContentPackage,
  type BenchCase,
  type CaseSet,
  type ContentPackage,
} from '../src/index.js';

/**
 * Preparación de la corrida material (T-H4-10).
 *
 * **Expectativas declaradas antes de correr.** Lo que este archivo tenía que
 * decidir es si el harness sabe distinguir tres cosas que se confunden con
 * facilidad:
 *
 * 1. Lo que impide **correr** de lo que sólo impide **coronar**. Un paquete sin
 *    congelar no impide medir, y tratarlo como bloqueo haría esperar a W5 para
 *    poder ejecutar nada.
 * 2. Un conjunto **ejecutable** de un conjunto **bueno**. Que los 200 casos
 *    estén bien redactados es la revisión humana de D-41 y ninguna comprobación
 *    mecánica la sustituye; aquí sólo se mira que se puedan correr.
 * 3. Lo que falta **hoy**, con nombre y apellido, sin abrir un socket.
 */

const CONTENIDO = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/unidad-deduccion-natural',
);

const PAQUETE = loadContentPackage(CONTENIDO);

/** Instante de evaluación fijo: la comprobación no puede depender del reloj. */
const AHORA = '2026-08-23T08:00:00.000Z';

/**
 * Refresco vigente **de fixture**: el real del 2026-08-18 caducó, y la prueba de
 * que caducó está más abajo. Se clona el real y se le mueve la fecha, en vez de
 * inventar uno: así lo que se prueba sigue siendo el registro de verdad.
 */
const refrescoVigente = (): unknown => {
  const clon = structuredClone(REFRESH_2026_08_18) as {
    refreshedAt: string;
    candidates: { refreshedAt: string; sources: { retrievedAt: string }[] }[];
  };
  clon.refreshedAt = AHORA;
  for (const candidato of clon.candidates) {
    candidato.refreshedAt = AHORA;
    for (const fuente of candidato.sources) fuente.retrievedAt = AHORA;
  }
  return clon;
};

const entrada = (extra: Partial<Parameters<typeof assessMaterialReadiness>[0]> = {}) =>
  assessMaterialReadiness({
    runId: 'bench-01-material',
    assessedAt: AHORA,
    caseSet: MATERIAL_CASE_SET,
    contentPackage: PAQUETE,
    refreshRecord: refrescoVigente(),
    refreshWindow: REFRESH_WINDOW_5D,
    candidateIds: ['claude-haiku-4-5-20251001'],
    ...extra,
  });

describe('lo que hoy impide correr BENCH-01', () => {
  it('con el refresco de agosto, lo único que falla es el refresco', () => {
    // Fija el estado que **motivó** rehacer el refresco: contra el conjunto
    // material y el corpus reales, tres de las cuatro comprobaciones pasaban y
    // la que fallaba era documental. El bloque de más abajo comprueba que con el
    // refresco del 2026-08-23 ya no falla ninguna.
    const r = entrada({ refreshRecord: REFRESH_2026_08_18 });
    expect(r.readyToRun).toBe(false);
    expect(r.blockingReasons.length).toBe(1);
    expect(r.blockingReasons[0]).toContain('refresco_documental_vigente');
    for (const check of r.checks) {
      if (check.id === 'refresco_documental_vigente') continue;
      if (check.id === 'paquete_de_contenido_congelado') continue;
      expect(check.ok, check.id).toBe(true);
    }
  });

  it('el refresco del 2026-08-18 está caducado y lo dice sin ampliar la ventana', () => {
    const r = entrada({ refreshRecord: REFRESH_2026_08_18 });
    const check = r.checks.find((c) => c.id === 'refresco_documental_vigente');
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain('caducada');
  });

  it('un candidato que el refresco no cubre no se mide', () => {
    // `claude-sonnet-5` es el candidato que §3.4 recomienda y **no está** en el
    // refresco de agosto: elegirlo exige refrescar, no editar el binding.
    const r = entrada({ candidateIds: ['claude-sonnet-5'] });
    const check = r.checks.find((c) => c.id === 'refresco_documental_vigente');
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain('claude-sonnet-5');
  });

  it('sin candidatos declarados tampoco corre', () => {
    // Elegir a quién se mide es una decisión, no un valor por omisión.
    const r = entrada({ candidateIds: [] });
    expect(r.readyToRun).toBe(false);
  });
});

describe('con el refresco vigente, el conjunto material está listo para correr', () => {
  it('las cuatro comprobaciones bloqueantes pasan', () => {
    const r = entrada();
    expect(r.blockingReasons).toEqual([]);
    expect(r.readyToRun).toBe(true);
  });

  it('pero no para coronar, y esa diferencia es el punto', () => {
    // Un paquete sin congelar **no impide medir**. Tratarlo como bloqueo de
    // corrida haría esperar a W5 para poder ejecutar nada, y medir sin dictamen
    // es exactamente lo que `observeGates()` existe para permitir.
    const r = entrada();
    expect(r.readyToCrown).toBe(false);
    const check = r.checks.find((c) => c.id === 'paquete_de_contenido_congelado');
    expect(check?.ok).toBe(false);
    expect(check?.blocksRun).toBe(false);
    expect(r.blockingReasons.join(' ')).not.toContain('congelado');
  });

  it('con un paquete congelado, sí autoriza el dictamen', () => {
    const congelado: ContentPackage = { ...PAQUETE, frozen: true, frozenReason: 'fixture' };
    const r = entrada({ contentPackage: congelado });
    expect(r.readyToRun).toBe(true);
    expect(r.readyToCrown).toBe(true);
  });
});

describe('controles positivos: cada comprobación detecta lo suyo', () => {
  const sustituir = (caseId: string, cambio: Partial<BenchCase>): CaseSet => ({
    ...MATERIAL_CASE_SET,
    cases: MATERIAL_CASE_SET.cases.map((c) => (c.caseId === caseId ? { ...c, ...cambio } : c)),
  });

  it('un caso del gate de anclas con un bloque que no existe', () => {
    // Sin esta comprobación, la corrida llegaría hasta
    // `assertAnchorFragmentsAvailable()` con credenciales y pasarelas montadas.
    const caso = MATERIAL_CASE_SET.cases.find((c) => c.family === 'explanation_request');
    const r = entrada({ caseSet: sustituir(caso?.caseId ?? '', { blockId: 'KC99' }) });
    const check = r.checks.find((c) => c.id === 'fragmentos_para_el_gate_de_anclas');
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain('KC99');
    expect(r.readyToRun).toBe(false);
  });

  it('una caída cuyo bloque no tiene activo congelado', () => {
    const caso = MATERIAL_CASE_SET.cases.find((c) => c.family === 'failure_or_invalid_output');
    const r = entrada({ caseSet: sustituir(caso?.caseId ?? '', { degradedBlockId: 'KC99' }) });
    const check = r.checks.find((c) => c.id === 'activos_para_el_gate_de_recuperacion');
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain('KC99');
    expect(r.readyToRun).toBe(false);
  });

  it('un conjunto que ya no cubre los pisos por familia', () => {
    const recortado: CaseSet = {
      ...MATERIAL_CASE_SET,
      cases: MATERIAL_CASE_SET.cases.slice(0, 10),
    };
    const r = entrada({ caseSet: recortado });
    const check = r.checks.find((c) => c.id === 'conjunto_material_ejecutable');
    expect(check?.ok).toBe(false);
    expect(r.readyToRun).toBe(false);
  });

  it('el paquete real no pasa por vacío: tiene fragmentos y activos', () => {
    // Un paquete vacío haría pasar las dos comprobaciones de arriba por no
    // tener nada que comprobar.
    expect(PAQUETE.authorizedFragmentsByBlock.size).toBeGreaterThan(0);
    expect(PAQUETE.frozenAssets.length).toBeGreaterThan(0);
  });
});

describe('el informe dice lo que hay que hacer', () => {
  it('nombra lo que bloquea y distingue correr de coronar', () => {
    const texto = formatReadiness(entrada({ refreshRecord: REFRESH_2026_08_18 }));
    expect(texto).toContain('NO SE PUEDE CORRER');
    expect(texto).toContain('refresco_documental_vigente');
    expect(texto).toContain('no corona a nadie');
  });

  it('cuando se puede correr, lo dice y sigue avisando del dictamen', () => {
    const texto = formatReadiness(entrada());
    expect(texto).toContain('SE PUEDE CORRER.');
    expect(texto).toContain('El dictamen NO está autorizado');
  });
});

describe('con el refresco del 2026-08-23, BENCH-01 se puede correr (D-73)', () => {
  const conRefrescoVigente = (candidateIds: readonly string[]) =>
    assessMaterialReadiness({
      runId: 'bench-01-material',
      // Dentro de la ventana de 5 días desde el refresco del 2026-08-23.
      assessedAt: '2026-08-23T09:00:00.000Z',
      caseSet: MATERIAL_CASE_SET,
      contentPackage: PAQUETE,
      refreshRecord: REFRESH_2026_08_23,
      refreshWindow: REFRESH_WINDOW_5D,
      candidateIds,
    });

  it('las cuatro comprobaciones bloqueantes pasan con claude-sonnet-5', () => {
    // **Éste es el resultado que cierra la cadena de código.** Lo que queda
    // antes de coronar es humano: la lectura por muestra del paso 19, la
    // revisión de los 200 casos y W5.
    const r = conRefrescoVigente(['claude-sonnet-5']);
    expect(r.blockingReasons).toEqual([]);
    expect(r.readyToRun).toBe(true);
  });

  it('y sigue sin autorizar el dictamen', () => {
    expect(conRefrescoVigente(['claude-sonnet-5']).readyToCrown).toBe(false);
  });

  it('el refresco anterior, con el mismo instante, no deja correr', () => {
    // Control positivo: sin esto, «se puede correr» podría venir de que la
    // comprobación dejó de mirar el refresco.
    const r = assessMaterialReadiness({
      runId: 'bench-01-material',
      assessedAt: '2026-08-23T09:00:00.000Z',
      caseSet: MATERIAL_CASE_SET,
      contentPackage: PAQUETE,
      refreshRecord: REFRESH_2026_08_18,
      refreshWindow: REFRESH_WINDOW_5D,
      candidateIds: ['claude-sonnet-5'],
    });
    expect(r.readyToRun).toBe(false);
  });
});
