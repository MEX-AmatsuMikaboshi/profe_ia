import { DegradedProfile, assertRefreshAuthorizesBenchmark } from '@profesor-ia/model-gateway';

import {
  ANCHOR_GATE_FAMILIES,
  assertAnchorBlocksDeclared,
  assertExpectationsMatchFamily,
  assertFaultDeclarationCoherent,
  assertMaterialSetUsable,
  type CaseSet,
} from './case-set.js';
import type { ContentPackage } from './corpus.js';

/**
 * Comprobación de preparación de la corrida material (T-H4-10).
 *
 * ## Por qué existe
 *
 * El runner es el único punto del repositorio donde se gasta dinero, y todos
 * sus frenos disparan **durante** la corrida: `assertFaultInjectorsAvailable`,
 * `assertDegradedProfileAvailable`, `assertAnchorFragmentsAvailable` y
 * `assertRefreshAuthorizesBenchmark` paran antes de la primera llamada, sí,
 * pero para llegar hasta ellos hay que haber montado credenciales, pasarelas y
 * transporte. Descubrir así que falta un bloque obliga a repetir el montaje
 * entero, y el día que uno de esos frenos no salte, lo que se descubre es que
 * se gastó.
 *
 * Esto responde a la pregunta anterior —**¿está todo para correr?**— sin abrir
 * un socket y sin credenciales. Es el paso que convierte «lo intento y vemos»
 * en una lista de lo que falta.
 *
 * ## Lo que NO hace, y no finge hacer
 *
 * **No sustituye a los frenos del runner.** Si esto dijera «listo» y el runner
 * no comprobara nada, bastaría con no llamar a esto para que la corrida saliera
 * sin red de seguridad. Los frenos siguen donde estaban; esto los adelanta.
 *
 * **No juzga la calidad del conjunto.** Que los 200 casos estén bien redactados
 * es la revisión humana de D-41, y ninguna comprobación mecánica la sustituye.
 * Aquí sólo se mira que el conjunto sea *ejecutable*.
 *
 * **No autoriza a coronar.** `paquete_congelado` se informa y **no bloquea la
 * corrida**, porque medir sin dictamen es legítimo y es lo que hace
 * `observeGates()`. Lo que bloquea el dictamen es `scoreCandidate()`, y no se
 * duplica esa puerta aquí: dos puertas para lo mismo es una que alguien quita.
 */

export interface ReadinessCheck {
  readonly id: string;
  readonly ok: boolean;
  /** Qué se comprobó y qué se observó. Va al informe tal cual. */
  readonly detail: string;
  /**
   * Si un `ok: false` impide correr. Falso en lo que sólo impide **coronar**:
   * confundir las dos cosas haría esperar a W5 para poder medir.
   */
  readonly blocksRun: boolean;
}

export interface MaterialReadiness {
  readonly runId: string;
  readonly assessedAt: string;
  readonly candidateIds: readonly string[];
  readonly checks: readonly ReadinessCheck[];
  /** Se puede correr: ninguna comprobación bloqueante falló. */
  readonly readyToRun: boolean;
  /** Se puede dictaminar: además, el paquete está congelado. */
  readonly readyToCrown: boolean;
  /** Lo que falta, en una línea cada cosa. Vacío cuando `readyToRun`. */
  readonly blockingReasons: readonly string[];
}

export interface MaterialReadinessInput {
  readonly runId: string;
  readonly assessedAt: string;
  readonly caseSet: CaseSet;
  readonly contentPackage: ContentPackage;
  readonly refreshRecord: unknown;
  readonly refreshWindow: unknown;
  readonly candidateIds: readonly string[];
}

function comprobar(
  id: string,
  blocksRun: boolean,
  detalleOk: string,
  cuerpo: () => void,
): ReadinessCheck {
  try {
    cuerpo();
    return { id, ok: true, detail: detalleOk, blocksRun };
  } catch (error) {
    return {
      id,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      blocksRun,
    };
  }
}

