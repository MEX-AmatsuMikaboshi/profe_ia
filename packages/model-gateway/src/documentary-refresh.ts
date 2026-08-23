import { z } from 'zod';

import {
  assertIdentityFixedOrWaived,
  waiverFor,
  type UnpinnedIdentityWaiver,
} from './capabilities.js';
import { ModelGatewayError } from './errors.js';

/**
 * Refresco documental de candidatos (T-H4-09 ← P-II §8.1, §13-H4).
 *
 * La norma pide reverificar «ids, endpoints, parámetros, deprecaciones y
 * políticas de datos **inmediatamente antes** del benchmark», con evidencia
 * fechada. Esta tarea estuvo `PENDIENTE` a propósito hasta ahora: adelantarla
 * produce evidencia caducada, que es peor que no tenerla porque parece válida.
 *
 * **Lo que este módulo no hace, y es lo que lo define:** no consulta a ningún
 * proveedor, no descarga documentación y no rellena un dato que nadie leyó.
 * Registrar es una cosa y averiguar es otra; un módulo que «consultara» la
 * documentación estaría produciendo la evidencia que dice verificar. Lo que
 * hace es exigir la forma de esa evidencia y **rechazar** la que no autoriza un
 * benchmark.
 *
 * Tampoco decide ganadores. El ganador sale de BENCH-01/02 (`T-H4-10/11`); esto
 * solo dice si un candidato está en condiciones de entrar a medirse.
 */

export const DOCUMENTARY_REFRESH_SCHEMA_VERSION = 'documentary-refresh-v1' as const;

export class DocumentaryRefreshError extends ModelGatewayError {}

const IsoDateTime = z.string().datetime({ offset: true });
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const NonEmpty = z.string().trim().min(1);

/**
 * De dónde salió el dato. Sin URL, fecha y hash de lo leído no hay evidencia:
 * hay una afirmación. El hash es lo que permite que un auditor compruebe que la
 * página que hoy se lee es la que entonces se leyó — o que ya no lo es.
 */
export const DocumentarySource = z
  .object({
    url: NonEmpty,
    retrievedAt: IsoDateTime,
    /** SHA-256 del documento tal cual se leyó. */
    contentSha256: Sha256Hex,
    title: NonEmpty.optional(),
  })
  .strict();
export type DocumentarySource = z.infer<typeof DocumentarySource>;

/**
 * §8.1 dice «región, logging, almacenamiento/retención y elegibilidad
 * contractual **cuando se conozcan**». Esa licencia cubre lo que el proveedor
 * no publica; **no** cubre no haber mirado.
 *
 * Por eso son tres estados y no dos. «No consultado» y «el proveedor no lo
 * publica» son hechos distintos: el primero es trabajo que falta y el segundo
 * es un límite del proveedor. Colapsarlos dejaría pasar un refresco a medias
 * como si fuera completo, que es justo lo que esta tarea existe para impedir.
 */
export const DocumentaryFact = z.discriminatedUnion('known', [
  z.object({ known: z.literal(true), value: NonEmpty }).strict(),
  z
    .object({
      known: z.literal(false),
      reason: z.enum(['no_publicado_por_el_proveedor', 'no_consultado']),
    })
    .strict(),
]);
export type DocumentaryFact = z.infer<typeof DocumentaryFact>;

/**
 * Política de datos **tal como se leyó** en el refresco (§8.1, sexto requisito).
 *
 * No es lo mismo que `ModelCapabilities.dataPolicy`, y la duplicación es
 * aparente: aquello es lo que el **binding declara** —con `loggingRetentionDays`
 * numérico y una elegibilidad de tres valores—, y esto es la **evidencia** de
 * qué decía la documentación, en prosa y con su fuente. Convertir «30 días de
 * retención salvo abuso» en un número es un juicio de quien escribe el binding,
 * no un mapeo automático: hacerlo aquí produciría cifras que ningún documento
 * dice. Por eso no hay conversor.
 */
export const CandidateDataPolicy = z
  .object({
    region: DocumentaryFact,
    logging: DocumentaryFact,
    retention: DocumentaryFact,
    contractualEligibility: DocumentaryFact,
  })
  .strict();
export type CandidateDataPolicy = z.infer<typeof CandidateDataPolicy>;

