/**
 * Arranque instrumentado de `apps/web` (Plan.md T-H3-01).
 *
 * Next llama a `register()` una vez al levantar el servidor. Es el sitio que
 * sustituye a lo que hacía `src/main.ts` antes de que el contenedor sirviera la
 * aplicación real: emitir **una línea JSON por evento, a stdout y al volumen
 * `logs`**, que es un criterio de H3 —«cada servicio emite JSON por línea a
 * stdout y al volumen `logs`»— y la vía por la que el receptor `filelog` del
 * colector lee a este servicio.
 *
 * Sin esto, cambiar el entrypoint habría apagado en silencio la telemetría de
 * `web`: el contenedor arrancaría, el healthcheck pasaría, y `web.log` no
 * volvería a crecer. Nadie lo habría notado hasta buscar un log que no está.
 *
 * Aquí **no** se arranca OpenTelemetry. `web` todavía no tiene operación propia
 * que trazar —la verificación la decide `apps/api` contra el verificador
 * aislado—, y un span de «arranqué» para poder decir que hay trazas sería éxito
 * simulado (T-H3-05). Cuando F8 le dé operación, este es su sitio.
 */
const SERVICE = 'web';

export async function register(): Promise<void> {
  // Next ejecuta este hook también en el runtime `edge`, donde `node:fs` no
  // existe. La importación va dentro de la guarda y no arriba: en el módulo
  // superior rompería el empaquetado de `edge` aunque nunca se llegara a usar.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { appendFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');

  const logFile = process.env.LOG_FILE ?? `/var/log/profesor-ia/${SERVICE}.log`;
  const record = JSON.stringify({
    ts: new Date().toISOString(),
    service: SERVICE,
    event: 'listening',
    port: Number(process.env.PORT ?? 3000),
  });

  process.stdout.write(`${record}\n`);
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${record}\n`);
  } catch (err) {
    // Sin el volumen montado el servicio sigue sirviendo —su trabajo no depende
    // de la bitácora— pero lo dice por stdout en vez de callarlo.
    process.stdout.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        service: SERVICE,
        event: 'log_file_unavailable',
        detail: String(err),
      })}\n`,
    );
  }
}
