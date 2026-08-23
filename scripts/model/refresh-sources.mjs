#!/usr/bin/env node
/**
 * Huellas de las fuentes de un refresco documental (T-H4-09 ← P-II §8.1).
 *
 * Uso:
 *   node scripts/model/refresh-sources.mjs <url> [<url> …]
 *
 * ## Por qué existe, y qué defecto arregla
 *
 * El refresco del 2026-08-18 registró `contentSha256` de **los bytes de la
 * página de documentación**. Se comprobó el 2026-08-23 que esos hashes **no son
 * reproducibles**: las páginas de `platform.claude.com` son una aplicación
 * Next.js cuyo HTML lleva un `nonce` de CSP distinto en cada respuesta y cuyo
 * flujo RSC no serializa los mismos identificadores dos veces. Tres descargas
 * seguidas de la misma URL, sin que la documentación cambiara, dieron tres
 * hashes distintos.
 *
 * **Un hash irreproducible no es evidencia: es un número.** Quien auditara el
 * refresco volvería a descargar, obtendría otro hash y **no podría distinguir
 * «la documentación cambió» de «el nonce cambió»**, que es exactamente lo que la
 * huella existe para distinguir. Nadie lo notó porque nadie volvió a descargar.
 *
 * ## La corrección, y por qué esta y no una normalización
 *
 * Se intentó normalizar quitando el `nonce` en sus dos formas —atributo HTML y
 * campo escapado dentro del payload RSC— y **siguió siendo inestable**: cambia
 * también el orden de los identificadores de chunk. Seguir añadiendo reglas
 * hasta que el hash dejara de moverse produciría un hash de «lo que mi `sed`
 * dejó pasar», que es peor que no tener hash: parece reproducible.
 *
 * Lo que sí es estable es el **contenido documental**, que estos sitios sirven
 * en `text/markdown` bajo la misma ruta con sufijo `.md`. Eso es además lo que
 * §8.1 quiere fijar: la afirmación del proveedor, no el vehículo que la
 * transporta.
 *
 * ## La propiedad que este script defiende
 *
 * **No supone que sea reproducible: lo comprueba.** Descarga cada fuente **dos
 * veces** y se niega a emitir la huella si las dos descargas difieren. Si algún
 * día un proveedor sirve markdown inestable, esto falla y lo dice, en vez de
 * grabar un número que no significa nada. Es el mismo criterio que el control
 * positivo de las reglas de arquitectura: la comprobación tiene que poder
 * fallar.
 *
 * Salida: una línea por fuente, en el formato que espera `DocumentarySource`.
 * No escribe ningún archivo: el registro de refresco se redacta a mano porque
 * lleva lecturas que ninguna descarga produce —política de datos, régimen de
 * snapshots, parámetros rechazados—.
 */
import { createHash } from 'node:crypto';

/** Sufijo bajo el que el sitio sirve el contenido documental en markdown. */
const SUFIJO_MARKDOWN = '.md';

function huella(texto) {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

async function descargar(url) {
  const respuesta = await fetch(url, { redirect: 'follow' });
  if (!respuesta.ok) {
    throw new Error(`${url} respondió ${String(respuesta.status)}.`);
  }
  const tipo = respuesta.headers.get('content-type') ?? '';
  return { texto: await respuesta.text(), tipo };
}

/**
 * Convierte la URL de la página a la de su contenido documental.
 *
 * Se deja pasar una URL que ya termine en `.md`: quien la pase así está
 * declarando que ya apunta al contenido.
 */
function urlDocumental(url) {
  if (url.endsWith(SUFIJO_MARKDOWN)) return url;
  const sinAncla = url.split('#')[0].replace(/\/$/, '');
  return `${sinAncla}${SUFIJO_MARKDOWN}`;
}

async function fuente(urlPagina) {
  const url = urlDocumental(urlPagina);
  const primera = await descargar(url);
  const segunda = await descargar(url);

  if (!primera.tipo.includes('markdown') && !primera.tipo.includes('text/plain')) {
    throw new Error(
      `${url} devolvió \`${primera.tipo}\` y no markdown. Hashear el HTML de estas páginas no es ` +
        `reproducible —lleva un nonce de CSP por respuesta— y una huella irreproducible no es ` +
        `evidencia.`,
    );
  }
  if (primera.texto !== segunda.texto) {
    throw new Error(
      `${url} devolvió dos cuerpos distintos en dos descargas seguidas (${String(
        primera.texto.length,
      )} y ${String(segunda.texto.length)} caracteres). No se emite huella: sería un número que ` +
        `nadie puede volver a obtener, y su comparación no distinguiría un cambio de la ` +
        `documentación de una variación del servidor.`,
    );
  }
  return { url, contentSha256: huella(primera.texto), bytes: primera.texto.length };
}

async function main() {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('uso: node scripts/model/refresh-sources.mjs <url> [<url> …]');
    return 2;
  }
  const retrievedAt = new Date().toISOString();
  const fallos = [];
  const fuentes = [];
  for (const url of urls) {
    try {
      fuentes.push(await fuente(url));
    } catch (error) {
      fallos.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const f of fuentes) {
    console.log(`{`);
    console.log(`  url: '${f.url}',`);
    console.log(`  retrievedAt: REFRESHED_AT,`);
    console.log(`  contentSha256: '${f.contentSha256}',`);
    console.log(`},   // ${String(f.bytes)} caracteres de markdown`);
  }
  console.log(`\nREFRESHED_AT = '${retrievedAt}'`);

  for (const fallo of fallos) console.error(`FALLA: ${fallo}`);
  return fallos.length === 0 ? 0 : 1;
}

process.exit(await main());