/**
 * Estado de deprecación observado en el refresco.
 *
 * Un candidato deprecado **bloquea**, no avisa. §8.1 lo dice con un caso
 * concreto: el identificador `gpt-4o-mini-tts` «aparece deprecado en el
 * catálogo referido por la investigación de cierre y **no se congela
 * automáticamente** como candidato futuro». Medir un modelo que el proveedor
 * está retirando gasta presupuesto en un ganador que no se podrá usar.
 */
export const CandidateDeprecation = z.discriminatedUnion('deprecated', [
  z.object({ deprecated: z.literal(false) }).strict(),
  z
    .object({
      deprecated: z.literal(true),
      notice: NonEmpty,
      replacement: NonEmpty.optional(),
    })
    .strict(),
]);
export type CandidateDeprecation = z.infer<typeof CandidateDeprecation>;

/** Los requisitos de §8.1 por candidato, en un solo registro fechado. */
export const CandidateRefresh = z
  .object({
    candidateId: NonEmpty,
    provider: NonEmpty,
    profile: z.enum(['SESION', 'AUTORIA']),
    modelId: NonEmpty,
    endpoint: NonEmpty,
    snapshot: NonEmpty.optional(),
    aliasResolvedAt: IsoDateTime.optional(),
    behaviorFingerprint: Sha256Hex.optional(),
    supportedParameters: z.array(NonEmpty),
    rejectedParameters: z.array(NonEmpty),
    /** Política de snapshot/alias/deprecación declarada por el proveedor. */
    snapshotAliasPolicy: NonEmpty,
    deprecation: CandidateDeprecation,
    dataPolicy: CandidateDataPolicy,
    sources: z.array(DocumentarySource).min(1),
    refreshedAt: IsoDateTime,
  })
  .strict()
  .superRefine((candidate, context) => {
    // No se puede haber leído la documentación **después** de registrar el
    // refresco: sería fechar la evidencia antes de tenerla.
    for (const [index, source] of candidate.sources.entries()) {
      if (Date.parse(source.retrievedAt) > Date.parse(candidate.refreshedAt)) {
        context.addIssue({
          code: 'custom',
          message: `la fuente ${index} se leyó después del refresco que dice sustentarla`,
          path: ['sources', index, 'retrievedAt'],
        });
      }
    }
    const rejected = new Set(candidate.rejectedParameters);
    const both = candidate.supportedParameters.filter((parameter) => rejected.has(parameter));
    if (both.length > 0) {
      context.addIssue({
        code: 'custom',
        message: `${both.join(', ')} figura como soportado y rechazado a la vez`,
        path: ['supportedParameters'],
      });
    }
  });
export type CandidateRefresh = z.infer<typeof CandidateRefresh>;

export const DocumentaryRefreshRecord = z
  .object({
    schemaVersion: z.literal(DOCUMENTARY_REFRESH_SCHEMA_VERSION),
    refreshId: NonEmpty,
    /**
     * Igual que el catálogo de guion y el criterio de fundamentos: un
     * `test_fixture` prueba el mecanismo y **no** habilita una corrida.
     */
    purpose: z.enum(['material', 'test_fixture']),
    refreshedAt: IsoDateTime,
    candidates: z.array(CandidateRefresh).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    const seen = new Set<string>();
    for (const [index, candidate] of record.candidates.entries()) {
      if (seen.has(candidate.candidateId)) {
        context.addIssue({
          code: 'custom',
          message: `candidato duplicado ${candidate.candidateId}`,
          path: ['candidates', index, 'candidateId'],
        });
      }
      seen.add(candidate.candidateId);
      if (Date.parse(candidate.refreshedAt) > Date.parse(record.refreshedAt)) {
        context.addIssue({
          code: 'custom',
          message: `el candidato ${candidate.candidateId} se refrescó después del registro`,
          path: ['candidates', index, 'refreshedAt'],
        });
      }
    }
  });
export type DocumentaryRefreshRecord = z.infer<typeof DocumentaryRefreshRecord>;

