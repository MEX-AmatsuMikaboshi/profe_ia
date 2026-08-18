import type {
  CandidateRefresh,
  DocumentaryRefreshRecord,
  RefreshWindowParameter,
} from '@profesor-ia/model-gateway';

/**
 * Refresco documental material del 2026-08-18 (T-H4-09 ← P-II §8.1).
 *
 * **Esto es evidencia, no código que averigua.** Cada dato de aquí lo leyó una
 * persona en la página citada; el módulo `documentary-refresh.ts` sólo exige la
 * forma y rechaza lo que no autoriza un benchmark. Un módulo que fuera a buscar
 * estos datos estaría produciendo la evidencia que dice verificar.
 *
 * Los `contentSha256` son el hash **de los bytes** que devolvió cada URL, no de
 * un resumen: un hash de la lectura de alguien no permite comprobar después que
 * la página decía lo que se afirma que decía.
 *
 * ## Lo que se consultó y lo que el proveedor no publica
 *
 * `region` y `contractualEligibility` quedan como `no_publicado_por_el_proveedor`
 * porque las páginas públicas no las fijan para una cuenta concreta: la región
 * de inferencia depende de parámetros de la petición y de la modalidad de
 * despliegue, y la elegibilidad contractual vive en un contrato, no en la
 * documentación. **No quedan como `no_consultado`**, que es la marca de trabajo
 * pendiente: se consultaron y no están publicadas.
 */

const REFRESHED_AT = '2026-08-18T07:39:00.000Z';

/**
 * Ventana de frescura fijada por el propietario. **24 horas**, decidida el
 * 2026-08-18 tras plantearle que ninguna autoridad da una cifra y que la
 * elección es de protocolo. Es lo más cercano a «inmediatamente antes» que
 * resulta practicable: obliga a refrescar el mismo día de la corrida.
 */
export const REFRESH_WINDOW_24H: RefreshWindowParameter = {
  parameterId: 'refresh-window-h4-24h',
  maxAgeSeconds: 86_400,
  purpose: 'material',
  provenance:
    'Decisión del propietario, 2026-08-18: ventana de 24 h para el refresco documental previo ' +
    'a BENCH-01. Ver docs/model/documentary-refresh.md y docs/plan/HANDOFF.md §3.0.b.',
};

const ANTHROPIC_HAIKU: CandidateRefresh = {
  candidateId: 'claude-haiku-4-5-20251001',
  provider: 'anthropic',
  profile: 'SESION',
  modelId: 'claude-haiku-4-5-20251001',
  endpoint: 'https://api.anthropic.com/v1/messages',
  // Id fechado: es snapshot fijado, no un alias que pueda cambiar por debajo.
  snapshot: 'claude-haiku-4-5-20251001',
  supportedParameters: ['max_tokens'],
  // `temperature`, `top_p` y `top_k` están deprecados desde Claude Opus 4.7 y
  // devuelven 400 con valor no por omisión. No se envían.
  rejectedParameters: ['temperature', 'top_p', 'top_k'],
  snapshotAliasPolicy:
    'Todo id de modelo de Claude es un snapshot fijado. Los ids con fecha (20251001) quedan ' +
    'atados a esa versión; el alias `claude-haiku-4-5` es un puntero de conveniencia que ' +
    'resuelve al id fechado. Aquí se usa el fechado, así que no hay alias que resolver.',
  deprecation: { deprecated: false },
  dataPolicy: {
    region: { known: false, reason: 'no_publicado_por_el_proveedor' },
    logging: {
      known: true,
      value:
        '«By default, we will not use your inputs or outputs from our commercial products ' +
        '(e.g. Claude for Work, Anthropic API, Claude Gov, etc.) to train our models.» El ' +
        'entrenamiento sólo ocurre si se reporta feedback explícitamente.',
    },
    retention: {
      known: true,
      value:
        'Sin retención para entrenamiento por omisión. Si se envía feedback explícito, se ' +
        'almacena la conversación completa «for up to 5 years».',
    },
    contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
  },
  sources: [
    {
      url: 'https://platform.claude.com/docs/en/about-claude/models/overview',
      retrievedAt: REFRESHED_AT,
      contentSha256: '675d0db1126a9805c8615cac9b4906174fa7276f5206c67e89dac2af8c904061',
    },
    {
      url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations',
      retrievedAt: REFRESHED_AT,
      contentSha256: '3a61d0e65d80efd4d1e138a7622e7ea97fca1063b1286b35a096c9a000a1d113',
    },
    {
      url: 'https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training',
      retrievedAt: REFRESHED_AT,
      contentSha256: 'd1235e1a6ec5a55b3214b7d594cda0141e166eeb0aaf0221a700fe6e08a604f3',
    },
  ],
  refreshedAt: REFRESHED_AT,
};

