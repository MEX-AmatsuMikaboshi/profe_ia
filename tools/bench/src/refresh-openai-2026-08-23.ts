import type {
  CandidateRefresh,
  DocumentaryRefreshRecord,
  UnpinnedIdentityWaiver,
} from '@profesor-ia/model-gateway';
import { UNPINNED_CONSEQUENCE } from '@profesor-ia/model-gateway';

/**
 * Refresco documental de OpenAI del 2026-08-23, **para medición exploratoria**
 * (T-H4-09 ← P-II §8.1).
 *
 * ## Qué es y qué no es
 *
 * Es un refresco real: las cuatro fuentes se descargaron con
 * `scripts/model/refresh-sources.mjs`, que baja cada una **dos veces** y se
 * niega a emitir huella si difieren. Lo que **no** es: una autorización para
 * BENCH-01. Su `purpose` es `test_fixture` y no `material`, así que
 * `assertRefreshAuthorizesBenchmark()` lo rechaza para una corrida material por
 * su propio lado, además de rechazar la renuncia de identidad que lo acompaña.
 *
 * ## Por qué hace falta una renuncia, y qué se comprobó antes de escribirla
 *
 * §8.1 exige snapshot fechado o huella de comportamiento. `gpt-5.6-luna` no
 * tiene lo primero, y lo segundo no existe. Antes de dar eso por cerrado se
 * comprobó **la vía que lo habría resuelto sin renunciar a nada**: pedirle al
 * proveedor el modelo y leer qué id reporta. Muchos proveedores devuelven en la
 * respuesta el snapshot resuelto —`gpt-4o` devolviendo `gpt-4o-2024-08-06`—, y
 * ese id **sería** la evidencia de fijación que §8.1 quiere, emitida por el
 * proveedor mismo.
 *
 * **No la devuelve.** El 2026-08-23 se pidió `gpt-5.6-luna`, `gpt-5.6-sol` y
 * `gpt-5.6-terra` contra `/v1/responses` y el campo `model` de la respuesta trae
 * los tres ids **sin fecha, idénticos a los pedidos**. Así que la renuncia no es
 * comodidad: es lo único que queda después de haber preguntado.
 *
 * ## La pinza que deja fuera a OpenAI de BENCH-01, con sus dos mitades
 *
 * 1. **Los modelos vigentes no publican snapshot fechado** ni la documentación
 *    declara que un id sin fecha sea una versión fijada —a diferencia de la de
 *    Anthropic, que lo dice con todas las letras—.
 * 2. **Los ids de OpenAI que sí están fijados por fecha están deprecados**:
 *    `gpt-5-2025-08-07` y `o3-2025-04-16` tienen apagado anunciado para el
 *    2026-12-11, y §8.1 no admite un candidato deprecado.
 *
 * Por eso `deprecation` de `gpt-5.6-luna` va como **no deprecado** —lo cual es
 * cierto— y lo que falta se registra donde corresponde: en la renuncia.
 */

/** Momento de las descargas que sustentan este refresco. */
const REFRESHED_AT = '2026-08-23T22:47:23.796Z';

/** Momento en que se le preguntó al proveedor qué id resuelve. */
export const OPENAI_IDENTITY_PROBED_AT = '2026-08-23T22:45:00.000Z';

/**
 * Régimen de versiones **tal como el proveedor lo deja**, que es sin declararlo.
 *
 * Se redacta como ausencia y no como afirmación: decir «OpenAI no fija sus ids»
 * sería poner en su boca una negación que tampoco publica. Lo que consta es que
 * la documentación de modelos y la de deprecaciones **no dicen** si un id sin
 * fecha queda atado a un snapshot, y que la API devuelve el mismo id sin fecha.
 */
const POLITICA_SNAPSHOT_OPENAI =
  'La documentación de modelos lista el catálogo vigente con ids sin fecha (gpt-5.6-sol, ' +
  'gpt-5.6-terra, gpt-5.6-luna) y **no declara** si un id sin fecha queda atado a un snapshot ' +
  'fijado; la de deprecaciones habla de plazos de retiro, no de versionado. Los ids de OpenAI que ' +
  'sí llevan fecha —«gpt-5-2025-08-07», «o3-2025-04-16»— figuran con apagado anunciado para el ' +
  '2026-12-11, así que no sirven como candidato. Comprobado además contra la API el 2026-08-23: ' +
  'el campo `model` de la respuesta devuelve el mismo id sin fecha que se pidió, de modo que el ' +
  'proveedor tampoco emite el snapshot resuelto. Notificación comprometida: «at least 6 months» ' +
  'para modelos de disponibilidad general, y «much shorter notice, such as 2 weeks» para preview.';

/**
 * Política de datos, con lo conocido y lo no publicado separados.
 *
 * `contractualEligibility` va como **no conocida**: la elegibilidad contractual
 * de esta cuenta concreta —ZDR aprobado o no— no la publica ninguna página y es
 * `EXT-03`, del `SECURITY_PRIVACY_RESPONSIBLE`. Rellenarla con «se puede pedir»
 * confundiría la existencia del programa con estar dentro de él.
 */
