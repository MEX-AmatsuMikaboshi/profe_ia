/**
 * Reglas arquitectónicas ejecutables (Plan.md T-H0-04 [CRITICAL] ← P-II §3.3).
 * Cada regla `forbidden` codifica un invariante I-1…I-9: una violación no es
 * un aviso de estilo, es una implementación inválida (§4.5).
 *
 * Los patrones aceptan tanto la ruta resuelta (`packages/x/...`) como el
 * especificador del workspace (`@profesor-ia/x`), para que la regla se aplique
 * con o sin build previo.
 */

/**
 * SDKs de proveedor de modelo: prohibidos fuera de `model-gateway`.
 *
 * **El prefijo `node_modules/` es obligatorio y no es cosmético (D-82).** Hasta
 * el 2026-08-28 el patrón estaba anclado con `^` y la regla I-1 **no podía
 * disparar nunca**: dependency-cruiser da la ruta **resuelta**
 * —`node_modules/@anthropic-ai/sdk/index.js`—, que no empieza por
 * `@anthropic-ai/`. Se comprobó sembrando el import con el paquete instalado y
 * declarado: cero violaciones sobre 483 módulos.
 *
 * La alternancia acepta las dos formas: el especificador desnudo, que es lo que
 * se ve cuando el módulo **no** resuelve, y la ruta resuelta.
 */
const PROVIDER_SDKS =
  '(^|/)(node_modules/)?(@anthropic-ai/|openai(/|$)|@google/(generative-ai|genai)|@mistralai/|cohere-ai|@aws-sdk/client-bedrock|@azure/openai|replicate|groq-sdk|@deepgram/|elevenlabs)';

/** Módulos de soluciones y reservas reservadas (I-2, I-4). */
const SOLUTIONS_AND_RESERVES =
  '(solutions-private|private[-_]solutions|/solutions/|@profesor-ia/solutions)';

const MEASUREMENT_AND_PROBES =
  '(^apps/measurement-worker|@profesor-ia/measurement-worker|/probes-baseline/|/probes-intervention/|/probes/)';

const VERIFICATION_PATH = '(^packages/logic-core|@profesor-ia/logic-core|^apps/verifier)';

/**
 * Clientes HTTP y sockets prohibidos en la ruta de verificación (I-3).
 *
 * Mismo defecto que `PROVIDER_SDKS` y por el otro extremo (D-82): terminaba en
 * `$`, así que casaba `https` —módulo del núcleo, cuya ruta resuelta es el
 * nombre pelado— pero **no** `node_modules/axios/index.js`. I-3 detectaba los
 * módulos `node:*` y dejaba pasar cualquier cliente HTTP de npm, que es
 * justamente el que alguien instalaría.
 */
