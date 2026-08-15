import { describe, expect, it } from 'vitest';
import {
  classifyInventory,
  classifyLicense,
  IncompleteLicenseRecordError,
  isPreferredLicense,
  LICENSE_STATUSES,
  LICENSE_USES,
  type LicenseRecord,
  type LicenseTerms,
} from '../src/index.js';

function terms(overrides: Partial<LicenseTerms> = {}): LicenseTerms {
  return {
    licenseId: 'CC-BY-4.0',
    nonCommercial: false,
    shareAlike: false,
    noDerivatives: false,
    thirdPartyPermissionOnly: false,
    ...overrides,
  };
}

function record(overrides: Partial<LicenseRecord> = {}): LicenseRecord {
  return {
    sourceComponent: 'cap-3-seccion-2',
    sourceVersion: 'Fall 2025',
    provenanceBasis: 'licencia global de la obra, verificada por sección',
    licenseEvidence: 'pagina de creditos, snapshot 2026-07-18',
    terms: terms(),
    ...overrides,
  };
}

describe('registro mínimo por recurso (T-H45-05 ← P-I §7.0)', () => {
  it('exige los cuatro campos', () => {
    for (const campo of [
      'sourceComponent',
      'sourceVersion',
      'provenanceBasis',
      'licenseEvidence',
    ] as const) {
      expect(() =>
        classifyLicense(record({ [campo]: '' } as Partial<LicenseRecord>), {
          intendedUse: 'base_expresiva',
        }),
      ).toThrow(IncompleteLicenseRecordError);
    }
  });

  it('los usos y estados son los del Maestro', () => {
    expect(LICENSE_USES).toEqual(['fuente_documental', 'base_expresiva']);
    expect(LICENSE_STATUSES).toEqual(['autorizado', 'excluido', 'LICENSE_UNRESOLVED']);
  });

  it('CC0/CC BY son las preferidas', () => {
    expect(isPreferredLicense(terms({ licenseId: 'CC0-1.0' }))).toBe(true);
    expect(isPreferredLicense(terms())).toBe(true);
    expect(isPreferredLicense(terms({ nonCommercial: true }))).toBe(false);
    expect(isPreferredLicense(terms({ noDerivatives: true }))).toBe(false);
  });
});

describe('caso Calgary: la misma obra sirve para una cosa y no para otra', () => {
  const calgary = record({
    sourceComponent: 'ejercicio-de-tercero',
    terms: terms({ licenseId: 'CC-BY-4.0', thirdPartyPermissionOnly: true }),
  });

  it('como fuente documental del cálculo NO está bloqueada', () => {
    const v = classifyLicense(calgary, { intendedUse: 'fuente_documental' });

    expect(v.status).toBe('LICENSE_UNRESOLVED');
    expect(v.blocked).toBe(false);
  });

  it('como base expresiva SÍ está bloqueada', () => {
    const v = classifyLicense(calgary, { intendedUse: 'base_expresiva' });

    expect(v.status).toBe('LICENSE_UNRESOLVED');
    expect(v.blocked).toBe(true);
  });

  it('`LICENSE_UNRESOLVED` no es lo mismo que `excluido`', () => {
    // No resuelto espera a que alguien resuelva la proveniencia; excluido está
    // decidido. Confundirlos borraría esa diferencia.
    const noResuelto = classifyLicense(calgary, { intendedUse: 'base_expresiva' });
    const excluido = classifyLicense(
      record({ terms: terms({ licenseId: 'CC-BY-ND-4.0', noDerivatives: true }) }),
      { intendedUse: 'base_expresiva' },
    );

    expect(noResuelto.status).toBe('LICENSE_UNRESOLVED');
    expect(excluido.status).toBe('excluido');
  });

  it('ni la revisión jurídica ni la compatibilidad saltan el permiso de terceros', () => {
    const v = classifyLicense(calgary, {
      intendedUse: 'base_expresiva',
      intendedUseCompatible: true,
      legalReviewEvidence: 'dictamen-2026-08',
    });

    expect(v.blocked).toBe(true);
    expect(v.status).toBe('LICENSE_UNRESOLVED');
  });
});

describe('ND, NC y SA como base expresiva', () => {
  it('ND sin revisión jurídica queda excluido', () => {
    const v = classifyLicense(record({ terms: terms({ noDerivatives: true }) }), {
      intendedUse: 'base_expresiva',
    });

    expect(v).toMatchObject({ status: 'excluido', blocked: true });
  });

  it('ND con revisión jurídica registrada pasa', () => {
    const v = classifyLicense(record({ terms: terms({ noDerivatives: true }) }), {
      intendedUse: 'base_expresiva',
      legalReviewEvidence: 'dictamen-2026-08',
    });

    expect(v.status).toBe('autorizado');
  });

  it('NC/SA sin declarar compatibilidad quedan excluidos: no hay compatibilidad por omisión', () => {
    for (const rasgo of [{ nonCommercial: true }, { shareAlike: true }]) {
      const v = classifyLicense(record({ terms: terms(rasgo) }), {
        intendedUse: 'base_expresiva',
      });
      expect(v).toMatchObject({ status: 'excluido', blocked: true });
    }
  });

  it('NC/SA con compatibilidad declarada pasan', () => {
    const v = classifyLicense(record({ terms: terms({ nonCommercial: true }) }), {
      intendedUse: 'base_expresiva',
      intendedUseCompatible: true,
    });

    expect(v.status).toBe('autorizado');
  });

  it('`intendedUseCompatible: false` no habilita', () => {
    const v = classifyLicense(record({ terms: terms({ shareAlike: true }) }), {
      intendedUse: 'base_expresiva',
      intendedUseCompatible: false,
    });

    expect(v.blocked).toBe(true);
  });
});

describe('el bloqueo es por componente, no por obra', () => {
  it('un componente dudoso no arrastra a sus hermanos', () => {
    const inventario = classifyInventory(
      [
        record({ sourceComponent: 'seccion-limpia' }),
        record({
          sourceComponent: 'seccion-dudosa',
          terms: terms({ thirdPartyPermissionOnly: true }),
        }),
        record({ sourceComponent: 'otra-seccion-limpia' }),
      ],
      { intendedUse: 'base_expresiva' },
    );

    expect(inventario.map((c) => [c.sourceComponent, c.verdict.blocked])).toEqual([
      ['seccion-limpia', false],
      ['seccion-dudosa', true],
      ['otra-seccion-limpia', false],
    ]);
  });
});
