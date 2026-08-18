# Refresco documental de candidatos (`T-H4-09`)

*Norma:* P-II §8.1 (bindings fechados), §13-H4. *Decisión:* `DEC-MODEL-BINDING-001`.

## Por qué esta tarea estuvo `PENDIENTE` a propósito

La norma pide reverificar ids, endpoints, parámetros, deprecaciones y políticas de datos
**inmediatamente antes** del benchmark. Adelantar la corrida del refresco produce evidencia
caducada, que es **peor que no tenerla**: parece válida. Por eso el mecanismo se construye ahora y
la corrida se hace pegada a `T-H4-10`.

## Lo que el módulo no hace, y es lo que lo define

`packages/model-gateway/src/documentary-refresh.ts` **no consulta a ningún proveedor, no descarga
documentación y no rellena un dato que nadie leyó.** Registrar es una cosa y averiguar es otra; un
módulo que «consultara» la documentación estaría produciendo la evidencia que dice verificar.

Lo que hace es exigir la forma de esa evidencia y **rechazar** la que no autoriza un benchmark.
Tampoco decide ganadores: eso sale de BENCH-01/02.

## Las tres decisiones que gobiernan el diseño

### 1. «Cuando se conozcan» no es «no miré»

§8.1 admite no conocer región, logging, retención y elegibilidad contractual «cuando se conozcan».
Esa licencia cubre **lo que el proveedor no publica**; no cubre no haber mirado.

Por eso `DocumentaryFact` tiene tres estados y no dos:

| Estado | Significa |
|---|---|
| `{ known: true, value }` | Se consultó y el proveedor lo publica |
| `{ known: false, reason: 'no_publicado_por_el_proveedor' }` | Se consultó y el proveedor no lo publica |
| `{ known: false, reason: 'no_consultado' }` | **Trabajo que falta** |

Una corrida material **bloquea** si algún campo queda en `no_consultado`. Colapsar los dos casos de
«no se sabe» dejaría pasar un refresco a medias como si fuera completo, que es exactamente lo que
esta tarea existe para impedir.

### 2. «Inmediatamente antes» no es un número, así que no se cablea

Ninguna autoridad da una cifra. Escribir «24 horas» convertiría una decisión de protocolo en una
constante que nadie firmó. La ventana entra como `RefreshWindowParameter`: dato con `parameterId`,
`provenance` y `purpose`, igual que el criterio de suficiencia de `foundation_phase` (T-H6-12). Una
corrida material exige ventana `material`; un `test_fixture` no la habilita.

Además, la autorización **devuelve la antigüedad observada por candidato**, en segundos. El auditor
ve el número, no un «ok». Y cuando la evidencia caduca el mensaje dice lo que hay que hacer:
refrescar otra vez, **no** ampliar la ventana para que quepa.

### 3. La evidencia no es la declaración

`CandidateDataPolicy` y `ModelCapabilities.dataPolicy` se parecen y no son lo mismo:

- `ModelCapabilities.dataPolicy` es lo que el **binding declara**, con `loggingRetentionDays`
  numérico y una elegibilidad de tres valores;
- `CandidateDataPolicy` es la **evidencia** de qué decía la documentación, en prosa y con su fuente.

**No hay conversor entre las dos, a propósito.** Convertir «30 días de retención salvo abuso» en un
número es un juicio de quien escribe el binding; hacerlo automáticamente produciría cifras que
ningún documento dice.

## Lo que bloquea una corrida

| Situación | Por qué no se degrada |
|---|---|
| Refresco o ventana `test_fixture` en corrida material | Un fixture prueba el mecanismo; no reverifica nada |
| Candidato deprecado | §8.1 no lo congela automáticamente como candidato futuro; medirlo gasta presupuesto en un ganador inutilizable |
| Candidato que la corrida mide y el refresco no cubre | Medir sin reverificar es lo que §8.1 prohíbe |
| Alias sin snapshot y sin huella de comportamiento | Un alias puede cambiar de modelo por debajo sin avisar |
| Campo de política en `no_consultado` | Ver arriba |
| Refresco posterior al arranque de la corrida | Al revés no verifica lo que se midió |
| Antigüedad mayor que la ventana | Evidencia caducada |
| Candidato sin ninguna fuente documental | Sin URL, fecha y hash no hay evidencia: hay una afirmación |
| Fuente leída después del refresco que dice sustentarla | Sería fechar la evidencia antes de tenerla |

`verifiedAtFromRefresh()` deriva el `ModelBinding.verifiedAt` desde el refresco en vez de escribirlo
a mano: un binding con una fecha que ningún refresco respalda afirmaría una reverificación que nadie
hizo.

## Una regla compartida, no dos copias

La comprobación «alias sin snapshot exige huella» ya vivía en `assertBindingUsable`. El refresco la
necesita **antes** de que exista un binding, así que se extrajo a `assertPinnedIdentity()`.

La alternativa —construir en el refresco un `ModelBinding` de mentira solo para poder llamar a la
comprobación— obligaba a inventarle capacidades (`batch`, `caching`, `reasoning`) que el refresco
nunca afirma. **Un dato inventado dentro de la evidencia de reverificación es peor que no tenerla.**
Se detectó al escribir la prueba: el binding fabricado no validaba contra el contrato.

## Credenciales: dos por proveedor, no una

`credentialEnvVar(provider, profile)` produce `MODEL_CREDENTIAL_<PROVEEDOR>_<PERFIL>`. Los dos ejes
son necesarios por motivos distintos:

- **por perfil**, porque P-II §8.2 congela que `SESION` y `AUTORIA` usan credenciales separadas, y la
  separación solo protege si las cadenas son distintas de verdad — la pasarela está escrita para que
  quien tenga la de un perfil no tenga ningún camino hacia la del otro;
- **por proveedor**, porque durante BENCH-01/02 varios proveedores compiten por el *mismo* perfil.

`envCredentialResolver(provider)` es el **modo de arranque**, no el de destino: cuando Infisical esté
inicializado los servicios leen de ahí (T-H3-04). Una variable ausente o en blanco cuenta como
ausente y produce `MissingCredentialError`; nunca cae a la de otro perfil.

### Procedimiento para el propietario

1. En la consola del proveedor, crear **dos** claves sobre el mismo saldo (sin costo extra).
2. Pegarlas en `infra/compose/.env`, que **no se versiona**:

   ```
   MODEL_CREDENTIAL_ANTHROPIC_SESION=…
   MODEL_CREDENTIAL_ANTHROPIC_AUTORIA=…
   ```

3. OpenAI hace falta para BENCH-02 (`T-H4-11`): generador y crítico deben ser de familias distintas.
   Se puede empezar solo con Anthropic y dejar sus dos variables vacías.

## Lo que falta

- **La corrida del refresco no se ha hecho.** No hay ningún registro material: los del conjunto de
  pruebas son fixtures y lo declaran.
- **La ventana no está fijada.** Es una decisión de protocolo del propietario, no un valor por
  omisión.
- **Cargar el `.env` en el proceso del arnés** es de `T-H4-10`: hoy no hay benchmark que ejecutar.