const POLITICA_DE_DATOS = {
  region: {
    known: true,
    value:
      'Residencia de datos configurable por proyecto, con prefijo de dominio por región: Estados ' +
      'Unidos, Europa (EEE + Suiza), Australia, Canadá, Japón, India, Singapur, Corea del Sur, ' +
      'Reino Unido y Emiratos Árabes Unidos.',
  },
  logging: {
    known: true,
    value:
      '«As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI ' +
      'models (unless you explicitly opt in to share data with us).» Se generan registros de ' +
      'monitoreo de abuso para todo uso de la API.',
  },
  retention: {
    known: true,
    value:
      '«By default, abuse monitoring logs are generated for all API feature usage and retained ' +
      'for up to 30 days, unless longer retention is required by law.»',
  },
  contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
} as const;

/**
 * Fuentes con huella **reproducible**, obtenidas con
 * `node scripts/model/refresh-sources.mjs <urls>`.
 */
const FUENTES_OPENAI = [
  {
    url: 'https://developers.openai.com/api/docs/models.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: '07ec134689106583a9f98705e1e9eedd2c12a9af320a19a397b18b82ad8b44a6',
  },
  {
    url: 'https://developers.openai.com/api/docs/deprecations.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: '91292bb80f7eb37873c8ee83a02458effc0bf2e770a00ae1567da2faa7e5837a',
  },
  {
    url: 'https://developers.openai.com/api/docs/pricing.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: '1c54363f719988de1b4382035c9ad70422ad3ea6a99e77a094dd43e15a67169d',
  },
  {
    url: 'https://developers.openai.com/api/docs/guides/your-data.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: 'e8abb2995e37c881f3084506702d89af22582b739edd88ef39d6d452a8c4aa91',
  },
] as const;

/**
 * `gpt-5.6-luna` y no otro, y el motivo es de tarifa: es el único de OpenAI con
 * precio en `PRICING_MANIFEST_2026_08_18` junto a un `gpt-5` ya deprecado.
 * Medir con un modelo sin tarifa haría lanzar a `priceCall()` a mitad de la
 * corrida, con la llamada ya cobrada y sin poder tarifarla.
 *
 * `max_output_tokens` es el nombre del parámetro en la API de respuestas, no
 * `max_tokens`: son proveedores distintos y por eso hay dos adaptadores.
 * `temperature` y `top_p` van como **no declarados** —ni soportados ni
 * rechazados—, que es lo que corresponde a lo que la documentación consultada no
 * afirma: la pasarela no envía lo que no está declarado soportado.
 */
const OPENAI_LUNA: CandidateRefresh = {
  candidateId: 'gpt-5.6-luna',
  provider: 'openai',
  profile: 'SESION',
  modelId: 'gpt-5.6-luna',
  endpoint: 'https://api.openai.com/v1/responses',
  // **Sin `snapshot` a propósito.** Escribirlo aquí afirmaría una fijación que
  // el proveedor no declara, que es justo lo que la renuncia existe para no
  // tener que fingir.
  supportedParameters: ['max_output_tokens'],
  rejectedParameters: [],
  snapshotAliasPolicy: POLITICA_SNAPSHOT_OPENAI,
  deprecation: { deprecated: false },
  dataPolicy: POLITICA_DE_DATOS,
  sources: [...FUENTES_OPENAI],
  refreshedAt: REFRESHED_AT,
};

/**
 * El refresco. **`purpose: 'test_fixture'`**, y no es un descuido: un refresco
 * material autoriza a coronar, y este candidato no puede ser coronado. La
 * autorización se niega por dos lados independientes —el propósito del refresco
 * y el rechazo de renuncias en corrida material— porque una sola puerta es una
 * puerta que alguien quita.
 */
export const REFRESH_OPENAI_2026_08_23: DocumentaryRefreshRecord = {
  schemaVersion: 'documentary-refresh-v1',
  refreshId: 'refresh-2026-08-23-exploracion-openai',
  purpose: 'test_fixture',
  refreshedAt: REFRESHED_AT,
  candidates: [OPENAI_LUNA],
};

/**
 * La renuncia, escrita entera y con autor.
 *
 * El propietario la autorizó el 2026-08-23 al elegir «medición exploratoria
 * aparte» sobre las otras dos opciones que se le plantearon —entrar como
 * candidato de pleno derecho, o descartarlo—.
 */
export const OPENAI_LUNA_WAIVER: UnpinnedIdentityWaiver = {
  subject: 'gpt-5.6-luna',
  authorizedBy: 'propietario (2026-08-23)',
  reason:
    'OpenAI no publica snapshot fechado para su catálogo vigente ni declara que un id sin fecha ' +
    'sea una versión fijada, y sus ids fechados están deprecados con apagado el 2026-12-11. Se ' +
    'comprobó además que la API no devuelve un id resuelto más específico. El propietario ' +
    'autoriza medir a este candidato sabiendo que la medición no es reproducible si el proveedor ' +
    'cambia el modelo bajo el id.',
  providerReportedModelId: 'gpt-5.6-luna',
  probedAt: OPENAI_IDENTITY_PROBED_AT,
  consequence: UNPINNED_CONSEQUENCE,
};

/** La misma renuncia, atada al `bindingId` que arma el CLI. */
export const OPENAI_LUNA_BINDING_WAIVER: UnpinnedIdentityWaiver = {
  ...OPENAI_LUNA_WAIVER,
  subject: 'binding-sesion-gpt-5.6-luna',
};
