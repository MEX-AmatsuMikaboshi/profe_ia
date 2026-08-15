/**
 * `ci:infra:hardening` — comprueba el endurecimiento del entorno local
 * (Plan.md T-H3-04 [CRITICAL] ← Maestro P-II §11.5.1).
 *
 * Lee la configuración **resuelta** (`docker compose config`), no el YAML
 * fuente: los anclas, los `extends` y las variables ya están aplicados, así que
 * lo que se comprueba es exactamente lo que Docker va a ejecutar. Un YAML que
 * se lee bien pero resuelve a otra cosa es justo el fallo que esto atrapa.
 *
 * Cada regla corresponde a un invariante, no a una preferencia:
 *
 *  - socket de Docker montado ⇒ root en el host ⇒ todo lo demás es decorado;
 *  - `solutions-private` fuera de autoría ⇒ I-2;
 *  - reservas de sondas fuera de medición ⇒ I-4;
 *  - verificador con red ⇒ I-3;
 *  - puerto publicado a 0.0.0.0 ⇒ el «entorno local» deja de serlo.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..');
const COMPOSE_FILE = join(REPO, 'infra', 'compose', 'docker-compose.yml');
const ENV_FILE = join(REPO, 'infra', 'compose', '.env');

const DOCKER_BIN_WINDOWS = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_BIN_WINDOWS)) {
  process.env.PATH = `${DOCKER_BIN_WINDOWS};${process.env.PATH ?? ''}`;
}

/** Servicios autorizados a montar cada recurso reservado. */
const SOLUTIONS_ALLOWED = new Set(['authoring-worker']);
const PROBES_ALLOWED = new Set(['measurement-worker']);
/** Servicios de un solo uso: no exponen proceso permanente. */
const ONE_SHOT = new Set(['migrator', 'backup', 'restore']);

/**
 * Imposibilidades técnicas, con su razón. T-H3-04 las permite **documentadas**;
 * lo que no permite es que desaparezcan en silencio, así que cada una se
 * imprime en cada corrida.
 */
const HEALTHCHECK_EXEMPT = new Map([
  [
    'otel-collector',
    'imagen distroless: no trae shell ni cliente HTTP con el que sondear el endpoint de salud',
  ],
]);

/**
 * Salida a Internet, separada por motivo. La de autoría es **por función**
 * (P-I §15.1); la de los servicios con puerto publicado es una limitación de
 * Docker: no publica puertos desde una red `internal`.
 */
const EGRESS_BY_FUNCTION = new Set(['authoring-worker']);
const EGRESS_BY_PLATFORM = new Map([
  ['web', 'puerto publicado al host: Docker no publica desde una red interna'],
  ['api', 'puerto publicado al host: Docker no publica desde una red interna'],
  ['infisical', 'consola de secretos publicada al host: misma limitación'],
]);

const failures = [];
const passes = [];
/** Imposibilidades técnicas aceptadas: se imprimen siempre, nunca se ocultan. */
const exceptions = [];

const check = (ok, message) => (ok ? passes.push(message) : failures.push(message));

