import { describe, expect, it } from 'vitest';

import {
  assertProbeRuleClosure,
  KC_IDS,
  PROBE_RULE_HORIZON,
  probeRuleClosureViolations,
  ProbeRuleClosureError,
  probesExemptFromRuleClosure,
  type KcId,
  type ProbeRuleClosureInput,
} from '../src/index.js';

/**
 * Guarda G1 de D-65: una sonda no puede exigir una regla que en su fase todavía
 * no se ha enseñado.
 *
 * La secuencia de las pruebas es la congelada por Rol B —orden topológico de
 * `kc/map.yaml`— reproducida aquí como fixture. La prueba de artefacto
 * (`w3-run-artifact.test.ts`) la lee del contenido; ésta comprueba la función.
 */
const SECUENCIA: readonly KcId[] = KC_IDS;

const sonda = (parcial: Partial<ProbeRuleClosureInput>): ProbeRuleClosureInput => ({
  itemId: 'x-1',
  reserve: 'probes_intervention',
  targetKcId: 'KC05',
  ruleIdsInCertificate: ['PR', '∧E'],
  ...parcial,
});

describe('clausura de reglas de las sondas (D-65, G1)', () => {
  it('acepta la sonda que solo usa la regla del KC que mide', () => {
    expect(probeRuleClosureViolations([sonda({})], SECUENCIA)).toEqual([]);
  });

  it('acepta que use reglas de KC anteriores', () => {
    // KC09 (→I) puede apoyarse en →E, que es KC06.
    const s = sonda({ targetKcId: 'KC09', ruleIdsInCertificate: ['PR', 'AS', '→E', '→I'] });
    expect(probeRuleClosureViolations([s], SECUENCIA)).toEqual([]);
  });

  // ── Control positivo: el defecto real del banco del 2026-08-22 ────────────
  it('detecta la envoltura `cond_meta`, que importa →I (KC09) a una sonda de KC05', () => {
    const s = sonda({
      itemId: 'kc05-probes_intervention-9',
      targetKcId: 'KC05',
      ruleIdsInCertificate: ['PR', 'AS', '∧E', '→I'],
    });
    const violaciones = probeRuleClosureViolations([s], SECUENCIA);
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toMatchObject({
      itemId: 'kc05-probes_intervention-9',
      targetKcId: 'KC05',
      ruleId: '→I',
      ruleKcId: 'KC09',
      targetPosition: 5,
      rulePosition: 9,
    });
  });

  it('detecta la envoltura `conj_premisa`, que importa ∧E (KC05) a una sonda base de KC04', () => {
    const s = sonda({
      itemId: 'kc04-probes_baseline-2',
      reserve: 'probes_baseline',
      targetKcId: 'KC04',
      ruleIdsInCertificate: ['PR', '∧E', '∧I'],
    });
    // Solo ∧E, que es de KC05. `∧I` es la regla que la sonda mide y **no** es
    // violación aunque en línea base todavía no se haya enseñado: ver abajo.
    expect(probeRuleClosureViolations([s], SECUENCIA).map((v) => v.ruleId)).toEqual(['∧E']);
  });

  it('la línea base SÍ admite la regla que mide: no haberla enseñado es la medida', () => {
    // Es el punto que distingue esta guarda de una de dificultad. Una sonda de
    // línea base plantea justamente la regla que el alumno aún no ha recibido, y
    // que falle por ella es el dato que se busca. Lo que arruina la medida es
    // que falle por la regla de **otro** KC posterior, porque entonces la
    // respuesta incorrecta ya no distingue una causa de la otra.
    const propia = { targetKcId: 'KC07' as KcId, ruleIdsInCertificate: ['PR', '∨I'] };
    for (const reserve of ['probes_baseline', 'probes_intervention'] as const) {
      expect(probeRuleClosureViolations([sonda({ ...propia, reserve })], SECUENCIA)).toEqual([]);
    }
    // Y la ajena posterior sí, en las dos.
    const ajena = { targetKcId: 'KC07' as KcId, ruleIdsInCertificate: ['PR', 'AS', '∨I', '→I'] };
    for (const reserve of ['probes_baseline', 'probes_intervention'] as const) {
      expect(probeRuleClosureViolations([sonda({ ...ajena, reserve })], SECUENCIA)).toHaveLength(1);
    }
  });

  it('exime a los KC de fundamento y los devuelve contados, no en silencio', () => {
    // KC01 y KC02 abren la secuencia y no enseñan regla: toda derivación que se
    // les plantee usa reglas posteriores. Aplicarles la clausura los declararía
    // inmedibles en bloque, que no es una conclusión de esta guarda.
    const s = sonda({ targetKcId: 'KC01', reserve: 'probes_baseline', ruleIdsInCertificate: ['PR', '∧E', '∧I'] });
    expect(probeRuleClosureViolations([s], SECUENCIA)).toEqual([]);
    expect(probesExemptFromRuleClosure([s]).map((x) => x.itemId)).toEqual(['x-1']);
    // Y no exime lo que sí puede juzgar.
    expect(probesExemptFromRuleClosure([sonda({})])).toEqual([]);
  });

  it('retención y transferencia no tienen techo: después de la unidad ninguna regla es ajena', () => {
    for (const reserve of ['retention', 'TRANSFER_MEASUREMENT'] as const) {
      const s = sonda({ reserve, targetKcId: 'KC03', ruleIdsInCertificate: ['PR', 'R', 'IP'] });
      expect(probeRuleClosureViolations([s], SECUENCIA)).toEqual([]);
    }
  });

  it('ignora los reactivos que no son de medición: adelantar reglas ahí es andamiaje', () => {
    const s = sonda({ reserve: 'guided_practice', ruleIdsInCertificate: ['PR', 'AS', '∧E', 'IP'] });
    expect(probeRuleClosureViolations([s], SECUENCIA)).toEqual([]);
  });

  it('`R` participa como una regla más, que es lo que `FoundProof.rulesUsed` no permite', () => {
    // La reiteración se inserta al linealizar y **no consta** en
    // `FoundProof.rulesUsed`; una guarda alimentada desde ahí concluiría que
    // ningún reactivo usa `R` y no podría verla nunca. Por eso la entrada son
    // las líneas del certificado.
    //
    // Con la secuencia congelada `R` no puede violar nada —KC03 es el primer KC
    // con regla, así que ninguna sonda juzgable la tiene por delante—, y una
    // prueba sobre esa secuencia pasaría aunque `R` se ignorase por completo.
    // Se comprueba con la secuencia permutada, que es el parámetro que la
    // función recibe justamente para no cablear el orden.
    const permutada = SECUENCIA.map((kc) =>
      kc === 'KC03' ? 'KC04' : kc === 'KC04' ? 'KC03' : kc,
    ) as KcId[];
    const s = sonda({
      reserve: 'probes_intervention',
      targetKcId: 'KC04',
      ruleIdsInCertificate: ['PR', 'AS', '∧I', 'R'],
    });
    const violaciones = probeRuleClosureViolations([s], permutada);
    expect(violaciones.map((v) => v.ruleId)).toEqual(['R']);
    expect(violaciones[0]?.ruleKcId).toBe('KC03');
    // Y con el orden real, la misma sonda no viola nada.
    expect(probeRuleClosureViolations([s], SECUENCIA)).toEqual([]);
  });

  // ── Fallos cerrados ───────────────────────────────────────────────────────
  it('lanza ante una secuencia parcial en vez de dar por buenas las sondas que faltan', () => {
    expect(() => probeRuleClosureViolations([sonda({})], ['KC01', 'KC02'] as KcId[])).toThrow(
      ProbeRuleClosureError,
    );
  });

  it('lanza ante una justificación que no es regla ni `PR`/`AS`', () => {
    const s = sonda({ ruleIdsInCertificate: ['PR', 'DeMorgan'] });
    expect(() => probeRuleClosureViolations([s], SECUENCIA)).toThrow(/DeMorgan/);
  });

  it('la tabla de horizontes cubre todas las reservas de medición', () => {
    // Si una reserva de medición faltara, `probeRuleClosureViolations` lanzaría
    // en vez de tratarla como libre; esto lo comprueba antes.
    for (const reserva of ['probes_baseline', 'probes_intervention', 'retention', 'TRANSFER_MEASUREMENT']) {
      expect(PROBE_RULE_HORIZON[reserva]).toBeDefined();
      expect(PROBE_RULE_HORIZON[reserva]?.why.length).toBeGreaterThan(0);
    }
  });

  it('`assertProbeRuleClosure` nombra reactivo, regla y ambas posiciones', () => {
    const s = sonda({ itemId: 'kc07-probes_intervention-3', targetKcId: 'KC07', ruleIdsInCertificate: ['PR', 'AS', '∨I', '→I'] });
    expect(() => assertProbeRuleClosure([s], SECUENCIA)).toThrow(
      /kc07-probes_intervention-3.*→I.*KC09/,
    );
    expect(() => assertProbeRuleClosure([sonda({})], SECUENCIA)).not.toThrow();
  });
});
