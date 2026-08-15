# Proveniencia del sistema visual de referencia v0.1

Vendorizado sin editar (Plan.md T-H0-09, §7.1). **Estos archivos no se modifican**: retunearlos
es una iteración de la UIUX, y se hace reemplazando el vendorizado con nueva proveniencia.

## Origen

| Dato | Valor |
|---|---|
| Archivo entregado | `docs_maes/Mockups de interfaz educativa_v2.zip` |
| SHA-256 del ZIP entregado | `92f8bfc2e1f776f30272075e097729dce483dfe88165e3522210d42d4cab0501` |
| Fecha de verificación | 2026-08-14 |

## Discrepancia registrada con `Plan.md` §0.1

`Plan.md` §0.1 declara como fuente visual `Mockups de interfaz educativa_v2.1.zip` con
SHA-256 `5b2b33360369cecd4a6862a9a597bf7c5525dd79d4ff750b8dbe1b6d286faae0`.

- El **contenedor** entregado no coincide: distinto nombre (`_v2` vs `_v2.1`) y distinto hash.
- El **artefacto normativo interno sí coincide exactamente**: `Profesor IA - UX.dc.html`
  tiene SHA-256 `e1e1b730ec8516158e3318367b5d6005246a3865baf444f1cfa73918d46229a0`,
  idéntico al declarado en §0.1.

Lectura aplicada: el hash del ZIP identifica un empaquetado, no el contenido normativo. Como el
HTML declarado por la propia UIUX coincide byte a byte, el material vendorizado **es** el
declarado. La discrepancia del contenedor queda registrada aquí y en `docs/plan/PLAN_STATUS.md`
para que un auditor pueda resolverla sin reconstruirla.

## Archivos vendorizados

| Archivo | Origen dentro del ZIP | SHA-256 |
|---|---|---|
| `styles.css` | `ds/styles.css` | `cf9fcf75ac84dfe7517177eb14acf5a20ca4410c55691ab9879c6af7b2168400` |
| `ds-manifest.json` | `_ds/modernist-49c6db1b-92ba-408e-80b3-9c1daf3258b4/_ds_manifest.json` | `5a5662c539da3adb56123284636f7ab1a505ed0cd05bed3e38db93894bc5875e` |

Nota sobre `theme.json`: T-H0-09 lo nombra así, pero el ZIP no contiene ningún archivo con ese
nombre. El manifiesto de tokens del design system es `_ds_manifest.json` (namespace
`Modernist_modern`, 48 tokens `--color-*`/`--font-*`/`--space-*`/`--radius-*`/`--shadow-*`),
que es la pieza que T-H0-09 describe. Se vendoriza con su nombre normalizado `ds-manifest.json`
y su hash de origen registrado arriba.

## Pendiente para WS-FE (no bloquea F0)

`styles.css` abre con `@import url('https://fonts.googleapis.com/css2?family=Archivo…')`. Eso es
una dependencia de red externa en tiempo de render, incompatible con la regla local-first
(P-II §0.3) durante una corrida. La fuente Archivo debe autoalojarse antes de que `apps/web`
consuma estos tokens en una sesión real. El archivo vendorizado **no se edita** para lograrlo:
se resuelve en la capa de la app.
