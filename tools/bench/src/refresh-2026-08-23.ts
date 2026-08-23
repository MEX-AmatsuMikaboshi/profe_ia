import type {
  CandidateRefresh,
  DocumentaryRefreshRecord,
} from '@profesor-ia/model-gateway';

/**
 * Refresco documental del 2026-08-23 (T-H4-09 ← P-II §8.1).
 *
 * Sustituye al del 2026-08-18, que **caducó** —434 702 s medidos frente a los
 * 432 000 de `REFRESH_WINDOW_5D`— y que además no cubría al candidato que la
 * investigación de §3.4 recomienda.
 *
 * ## Lo que cambia respecto del anterior, y no es sólo la fecha
 *
 * **1. Las huellas son de contenido documental, no de bytes de página.** El
 * refresco anterior hasheó el HTML de `platform.claude.com`. El 2026-08-23 se
 * comprobó que **ese hash no es reproducible**: la página es una aplicación
 * Next.js que sirve un `nonce` de CSP distinto por respuesta y un flujo RSC que
 * no serializa los mismos identificadores dos veces. Tres descargas seguidas,
 * sin que la documentación cambiara, dieron tres hashes distintos. Un auditor
 * que volviera a descargar **no podría distinguir «la documentación cambió» de
 * «el nonce cambió»**, que es justo lo que la huella existe para distinguir.
 *
 * Se intentó normalizar quitando el nonce en sus dos formas y siguió siendo
 * inestable. Seguir añadiendo reglas hasta que el hash dejara de moverse habría
 * producido un hash de «lo que el filtro dejó pasar», que es **peor** que no
 * tener hash porque parece reproducible.
 *
 * Lo estable es el contenido en `text/markdown` que el sitio sirve bajo la
 * misma ruta con sufijo `.md`, y es además lo que §8.1 quiere fijar: la
 * afirmación del proveedor, no el vehículo. `scripts/model/refresh-sources.mjs`
 * lo descarga **dos veces** y se niega a emitir huella si difieren: no supone
 * que sea reproducible, lo comprueba.
 *
 * **2. Entra `claude-sonnet-5`.** La documentación resuelve por escrito la duda
 * que §8.1 planteaba —«Each Claude model ID identifies a pinned version of the
 * model»— y el formato sin fecha de la generación 4.6 en adelante «is also a
 * pinned snapshot, not an evergreen pointer». No hace falta huella de
 * comportamiento: el id **es** el snapshot.
 *
 * **3. Se conserva `claude-haiku-4-5-20251001`, y con su reserva escrita.** Su
 * retiro tentativo es «not sooner than October 15, 2026», a menos de dos meses.
 * Está aquí **para poder compararlo**, no para coronarlo: incluirlo en el
 * refresco no lo elige, y elegirlo es del propietario.
 *
 * ## Lo que sigue sin poder incluirse
 *
 * **Ningún modelo de OpenAI.** §3.4 lo dejó averiguado el 2026-08-18: los ids
 * de la familia 5.6 no publican snapshot fechado y OpenAI **no declara** que un
 * id sin fecha sea una versión fijada —a diferencia de Anthropic, que sí lo
 * dice—. Sin esa declaración, §8.1 exige huella de comportamiento sobre el set
 * canario, y esa huella no existe. Fabricarla sería inventar la evidencia que
 * la regla pide. Por eso BENCH-01 puede correr con un proveedor y **BENCH-02
 * sigue bloqueado**: exige familias distintas.
 */

/** Momento de las descargas que sustentan este refresco. */
const REFRESHED_AT = '2026-08-23T08:33:13.515Z';

/**
 * Régimen de snapshots, citado del proveedor y no parafraseado. La cita es lo
 * que hace que `assertPinnedIdentity()` acepte un id sin fecha: sin ella,
 * «Anthropic fija sus ids» sería una creencia nuestra.
 */
const POLITICA_SNAPSHOT_ANTHROPIC =
  'Documentación del proveedor, «Model IDs and versioning»: «Each Claude model ID identifies a ' +
  'pinned version of the model. When you use a model ID in an API request, the underlying model ' +
  'remains constant for the lifetime of that ID.» Y en «Models overview»: «Every Claude model ID ' +
  'is a pinned snapshot. […] Starting with the Claude 4.6 generation, model IDs use a dateless ' +
  'format that is also a pinned snapshot, not an evergreen pointer.» Por eso un id sin fecha no ' +
  'es un alias que haya que resolver.';

/**
 * Política de datos, con lo conocido y lo no publicado separados.
 *
 * `region` y `contractualEligibility` van como **no conocidas**. El proveedor no
 * las publica en estas fuentes, y rellenarlas con lo que suele pasar sería
 * exactamente lo que el registro existe para impedir.
 */