const OPENAI_LUNA: CandidateRefresh = {
  candidateId: 'gpt-5.6-luna',
  provider: 'openai',
  profile: 'SESION',
  modelId: 'gpt-5.6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  // Sin snapshot fechado publicado. Sin él, P-II §8.1 exige huella de
  // comportamiento sobre el set canario; la corrida piloto no la produce, así
  // que este candidato **no puede sostener una corrida material** hasta tenerla.
  supportedParameters: ['max_output_tokens'],
  rejectedParameters: [],
  snapshotAliasPolicy:
    'La documentación de OpenAI no publica un id de snapshot fechado para gpt-5.6-luna: el id ' +
    'del modelo es el único identificador disponible. Al no haber snapshot, §8.1 exige huella ' +
    'de comportamiento antes de una corrida material.',
  deprecation: { deprecated: false },
  dataPolicy: {
    region: { known: false, reason: 'no_publicado_por_el_proveedor' },
    logging: {
      known: true,
      value:
        '«data sent to the OpenAI API is not used to train or improve OpenAI models (unless ' +
        'you explicitly opt in to share data with us)», vigente desde el 1 de marzo de 2023.',
    },
    retention: {
      known: true,
      value:
        'Registros de monitoreo de abuso «retained for up to 30 days, unless longer retention ' +
        'is required by law». Existe Zero Data Retention para clientes elegibles, previa ' +
        'aprobación.',
    },
    contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
  },
  sources: [
    {
      url: 'https://developers.openai.com/api/docs/models',
      retrievedAt: REFRESHED_AT,
      contentSha256: 'a39f26b84c7d05e5a7213b86c5965497d6f3c2afc3d8250d9cdbcf44d72e82ef',
    },
    {
      url: 'https://developers.openai.com/api/docs/guides/your-data',
      retrievedAt: REFRESHED_AT,
      contentSha256: '7a48f25cb4968b7bd10043eb921b244009f8d52333b205484e4ece321edc6b82',
    },
    {
      url: 'https://developers.openai.com/api/docs/pricing',
      retrievedAt: REFRESHED_AT,
      contentSha256: '761546c7bde0df971717f863256794ea9aa61c1539d010acec68632da1a2ee51',
    },
  ],
  refreshedAt: REFRESHED_AT,
};

export const REFRESH_2026_08_18: DocumentaryRefreshRecord = {
  schemaVersion: 'documentary-refresh-v1',
  refreshId: 'refresh-2026-08-18-bench01',
  purpose: 'material',
  refreshedAt: REFRESHED_AT,
  candidates: [ANTHROPIC_HAIKU, OPENAI_LUNA],
};

/**
 * Hallazgo del refresco que **no** bloquea el piloto pero sí condiciona la
 * corrida material: `claude-haiku-4-5-20251001` está `Active`, pero su fecha
 * tentativa de retiro es **15 de octubre de 2026**, la más cercana de todos los
 * modelos vigentes de Anthropic. Coronarlo ganador de BENCH-01 dejaría el
 * sistema atado a un modelo que se apaga en dos meses. Es exactamente el tipo
 * de cosa que §8.1 manda mirar antes de gastar en medirlo.
 */
export const HALLAZGOS_2026_08_18 = [
  'claude-haiku-4-5-20251001: Active, retiro tentativo no antes del 2026-10-15 — la fecha más ' +
    'próxima entre los modelos vigentes de Anthropic.',
  'gpt-5.6-luna: **bloqueante y comprobado**. No publica snapshot fechado ni alias fechado, ' +
    'así que §8.1 exige huella de comportamiento sobre el set canario congelado. ' +
    '`assertRefreshAuthorizesBenchmark` lo rechaza con `UnpinnedBindingError` incluso en una ' +
    'corrida piloto. Queda fuera hasta producir la huella: inventarla sería fabricar la ' +
    'evidencia que la regla pide.',
  'Anthropic deprecó temperature/top_p/top_k desde Opus 4.7: devuelven 400 con valor no por ' +
    'omisión. No se envían.',
] as const;
