import { IncompleteLicenseRecordError } from './errors.js';

/**
 * Licencias conservadoras (T-H45-05 ← P-I §7.0, `DEC-LICENSE-CONSERVATIVE-001`).
 *
 * El punto fino de toda la regla es el **caso Calgary**: la misma obra es a la
 * vez utilizable y bloqueada según para qué. El snapshot vale como *fuente
 * documental del cálculo*; su material «used with permission» **no** vale como
 * base expresiva. Por eso la clasificación no devuelve un booleano por recurso
 * sino un veredicto **por uso previsto**: un solo «¿se puede usar?» obligaría a
 * elegir una de las dos respuestas y las dos son ciertas.
 */

/** Los dos usos que el Maestro distingue explícitamente. */
export const LICENSE_USES = ['fuente_documental', 'base_expresiva'] as const;
export type LicenseUse = (typeof LICENSE_USES)[number];

export const LICENSE_STATUSES = ['autorizado', 'excluido', 'LICENSE_UNRESOLVED'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

/**
 * Términos como **rasgos**, no como catálogo cerrado de licencias: el Maestro
 * razona por rasgos (NC, SA, ND, permiso de terceros) y enumerar identificadores
 * dejaría fuera cualquier combinación que no hubiéramos previsto.
 */
export interface LicenseTerms {
  /** Identificador exacto, registrado literalmente tal como aparece. */
  readonly licenseId: string;
  readonly nonCommercial: boolean;
  readonly shareAlike: boolean;
  readonly noDerivatives: boolean;
  /** La procedencia concreta depende solo de un «used with permission». */
  readonly thirdPartyPermissionOnly: boolean;
}

/** Los cuatro campos mínimos de §7.0 para todo recurso reutilizable. */
export interface LicenseRecord {
  readonly sourceComponent: string;
  readonly sourceVersion: string;
  readonly provenanceBasis: string;
  readonly licenseEvidence: string;
  readonly terms: LicenseTerms;
}

export interface LicenseQuery {
  readonly intendedUse: LicenseUse;
  /**
   * Solo para NC/SA: el uso previsto es compatible. Declaración explícita y
   * **sin valor por omisión**, porque el Maestro dice «únicamente cuando el uso
   * previsto sea compatible» y suponer compatibilidad convertiría la excepción
   * en la regla.
   */
  readonly intendedUseCompatible?: boolean;
  /** Evidencia de revisión jurídica, única vía para ND como base expresiva. */
  readonly legalReviewEvidence?: string;
}

export interface LicenseVerdict {
  readonly status: LicenseStatus;
  /** Si el uso **previsto** queda bloqueado. Un `LICENSE_UNRESOLVED` puede no bloquear. */
  readonly blocked: boolean;
  readonly reason: string;
}

/** CC0 / CC BY: lo que §7.0 pide preferir. */
export function isPreferredLicense(terms: LicenseTerms): boolean {
  return (
    !terms.nonCommercial &&
    !terms.shareAlike &&
    !terms.noDerivatives &&
    !terms.thirdPartyPermissionOnly
  );
}

/** Un registro incompleto no se clasifica: se rechaza. */
export function assertCompleteRecord(record: LicenseRecord): void {
  const faltan = (
    ['sourceComponent', 'sourceVersion', 'provenanceBasis', 'licenseEvidence'] as const
  ).filter((campo) => (record[campo] ?? '').trim() === '');

  if (faltan.length > 0) {
    throw new IncompleteLicenseRecordError(
      `Al recurso le faltan ${faltan.join(', ')}. §7.0 exige los cuatro para todo recurso ` +
        `reutilizable; sin ellos no hay cadena de atribución que comprobar y clasificarlo sería ` +
        `afirmar un derecho que nadie registró.`,
    );
  }
}

/**
 * Clasifica un recurso **para un uso concreto**.
 *
 * El orden importa: el permiso de terceros se mira primero porque es el que
 * produce `LICENSE_UNRESOLVED`, que no es «excluido» sino «no resuelto», y
 * confundirlos borraría la diferencia entre lo que está prohibido y lo que
 * espera a que alguien resuelva la proveniencia.
 */
export function classifyLicense(record: LicenseRecord, query: LicenseQuery): LicenseVerdict {
  assertCompleteRecord(record);
  const { terms } = record;

  if (terms.thirdPartyPermissionOnly) {
    // Caso Calgary literal: la licencia global no permite presumir la cadena de
    // derechos de cada componente, pero el snapshot sigue sirviendo para definir
    // el sistema formal. LIC-01/LIC-02 bloquean la reutilización expresiva, no
    // el uso documental.
    return query.intendedUse === 'fuente_documental'
      ? {
          status: 'LICENSE_UNRESOLVED',
          blocked: false,
          reason:
            `Proveniencia no resuelta («used with permission»), pero el uso documental del ` +
            `cálculo no está bloqueado: LIC-01/LIC-02 bloquean reutilizar material expresivo.`,
        }
      : {
          status: 'LICENSE_UNRESOLVED',
          blocked: true,
          reason:
            `Proveniencia no resuelta («used with permission»): no se incorpora como base ` +
            `expresiva hasta resolverla y, cuando corresponda, revisión jurídica profesional.`,
        };
  }

  if (query.intendedUse === 'fuente_documental') {
    return {
      status: 'autorizado',
      blocked: false,
      reason: `Uso documental con licencia ${terms.licenseId} y proveniencia registrada.`,
    };
  }

  if (terms.noDerivatives && (query.legalReviewEvidence ?? '').trim() === '') {
    return {
      status: 'excluido',
      blocked: true,
      reason:
        `ND no se usa como base expresiva para adaptaciones sin revisión jurídica (§7.0).`,
    };
  }

  if ((terms.nonCommercial || terms.shareAlike) && query.intendedUseCompatible !== true) {
    return {
      status: 'excluido',
      blocked: true,
      reason:
        `NC/SA solo cuando el uso previsto sea compatible, y aquí no se declaró compatible. ` +
        `NC/SA no se convierten en base expresiva predeterminada de un producto potencialmente ` +
        `comercial.`,
    };
  }

  return {
    status: 'autorizado',
    blocked: false,
    reason: isPreferredLicense(terms)
      ? `Licencia preferida (${terms.licenseId}) con proveniencia registrada.`
      : `Licencia ${terms.licenseId} con compatibilidad de uso declarada.`,
  };
}

export interface ComponentVerdict {
  readonly sourceComponent: string;
  readonly verdict: LicenseVerdict;
}

/**
 * Clasifica un inventario. «Toda duda jurídica bloquea **únicamente** la
 * sección/componente afectado hasta revisión»: por eso el resultado es por
 * componente y un bloqueo no arrastra a sus hermanos.
 */
export function classifyInventory(
  records: readonly LicenseRecord[],
  query: LicenseQuery,
): readonly ComponentVerdict[] {
  return Object.freeze(
    records.map((record) => ({
      sourceComponent: record.sourceComponent,
      verdict: classifyLicense(record, query),
    })),
  );
}