export function assessMaterialReadiness(input: MaterialReadinessInput): MaterialReadiness {
  const { caseSet, contentPackage: paquete } = input;

  const checks: ReadinessCheck[] = [
    comprobar(
      'conjunto_material_ejecutable',
      true,
      `${String(caseSet.cases.length)} casos: pisos por familia cubiertos, ids únicos, ` +
        'expectativas coherentes con su familia, caídas y bloques declarados donde toca.',
      () => {
        assertMaterialSetUsable(caseSet);
        assertExpectationsMatchFamily(caseSet);
        assertFaultDeclarationCoherent(caseSet);
        assertAnchorBlocksDeclared(caseSet);
      },
    ),

    comprobar(
      'fragmentos_para_el_gate_de_anclas',
      true,
      `Los ${String(
        caseSet.cases.filter((c) => ANCHOR_GATE_FAMILIES.includes(c.family)).length,
      )} casos del gate de anclas apuntan a bloques con fragmentos autorizados.`,
      () => {
        const huerfanos = [
          ...new Set(
            caseSet.cases
              .filter((c) => c.blockId !== undefined)
              .map((c) => c.blockId as string)
              .filter((b) => (paquete.authorizedFragmentsByBlock.get(b) ?? []).length === 0),
          ),
        ];
        if (huerfanos.length > 0) {
          throw new Error(
            `Sin fragmentos autorizados para ${huerfanos.join(', ')}. Toda ancla de esos casos ` +
              'sería irresoluble por construcción, y el cero hablaría del harness.',
          );
        }
      },
    ),

    comprobar(
      'activos_para_el_gate_de_recuperacion',
      true,
      'Todo caso con caída declarada tiene su explicación congelada en el paquete.',
      () => {
        const perfil = new DegradedProfile({
          assets: paquete.frozenAssets,
          feedbackTemplates: paquete.feedbackTemplates,
        });
        const faltan: string[] = [];
        for (const caso of caseSet.cases) {
          if (caso.degradedBlockId === undefined) continue;
          try {
            perfil.asset('explicacion', caso.degradedBlockId);
          } catch {
            faltan.push(`${caso.caseId} (${caso.degradedBlockId})`);
          }
        }
        if (faltan.length > 0) {
          throw new Error(
            `Sin activo congelado para ${faltan.join(', ')}. El gate de recuperación es de 100 % ` +
              'y bloqueante: fallaría por un hueco del banco y no por conducta del candidato.',
          );
        }
      },
    ),

    comprobar(
      'refresco_documental_vigente',
      true,
      `El refresco autoriza medir a ${input.candidateIds.join(', ')} el ${input.assessedAt}.`,
      () => {
        if (input.candidateIds.length === 0) {
          throw new Error(
            'No se declaró ningún candidato. Una corrida sin candidatos no mide nada, y elegir a ' +
              'quién se mide es una decisión, no un valor por omisión.',
          );
        }
        assertRefreshAuthorizesBenchmark(input.refreshRecord, input.refreshWindow, {
          runId: input.runId,
          startedAt: input.assessedAt,
          candidateIds: input.candidateIds,
          purpose: 'material',
        });
      },
    ),

    comprobar(
      'paquete_de_contenido_congelado',
      false,
      `Paquete ${paquete.assetVersion} congelado.`,
      () => {
        if (!paquete.frozen) {
          throw new Error(
            `El paquete \`${paquete.assetVersion}\` no está congelado, así que la corrida **mide ` +
              `pero no corona**: use \`observeGates()\`. ${paquete.frozenReason}`,
          );
        }
      },
    ),
  ];

  const bloqueantes = checks.filter((c) => !c.ok && c.blocksRun);
  return Object.freeze({
    runId: input.runId,
    assessedAt: input.assessedAt,
    candidateIds: input.candidateIds,
    checks: Object.freeze(checks),
    readyToRun: bloqueantes.length === 0,
    readyToCrown: checks.every((c) => c.ok),
    blockingReasons: Object.freeze(bloqueantes.map((c) => `${c.id}: ${c.detail}`)),
  });
}

/** Informe legible para la consola. No decide nada; formatea. */
export function formatReadiness(readiness: MaterialReadiness): string {
  const lineas = [
    `BENCH-01 · preparación de la corrida material — ${readiness.runId}`,
    `evaluado el ${readiness.assessedAt}`,
    `candidatos: ${readiness.candidateIds.join(', ') || '(ninguno declarado)'}`,
    '',
  ];
  for (const check of readiness.checks) {
    const marca = check.ok ? 'ok  ' : check.blocksRun ? 'FALLA' : 'aviso';
    lineas.push(`${marca} ${check.id}`);
    lineas.push(`      ${check.detail}`);
  }
  lineas.push('');
  lineas.push(readiness.readyToRun ? 'SE PUEDE CORRER.' : 'NO SE PUEDE CORRER todavía:');
  for (const razon of readiness.blockingReasons) lineas.push(`  · ${razon}`);
  lineas.push(
    readiness.readyToCrown
      ? 'Y el dictamen está autorizado: el paquete está congelado.'
      : 'El dictamen NO está autorizado: mida con `observeGates()`, que no corona a nadie.',
  );
  return lineas.join('\n');
}
