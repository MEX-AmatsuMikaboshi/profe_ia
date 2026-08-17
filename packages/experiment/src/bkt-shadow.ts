/**
 * DEC-BKT-001 / CAL-11. BKT es opcional en Etapa 1. Como CAL-11 no se ha
 * ejecutado sobre evidencia autorizada, H5 congela la única decisión honesta:
 * deshabilitado, sin parámetros y sin superficie de lectura para la sesión.
 */

export const BKT_SHADOW_DISABLED_REASON = 'CAL_11_NOT_EXECUTED' as const;

export interface DisabledBktShadowConfiguration {
  readonly version: 'bkt-shadow-disabled-h5-v1';
  readonly enabled: false;
  readonly reasonCode: typeof BKT_SHADOW_DISABLED_REASON;
  readonly parameters: null;
  readonly authority: 'none';
  readonly visibility: 'analysis_only';
  readonly affectsAdvance: false;
  readonly affectsMastery: false;
  readonly affectsRecovery: false;
  readonly affectsClosure: false;
}

export const BKT_SHADOW_H5_CONFIGURATION: DisabledBktShadowConfiguration = Object.freeze({
  version: 'bkt-shadow-disabled-h5-v1',
  enabled: false,
  reasonCode: BKT_SHADOW_DISABLED_REASON,
  parameters: null,
  authority: 'none',
  visibility: 'analysis_only',
  affectsAdvance: false,
  affectsMastery: false,
  affectsRecovery: false,
  affectsClosure: false,
});

export class BktCalibrationRequiredError extends Error {
  readonly parameterId = 'CAL-11' as const;
}

/**
 * Validador de la sección de freeze. Habilitar BKT requiere incorporar una
 * calibración CAL-11 nueva; este código no acepta parámetros ad hoc aunque
 * lleven una etiqueta que diga «calibrados».
 */
export function assertBktShadowH5Configuration(
  value: unknown,
): DisabledBktShadowConfiguration {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BktCalibrationRequiredError('Configuración BKT ausente o inválida; CAL-11 no ejecutado.');
  }
  const record = value as Record<string, unknown>;
  if (record.enabled === true) {
    throw new BktCalibrationRequiredError(
      'BKT no puede habilitarse antes de ejecutar y congelar CAL-11.',
    );
  }
  const expected = BKT_SHADOW_H5_CONFIGURATION as unknown as Record<string, unknown>;
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(record).sort();
  if (
    expectedKeys.length !== actualKeys.length ||
    expectedKeys.some((key, index) => key !== actualKeys[index]) ||
    expectedKeys.some((key) => record[key] !== expected[key])
  ) {
    throw new BktCalibrationRequiredError(
      'La única configuración H5 autorizada es BKT deshabilitado por CAL-11 no ejecutado.',
    );
  }
  return BKT_SHADOW_H5_CONFIGURATION;
}