const POLITICA_DE_DATOS = {
  region: { known: false, reason: 'no_publicado_por_el_proveedor' },
  logging: {
    known: true,
    value:
      '«By default, we will not use your inputs or outputs from our commercial products (e.g. ' +
      'Claude for Work, Anthropic API, Claude Gov, etc.) to train our models.» El entrenamiento ' +
      'sólo ocurre si se reporta feedback explícitamente.',
  },
  retention: {
    known: true,
    value:
      'Sin retención para entrenamiento por omisión. Si se envía feedback explícito, se almacena ' +
      'la conversación completa «for up to 5 years».',
  },
  contractualEligibility: { known: false, reason: 'no_publicado_por_el_proveedor' },
} as const;

/**
 * Fuentes, con huella **reproducible**. Se obtuvieron con
 * `node scripts/model/refresh-sources.mjs <urls>`, que descarga cada una dos
 * veces y se niega a emitir huella si difieren.
 */
const FUENTES_ANTHROPIC = [
  {
    url: 'https://platform.claude.com/docs/en/about-claude/models/overview.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: 'c4b23d31f9f3bd850ebc63bacf05417a2780f945dc15c78f9dcf853f55af0d12',
  },
  {
    url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: 'b73d8c62fb2a3907201d9a73fdceda26a0ab1010c253660f9717cf6f89ed7028',
  },
  {
    url: 'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: 'e5d0aa4d3c1bfe06b25439633d0147c9e8e48d56843aa5769d7742f5b39b5626',
  },
  {
    url: 'https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training.md',
    retrievedAt: REFRESHED_AT,
    contentSha256: '4341f6af0ddd5415cfee1a7f66e77fd135bd6a5fe738d4b2cd47c329ba0f0716',
  },
] as const;

/**
 * `temperature`, `top_p` y `top_k` van como **rechazados**, citando la tabla de
 * deprecaciones de parámetros: «Returns a 400 error when set to a non-default
 * value on Claude 4.7 and later models». Declararlos soportados haría que la
 * pasarela los enviara y la llamada fallara con la factura ya hecha.
 */
const PARAMETROS_RECHAZADOS = ['temperature', 'top_p', 'top_k'] as const;

const ANTHROPIC_SONNET_5: CandidateRefresh = {
  candidateId: 'claude-sonnet-5',
  provider: 'anthropic',
  profile: 'SESION',
  modelId: 'claude-sonnet-5',
  endpoint: 'https://api.anthropic.com/v1/messages',
  // Sin fecha **y** snapshot fijado: lo dice la documentación citada arriba.
  snapshot: 'claude-sonnet-5',
  supportedParameters: ['max_tokens'],
  rejectedParameters: [...PARAMETROS_RECHAZADOS],
  // El régimen de snapshots **y** el estado de ciclo de vida van juntos aquí
  // porque `CandidateDeprecation` con `deprecated: false` es `.strict()` y no
  // admite nota: un modelo no deprecado no tiene aviso que registrar, y meter
  // la fecha tentativa en ese campo la convertiría en un compromiso que el
  // proveedor no dio.
  snapshotAliasPolicy:
    `${POLITICA_SNAPSHOT_ANTHROPIC} Estado de ciclo de vida: «claude-sonnet-5 | Active | N/A | ` +
    `Not sooner than June 30, 2027». Es un piso, no una fecha comprometida. El proveedor promete ` +
    `«at least 60 days' notice before model retirement for publicly released models».`,
  deprecation: { deprecated: false },
  dataPolicy: POLITICA_DE_DATOS,
  sources: [...FUENTES_ANTHROPIC],
  refreshedAt: REFRESHED_AT,
};

const ANTHROPIC_HAIKU_4_5: CandidateRefresh = {
  candidateId: 'claude-haiku-4-5-20251001',
  provider: 'anthropic',
  profile: 'SESION',
  modelId: 'claude-haiku-4-5-20251001',
  endpoint: 'https://api.anthropic.com/v1/messages',
  snapshot: 'claude-haiku-4-5-20251001',
  supportedParameters: ['max_tokens'],
  rejectedParameters: [...PARAMETROS_RECHAZADOS],
  snapshotAliasPolicy:
    `${POLITICA_SNAPSHOT_ANTHROPIC} Estado de ciclo de vida: «claude-haiku-4-5-20251001 | Active ` +
    `| N/A | Not sooner than October 15, 2026», la fecha más próxima de los modelos vigentes de ` +
    `Anthropic. Está en el refresco **para poder compararlo, no para coronarlo**: un ganador atado ` +
    `a un modelo que puede apagarse en menos de dos meses obligaría a rehacer la elección enseguida.`,
  deprecation: { deprecated: false },
  dataPolicy: POLITICA_DE_DATOS,
  sources: [...FUENTES_ANTHROPIC],
  refreshedAt: REFRESHED_AT,
};

export const REFRESH_2026_08_23: DocumentaryRefreshRecord = {
  schemaVersion: 'documentary-refresh-v1',
  refreshId: 'refresh-2026-08-23-bench01',
  purpose: 'material',
  refreshedAt: REFRESHED_AT,
  candidates: [ANTHROPIC_SONNET_5, ANTHROPIC_HAIKU_4_5],
};