const envArgs = existsSync(ENV_FILE) ? ['--env-file', ENV_FILE] : [];
const result = spawnSync(
  'docker',
  ['compose', '-f', COMPOSE_FILE, ...envArgs, '--profile', 'tools', 'config', '--format', 'json'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);

if (result.error || result.status !== 0) {
  console.error('no se pudo resolver la configuración de compose:');
  console.error(result.stderr || result.error?.message || `código ${result.status}`);
  console.error(
    '\nSi falta `infra/compose/.env`, créalo con `pnpm run dev:env`: el compose exige\n' +
      'valor explícito para cada secreto y falla a propósito cuando no lo hay.',
  );
  process.exit(2);
}

const config = JSON.parse(result.stdout);
const services = Object.entries(config.services ?? {});

check(services.length > 0, `la configuración resuelve ${services.length} servicios`);

for (const [name, service] of services) {
  const volumes = service.volumes ?? [];
  const sources = volumes.map((v) => String(v.source ?? '')).map((s) => s.replaceAll('\\', '/'));

  // 1. Socket de Docker: en ningún servicio, sin excepción.
  check(
    !sources.some((s) => s.includes('docker.sock')) && !sources.some((s) => s.endsWith('/docker')),
    `${name}: no monta el socket de Docker`,
  );

  // 2. Sin privilegios nuevos.
  check(
    (service.security_opt ?? []).includes('no-new-privileges:true'),
    `${name}: no-new-privileges`,
  );

  // 3. Sin capabilities.
  check((service.cap_drop ?? []).includes('ALL'), `${name}: cap_drop ALL`);
  check(!(service.cap_add ?? []).length, `${name}: no añade capabilities`);

  // 4. Nunca privilegiado.
  check(service.privileged !== true, `${name}: no es privilegiado`);

  // 5. Raíz de solo lectura.
  check(service.read_only === true, `${name}: raíz de solo lectura`);

  // 6. Nunca root explícito.
  check(
    service.user === undefined || !/^(root|0)(:|$)/.test(String(service.user)),
    `${name}: no corre como root`,
  );

  // 7. seccomp: no se desactiva sin justificación (no hay ninguna registrada).
  check(
    !(service.security_opt ?? []).some((o) => String(o).includes('seccomp=unconfined')),
    `${name}: seccomp no desactivado`,
  );

  // 8. Puertos solo a la interfaz local.
  for (const port of service.ports ?? []) {
    check(
      port.host_ip === '127.0.0.1',
      `${name}: publica ${port.published} solo en 127.0.0.1 (host_ip=${port.host_ip ?? 'sin fijar'})`,
    );
  }

  // 9. Reservas: soluciones y sondas solo donde corresponde (I-2, I-4).
  const tocaSoluciones = sources.some(
    (s) => s.includes('solutions-private') || s.endsWith('/unidad-deduccion-natural'),
  );
  check(
    !tocaSoluciones || SOLUTIONS_ALLOWED.has(name),
    `${name}: ${tocaSoluciones ? 'monta' : 'no monta'} soluciones privadas${
      tocaSoluciones ? ' (autorizado)' : ''
    }`,
  );

  const tocaSondas = sources.some((s) => s.includes('/probes-'));
  check(
    !tocaSondas || PROBES_ALLOWED.has(name),
    `${name}: ${tocaSondas ? 'monta' : 'no monta'} reservas de sondas${
      tocaSondas ? ' (autorizado)' : ''
    }`,
  );

  // 10. Salud declarada en todo servicio permanente.
  const exencion = HEALTHCHECK_EXEMPT.get(name);
  if (exencion) {
    exceptions.push(`${name}: sin healthcheck — ${exencion}`);
  } else {
    check(ONE_SHOT.has(name) || service.healthcheck !== undefined, `${name}: declara healthcheck`);
  }
}

// 11. El verificador no tiene red (I-3).
const verifier = config.services?.verifier;
check(verifier?.network_mode === 'none', 'verifier: network_mode none');
check(
  !verifier?.networks || Object.keys(verifier.networks).length === 0,
  'verifier: sin redes conectadas',
);

// 12. Egress por función: solo autoría sale a Internet por decisión; los
// servicios con puerto publicado, por limitación de la plataforma.
for (const [name, service] of services) {
  const nets = Object.keys(service.networks ?? {});
  const saleAInternet = nets.some((n) => n === 'egress' || n === 'edge');
  if (!saleAInternet) {
    passes.push(`${name}: sin salida a Internet`);
  } else if (EGRESS_BY_FUNCTION.has(name)) {
    passes.push(`${name}: salida a Internet autorizada por función (P-I §15.1)`);
  } else if (EGRESS_BY_PLATFORM.has(name)) {
    exceptions.push(`${name}: alcanza Internet — ${EGRESS_BY_PLATFORM.get(name)}`);
  } else {
    failures.push(`${name}: sale a Internet sin autorización ni excepción registrada`);
  }
}
check(config.networks?.core?.internal === true, 'la red `core` es interna (sin salida)');

for (const message of passes) console.log(`ok: ${message}`);
if (exceptions.length > 0) {
  console.log('\nImposibilidades técnicas registradas (T-H3-04; ver infra/runbooks/local.md):');
  for (const message of exceptions) console.log(`  · ${message}`);
}
if (failures.length > 0) {
  console.error('\nHARDENING INCUMPLIDO:');
  for (const message of failures) console.error(`  ✗ ${message}`);
  console.error(
    `\n${failures.length} incumplimiento(s). T-H3-04 exige corregirlos o documentar la\n` +
      'imposibilidad técnica en `infra/runbooks/local.md` sin relajar las demás fronteras.',
  );
  process.exit(1);
}

console.log(`\n${passes.length} comprobaciones de hardening en verde.`);