/**
 * Cuánto puede envejecer el refresco antes del benchmark.
 *
 * **Ninguna autoridad da una cifra.** «Inmediatamente antes» no es un número, y
 * cablear «24 horas» convertiría una decisión de protocolo en una constante que
 * nadie firmó. Entra como dato con procedencia y `purpose`, igual que el
 * criterio de suficiencia de `foundation_phase` (T-H6-12): una corrida material
 * exige un parámetro `material`, y un `test_fixture` no la habilita.
 */
export const RefreshWindowParameter = z
  .object({
    parameterId: NonEmpty,
    maxAgeSeconds: z.number().int().positive(),
    purpose: z.enum(['material', 'test_fixture']),
    /** Quién fijó la ventana y dónde consta. */
    provenance: NonEmpty,
  })
  .strict();
export type RefreshWindowParameter = z.infer<typeof RefreshWindowParameter>;

export interface BenchmarkRun {
  readonly runId: string;
  readonly startedAt: string;
  /** Candidatos que la corrida va a medir. */
  readonly candidateIds: readonly string[];
  readonly purpose: 'material' | 'test_fixture';
  /**
   * Renuncias a la identidad fijada, por candidato (T-H4-02).
   *
   * **Una corrida material las rechaza todas**, y esa es la propiedad que
   * importa: la renuncia sirve para medir a un candidato que el proveedor no
   * fija, no para colarlo en el benchmark que elige ganador. Las dos puertas
   * —esta y la de la pasarela— se cierran por su cuenta, así que abrir una no
   * abre la otra.
   */
  readonly unpinnedIdentityWaivers?: readonly UnpinnedIdentityWaiver[];
}

export interface RefreshAuthorization {
  readonly refreshId: string;
  readonly runId: string;
  /** Antigüedad observada por candidato, para que el auditor la juzgue. */
  readonly ageSecondsByCandidate: Readonly<Record<string, number>>;
  readonly windowParameterId: string;
}

function fail(detail: string): never {
  throw new DocumentaryRefreshError(detail);
}

/** Campos de política de datos que un refresco material debe haber consultado. */
const DATA_POLICY_FIELDS = ['region', 'logging', 'retention', 'contractualEligibility'] as const;

/**
 * ¿Autoriza este refresco a lanzar el benchmark?
 *
 * Devuelve la autorización con las antigüedades observadas, o **lanza**. No hay
 * rama que devuelva «autorizado con reservas»: un benchmark ejecutado sobre
 * evidencia caducada produce un ganador que no se puede defender, y el gasto ya
 * está hecho cuando alguien lo nota.
 */
