/**
 * Reglas arquitectónicas ejecutables (Plan.md T-H0-04 [CRITICAL] ← P-II §3.3).
 * Cada regla `forbidden` codifica un invariante I-1…I-9: una violación no es
 * un aviso de estilo, es una implementación inválida (§4.5).
 *
 * Los patrones aceptan tanto la ruta resuelta (`packages/x/...`) como el
 * especificador del workspace (`@profesor-ia/x`), para que la regla se aplique
 * con o sin build previo.
 */

/** SDKs de proveedor de modelo: prohibidos fuera de `model-gateway`. */
const PROVIDER_SDKS =
  '^(@anthropic-ai/|openai(/|$)|@google/(generative-ai|genai)|@mistralai/|cohere-ai|@aws-sdk/client-bedrock|@azure/openai|replicate|groq-sdk|@deepgram/|elevenlabs)';

/** Módulos de soluciones y reservas reservadas (I-2, I-4). */
const SOLUTIONS_AND_RESERVES =
  '(solutions-private|private[-_]solutions|/solutions/|@profesor-ia/solutions)';

const MEASUREMENT_AND_PROBES =
  '(^apps/measurement-worker|@profesor-ia/measurement-worker|/probes-baseline/|/probes-intervention/|/probes/)';

const VERIFICATION_PATH = '(^packages/logic-core|@profesor-ia/logic-core|^apps/verifier)';

const HTTP_CLIENTS =
  '^(axios|node-fetch|undici|got|superagent|ws|socket\\.io|socket\\.io-client|request|cross-fetch|node:http|node:https|node:net|node:tls|node:dgram|http|https|net|tls|dgram)$';

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Los ciclos rompen la reconstrucción determinista del grafo de módulos.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'i2-gateway-sin-soluciones',
      severity: 'error',
      comment:
        'I-2 / DEC-PRIVILEGE-001: la pasarela de modelo no puede alcanzar soluciones ni reservas.',
      from: { path: '(^packages/model-gateway|^packages/session-engine|^apps/api)' },
      to: { path: SOLUTIONS_AND_RESERVES },
    },
    {
      name: 'i4-autoria-sin-sondas',
      severity: 'error',
      comment:
        'I-4: el pipeline de autoría no toca sondas ni el worker de medición (aislamiento medición/enseñanza).',
      from: { path: '(^apps/authoring-worker|^packages/authoring-core)' },
      to: { path: MEASUREMENT_AND_PROBES },
    },
    {
      name: 'i1-session-engine-sin-sdk-de-proveedor',
      severity: 'error',
      comment:
        'I-1: el motor de sesión decide; solo `model-gateway` habla con proveedores.',
      from: { path: '(^packages/session-engine|^packages/pedagogy-policy|^packages/domain-engine)' },
      to: { path: PROVIDER_SDKS, dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] },
    },
    {
      name: 'i3-verifier-sin-red',
      severity: 'error',
      comment:
        'T-H2-15: el proceso verificador es una función pura sin red (sin cliente HTTP ni sockets).',
      from: { path: VERIFICATION_PATH },
      to: { path: HTTP_CLIENTS },
    },
    {
      name: 'verificacion-sin-canonicalizador-de-isomorfismo',
      severity: 'error',
      comment:
        'T-H2-09: el canonicalizador de isomorfismo está prohibido en la ruta de verificación.',
      from: { path: VERIFICATION_PATH },
      to: { path: '(^packages/isomorphism-canonicalizer|@profesor-ia/isomorphism-canonicalizer)' },
    },
    {
      name: 'visual-sin-veredicto-formal',
      severity: 'error',
      comment:
        'DEC-VISION-001 / ci:visual:no-verdict: ningún score visual autoriza un veredicto formal.',
      from: { path: '(^packages/visual-interaction|^packages/speech-gateway)' },
      to: { path: VERIFICATION_PATH },
    },
    {
      name: 'web-sin-claves-ni-gateway',
      severity: 'error',
      comment:
        'P-II §11.1: el cliente no porta credenciales; los secretos se inyectan en runtime (Infisical).',
      from: { path: '^apps/web' },
      to: {
        path: '(^packages/model-gateway|@profesor-ia/model-gateway|^packages/security-policy|@profesor-ia/security-policy|@infisical|dotenv)',
      },
    },
    {
      name: 'web-sin-soluciones',
      severity: 'error',
      comment: 'I-2: el cliente web nunca alcanza soluciones ni sondas.',
      from: { path: '^apps/web' },
      to: { path: `(${SOLUTIONS_AND_RESERVES}|${MEASUREMENT_AND_PROBES})` },
    },
    {
      name: 'sin-dependencias-no-resueltas',
      severity: 'error',
      comment: 'Una importación que no resuelve invalida el análisis arquitectónico.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|/dist/|\\.test\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