const HTTP_CLIENTS =
  '(^|node_modules/)(axios|node-fetch|undici|got|superagent|ws|socket\\.io|socket\\.io-client|request|cross-fetch|node:http|node:https|node:net|node:tls|node:dgram|http|https|net|tls|dgram)(/|$)';

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
      name: 'sin-verificador-fuera-del-verificador',
      severity: 'error',
      comment:
        'T-H6-13 ← P-I §8.9 / I-3 / D-12: el veredicto lo emite `apps/verifier`, que corre sin ' +
        'red y se habla por spool. Ni el cliente ni el orquestador pueden alcanzar `verify()`: ' +
        'en el cliente la validación es local y **no autoritativa**, y en `apps/api` un verify ' +
        'en línea sería un segundo verificador fuera del contenedor aislado, saltándose la ' +
        'única ruta de verificación. Ambos entran solo por el subpath sin veredicto ' +
        '`@profesor-ia/logic-core/syntax`.',
      from: { path: '^apps/(web|api)' },
      to: {
        path: VERIFICATION_PATH,
        pathNot: '(@profesor-ia/logic-core/syntax|^packages/logic-core/(src|dist)/syntax\\.)',
      },
    },
    {
      name: 'verificacion-sin-telemetria-de-red',
      severity: 'error',
      comment:
        'I-3 / T-H3-05: el verificador corre con `network_mode: none` y su telemetria sale por ' +
        'archivo, que el receptor `filelog` del colector lee. Importar `@profesor-ia/observability` ' +
        'meteria un exportador OTLP —un cliente HTTP— en la ruta de verificacion, que es justo lo ' +
        'que I-3 prohibe. Es tambien la razon por la que este arranque no vive en `contracts`: de ' +
        '`contracts` depende `logic-core`, asi que la dependencia llegaria sola.',
      from: { path: VERIFICATION_PATH },
      to: { path: '(^tools/observability|@profesor-ia/observability)' },
    },
    {
      name: 'pasarela-sin-nucleo-logico',
      severity: 'error',
      comment:
        'T-H7-02: el validador de anclaje comprueba la salida del modelo contra el cálculo ' +
        'congelado, y el cálculo entra por parámetro (`AuthorizedCalculus`), no por import. ' +
        'Importarlo aquí acercaría `verify()` al único paquete que habla con proveedores: la ' +
        'pasarela podría acabar dictaminando sobre una derivación sin pasar por el contenedor ' +
        'aislado, que es lo que I-3 y D-12 impiden. La correspondencia entre lo inyectado y el ' +
        'cálculo congelado la comprueba una prueba, que sí puede importarlo.',
      from: { path: '(^packages/model-gateway|@profesor-ia/model-gateway)' },
      to: { path: VERIFICATION_PATH },
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
    // `/dist/` **no** se excluye, y la diferencia no es cosmética (T-H6-13, D-25).
    //
    // `exclude` no solo deja de recorrer un módulo: lo borra del grafo, también
    // como destino de dependencia. Los paquetes del workspace resuelven por
    // `exports` a `dist/`, así que con `/dist/` excluido toda dependencia
    // **declarada** entre paquetes desaparecía, y con ella la regla que la
    // vigilaba. Las reglas `web-sin-*` parecían verdes porque esos paquetes no
    // estaban en el `package.json` de `apps/web`: en cuanto uno se declaraba,
    // el control pasaba por vacío sin que nada lo dijera. Se descubrió al
    // sembrar `apps/web → @profesor-ia/logic-core` con la dependencia ya
    // declarada: la violación no se detectaba.
    //
    // Con `dist` dentro, un artefacto compilado rancio de una siembra anterior
    // ensucia el recorrido; por eso `verify-depcruise-catches.mjs` retira
    // también los `__arch_probe*` compilados.
    //
    // `.next/` y `next-env.d.ts` sí se excluyen, y no es la misma decisión: son
    // salida y andamiaje que genera `next build`, y **nada los importa**. A
    // diferencia de `dist/`, excluirlos no borra ninguna arista real del grafo.
    // `node_modules` **no** se excluye, y es la misma lección que `/dist/` (D-25),
    // que este mismo bloque explica dos párrafos más abajo: `exclude` borra el
    // módulo del grafo **también como destino de dependencia**. Con él excluido,
    // toda regla cuyo `to` sea un paquete de npm —I-1 y la mitad de I-3— no tenía
    // destino que vigilar y pasaba por vacío. `doNotFollow` sigue impidiendo
    // **recorrer** el interior de `node_modules`, que es lo que se quería: los
    // paquetes entran como hojas del grafo, no como subárboles (D-82).
    exclude: { path: '(\\.next/|next-env\\.d\\.ts$|\\.test\\.tsx?$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      // `production` entra con Excalidraw (T-H8-03). Su `exports` declara
      // `./index.css` **sólo** bajo `development` y `production`, sin `default`,
      // así que sin esta condición el import del layout no resuelve y salta
      // `sin-dependencias-no-resueltas` — que es la regla haciendo su trabajo:
      // avisa de que hay una arista real que el grafo no ve, y un grafo con
      // agujeros deja reglas vigilando el vacío (D-25, D-82).
      //
      // No cambia nada más: para el export principal, `production` apunta al
      // mismo `dist/prod/index.js` que ya elegía `default`.
      conditionNames: ['import', 'require', 'node', 'production', 'default', 'types'],
      // `.tsx`/`.jsx` entran con la vista de Clase (T-H6-13). Sin ellos, sus
      // importaciones quedan «no resueltas» y las reglas de `apps/web` no ven
      // el grafo que deben vigilar.
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