export function assertRefreshAuthorizesBenchmark(
  recordValue: unknown,
  windowValue: unknown,
  run: BenchmarkRun,
): RefreshAuthorization {
  const parsedRecord = DocumentaryRefreshRecord.safeParse(recordValue);
  if (!parsedRecord.success) {
    fail(`Registro de refresco inválido: ${parsedRecord.error.message}`);
  }
  const parsedWindow = RefreshWindowParameter.safeParse(windowValue);
  if (!parsedWindow.success) {
    fail(`Ventana de refresco inválida: ${parsedWindow.error.message}`);
  }
  const record = parsedRecord.data;
  const refreshWindow = parsedWindow.data;

  // **La puerta que hace inofensiva la renuncia.** Va antes que nada porque una
  // corrida material no admite un candidato cuya identidad nadie fija: el
  // ganador tiene que poder rehacerse, y un id que puede cambiar de modelo por
  // debajo lo impide. Medir a ese candidato es legítimo; coronarlo, no.
  if (run.purpose === 'material' && (run.unpinnedIdentityWaivers ?? []).length > 0) {
    fail(
      `La corrida ${run.runId} es material y trae ${String(
        (run.unpinnedIdentityWaivers ?? []).length,
      )} renuncia(s) a la identidad fijada ` +
        `(${(run.unpinnedIdentityWaivers ?? []).map((w) => w.subject).join(', ')}). Una renuncia ` +
        `autoriza a **medir** un candidato que el proveedor no fija, nunca a coronarlo: un ` +
        `ganador atado a un id que puede cambiar de modelo sin aviso no se puede rehacer (§8.1).`,
    );
  }

  if (run.purpose === 'material') {
    if (record.purpose !== 'material') {
      fail(
        `La corrida ${run.runId} es material y el refresco ${record.refreshId} es ` +
          `'${record.purpose}'. Un fixture prueba el mecanismo; no reverifica nada.`,
      );
    }
    if (refreshWindow.purpose !== 'material') {
      fail(
        `La ventana ${refreshWindow.parameterId} es '${refreshWindow.purpose}'. Una corrida ` +
          `material exige una ventana material: un umbral de prueba no es la puerta del benchmark.`,
      );
    }
  }

  const runStartedAt = Date.parse(run.startedAt);
  if (Number.isNaN(runStartedAt)) fail(`La corrida ${run.runId} no declara un inicio legible.`);

  const byId = new Map(record.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const ageSecondsByCandidate: Record<string, number> = {};

  for (const candidateId of run.candidateIds) {
    const candidate = byId.get(candidateId);
    if (candidate === undefined) {
      fail(
        `La corrida ${run.runId} va a medir ${candidateId}, que no aparece en el refresco ` +
          `${record.refreshId}. Medir un candidato sin reverificar es lo que §8.1 prohíbe.`,
      );
    }

    if (candidate.deprecation.deprecated) {
      fail(
        `${candidateId} figura deprecado en el refresco («${candidate.deprecation.notice}»). ` +
          `Un candidato deprecado no entra al benchmark: §8.1 no lo congela automáticamente como ` +
          `candidato futuro, y medirlo gastaría presupuesto en un ganador inutilizable.`,
      );
    }

    // Alias sin snapshot exige huella (§8.1, T-H4-02). Se llama a la regla
    // compartida en vez de fabricar aquí un `ModelBinding`: hacerlo obligaría a
    // inventarle capacidades que el refresco no afirma, y un dato inventado en
    // la evidencia de reverificación es peor que no tenerla.
    assertIdentityFixedOrWaived(
      candidateId,
      `El candidato ${candidateId}`,
      candidate,
      waiverFor(candidateId, run.unpinnedIdentityWaivers),
    );

    if (run.purpose === 'material') {
      const noConsultado = DATA_POLICY_FIELDS.filter((field) => {
        const fact = candidate.dataPolicy[field];
        return !fact.known && fact.reason === 'no_consultado';
      });
      if (noConsultado.length > 0) {
        fail(
          `${candidateId} deja sin consultar ${noConsultado.join(', ')}. §8.1 admite no conocer ` +
            `lo que el proveedor no publica, no admite no haber mirado: son hechos distintos y ` +
            `el registro los distingue justo para que este control pueda verlos.`,
        );
      }
    }

    const refreshedAt = Date.parse(candidate.refreshedAt);
    if (refreshedAt > runStartedAt) {
      fail(
        `${candidateId} se refrescó después de arrancar la corrida. La reverificación va ` +
          `**antes** del benchmark; al revés no verifica lo que se midió.`,
      );
    }

    const ageSeconds = Math.floor((runStartedAt - refreshedAt) / 1000);
    if (ageSeconds > refreshWindow.maxAgeSeconds) {
      fail(
        `El refresco de ${candidateId} tiene ${ageSeconds} s y la ventana ` +
          `${refreshWindow.parameterId} admite ${refreshWindow.maxAgeSeconds} s. La evidencia ` +
          `está caducada: refresca otra vez en vez de ampliar la ventana para que quepa.`,
      );
    }
    ageSecondsByCandidate[candidateId] = ageSeconds;
  }

  return {
    refreshId: record.refreshId,
    runId: run.runId,
    ageSecondsByCandidate,
    windowParameterId: refreshWindow.parameterId,
  };
}

/**
 * Deriva el `verifiedAt` del binding desde el refresco.
 *
 * `ModelBinding.verifiedAt` **es** la evidencia fechada que §8.1 exige, así que
 * se toma del refresco en vez de escribirse a mano: un binding que declarara
 * una fecha que ningún refresco respalda afirmaría una reverificación que nadie
 * hizo.
 */
export function verifiedAtFromRefresh(recordValue: unknown, candidateId: string): string {
  const record = DocumentaryRefreshRecord.parse(recordValue);
  const candidate = record.candidates.find((entry) => entry.candidateId === candidateId);
  if (candidate === undefined) {
    fail(`El refresco ${record.refreshId} no cubre al candidato ${candidateId}.`);
  }
  return candidate.refreshedAt;
}
