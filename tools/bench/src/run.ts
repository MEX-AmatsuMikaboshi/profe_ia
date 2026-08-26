import { createHash } from 'node:crypto';

import { fragmentHandle } from '@profesor-ia/contracts';
import type { CostEvent, ModelBinding, PricingManifest } from '@profesor-ia/contracts';
import {
  FrozenAssetMissingError,
  TransportError,
  assertRefreshAuthorizesBenchmark,
  priceCall,
  type BudgetController,
  type CodeFencePolicy,
  type CostLedger,
  type ModelGateway,
  type DegradedProfile,
  type ProviderUsage,
  type UnpinnedIdentityWaiver,
  type ValidatedOutput,
} from '@profesor-ia/model-gateway';
import type { ZodType } from 'zod';

import type {
  BenchCase,
  CaseSetPurpose,
  FaultObservation,
  InjectedFault,
  PartitionedCaseSet,
} from './case-set.js';
import type { ContentPackage } from './corpus.js';

/**
 * Runner de BENCH-01 (T-H4-10 ← P-III §6.1/§6.2).
 *
 * Es el único punto de todo el repositorio donde se gasta dinero, así que las
 * propiedades que defiende no son de medición sino de freno:
 *
 * 1. **El presupuesto se comprueba antes de cada llamada facturable**, no
 *    después. Comprobar después registra el gasto que ya se hizo; el bloqueo de
 *    `OWNER-BUDGET-001` existe para que no se haga.
 * 2. **El refresco documental autoriza la corrida antes de la primera llamada.**
 *    Si la evidencia caducó, el gasto no ha empezado todavía.
 * 3. **El reintento es único y se cuenta.** P-III §6.2 mide «utilizables después
 *    de un reintento»; un reintento invisible falsearía tanto la tasa como el
 *    costo. El transporte no reintenta por su cuenta justamente para que el
 *    único reintento del sistema esté aquí, contado.
 * 4. **Un uso no reportado detiene la corrida.** Sin tokens no hay costo, y
 *    seguir gastando sin poder tarifar es gastar a ciegas. No se asume cero.
 * 5. **El plan se congela antes de evaluación.** Tamaño y repeticiones se fijan
 *    antes de mirar resultados (P-III §6.1); si el plan se congelara después,
 *    elegir el número de repeticiones sería elegir el resultado.
 * 6. **Un caso que declara una caída no puede correr como si nada.** Si el
 *    conjunto trae fallos inyectados y el candidato no sabe producirlos, la
 *    corrida se detiene antes de empezar. Dejarla correr mediría respuestas
 *    normales y daría por aprobado el gate de recuperación —que es de 100 % y
 *    bloqueante— sin haber simulado una sola caída: el gate pasaría por vacío,
 *    que es exactamente el defecto que el piloto del 2026-08-18 tuvo.
 */

export class BenchRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface Candidate {
  readonly candidateId: string;
  readonly binding: ModelBinding;
  readonly gateway: ModelGateway;
  /**
   * Pasarela que **produce** el fallo pedido, para la familia
   * `failure_or_invalid_output`.
   *
   * La fábrica la aporta quien arma el candidato y no el runner, y eso es una
   * frontera, no una comodidad: sintetizar una respuesta con forma de caída
   * exige saber la forma de la respuesta de **ese** proveedor, y ese
   * conocimiento vive en el adaptador y en quien lo elige. Si el runner la
   * fabricara, tendría una segunda copia del contrato del proveedor, que es lo
   * que se descubre roto el día que el proveedor lo cambia.
   *
   * El fallo se inyecta **por debajo de la pasarela**, no en lugar de ella:
   * así se ejercitan las rutas reales —traducción del adaptador, clasificación
   * y reintento único— que es lo que el gate dice medir.
   */
  readonly faultyGatewayFor?: (fault: InjectedFault) => ModelGateway;
}

/**
 * Plan congelado antes de evaluación. `frozenAt` no es decorativo: se compara
 * contra `startedAt` y una corrida cuyo plan se congeló después de empezar
 * queda rechazada.
 */
export interface RunPlan {
  readonly runId: string;
  readonly purpose: CaseSetPurpose;
  readonly repetitions: number;
  readonly frozenAt: string;
  readonly startedAt: string;
  /**
   * Semilla de la partición desarrollo/evaluación de §8.5 (D-80).
   *
   * Se declara en el plan y viaja al informe. Antes vivía como literal en
   * `bin.ts` y **no se registraba en ninguna parte**: dos corridas con
   * particiones distintas producían informes indistinguibles, y reproducir una
   * exigía leer el código de la versión con la que se corrió.
   */
  readonly partitionSeed: number;
  /**
   * SHA-256 de las instrucciones de sistema con las que se corrió (D-80).
   *
   * Es la respuesta a «¿con qué prompt salió este número?». D-77 y D-79
   * cambiaron el prompt entre dos corridas del mismo conjunto: sin esta huella,
   * comparar sus porcentajes sería comparar dos experimentos distintos creyendo
   * que son el mismo. Es la misma lección de D-73 sobre el refresco documental,
   * aplicada a la otra entrada de la corrida.
   */
  readonly instructionsSha256: string;
}

export interface RunDependencies {
  readonly ledger: CostLedger;
  readonly budget: BudgetController;
  readonly manifest: PricingManifest;
  /** Registro del refresco documental (T-H4-09) y su ventana. */
  readonly refreshRecord: unknown;
  readonly refreshWindow: unknown;
  /**
   * Renuncias a la identidad fijada, por candidato (T-H4-02).
   *
   * Se pasan tal cual a `assertRefreshAuthorizesBenchmark()`, **que las rechaza
   * en una corrida material**. Aquí no se filtran ni se validan: duplicar esa
   * regla dejaría dos sitios donde relajarla, y el que corre más tarde gana.
   */
  readonly unpinnedIdentityWaivers?: readonly UnpinnedIdentityWaiver[];
  /**
   * Perfil degradado con los activos congelados del paquete de contenido.
   *
   * Obligatorio en cuanto el conjunto trae una sola caída: sin él la corrida
   * mediría que el reintento falló y nada más, y el gate de recuperación —100 %
   * y bloqueante— se apoyaría en una ruta que nunca se ejecutó. Lo comprueba
   * `assertDegradedProfileAvailable()` antes de la primera llamada.
   */
  readonly degraded?: DegradedProfile;
  /** Versión del material del que salen los activos; viaja al informe. */
  readonly degradedAssetVersion?: string;
  /**
   * Paquete de contenido del que salen los fragmentos autorizados.
   *
   * Obligatorio en cuanto haya un caso que declare bloque: los fragmentos se
   * envían con la pregunta —es el paso «fragmentos» del bucle W7— y sin ellos
   * el modelo no tiene contra qué anclar. Lo comprueba
   * `assertAnchorFragmentsAvailable()` antes de la primera llamada.
   */
  readonly contentPackage?: ContentPackage;
  /** Esquema local contra el que se valida cada salida (T-H4-03). */
  readonly schema: ZodType<unknown>;
  /**
   * Política de bloque de código, declarada por la corrida (T-H4-03). Es de la
   * corrida y no del caso: si un caso desenvolviera y otro no, la tasa de
   * salidas utilizables mezclaría dos criterios distintos.
   */
  readonly codeFence: CodeFencePolicy;
  /** Instrucciones de sistema; el runner no redacta contenido pedagógico. */
  readonly instructions: string;
  /**
   * Parámetros solicitados por llamada (T-H4-02). Los contrasta la pasarela
   * contra `ModelCapabilities`; van aquí porque son de la corrida, no del caso:
   * dos casos con distinto `max_tokens` no serían comparables.
   */
  readonly parameters?: Readonly<Record<string, unknown>>;
  /**
   * Observador de resultados, llamado en cuanto cada caso termina.
   *
   * **No decide nada y no puede cambiar nada**: recibe el resultado ya
   * construido y su valor de retorno se ignora. Existe para que quien corra
   * pueda ir escribiendo la evidencia a disco, y el motivo es concreto: la
   * corrida material son más de mil llamadas seguidas y el runner **falla
   * cerrado** ante un error de proveedor —a propósito, «no se asume cero»—, así
   * que un 529 en la llamada novecientos tiraría la corrida entera con el gasto
   * ya hecho y sin una sola línea de evidencia que enseñar. Anotar lo observado
   * no rebaja ningún freno; sólo impide que lo ya pagado se pierda.
   *
   * Si el observador lanza, **la corrida sigue**: un fallo escribiendo la
   * bitácora no es motivo para tirar una corrida facturada.
   */
  readonly onOutcome?: (outcome: CaseOutcome) => void;
}

/**
 * Qué hizo el sistema con la caída, una vez agotado el reintento único.
 *
 * Se registra el **activo servido**, no un booleano: un `true` no dejaría
 * comprobar después que lo que continuó la clase salió del banco congelado y no
 * de un texto de relleno, y ese es justo el hecho que el gate de recuperación
 * —100 % y bloqueante— dice medir (P-II §8.6).
 */
export type DegradedRecovery =
  | {
      readonly recovered: true;
      readonly blockId: string;
      readonly assetKind: 'explicacion';
      readonly assetKey: string;
      readonly assetVersion: string;
      readonly assetChars: number;
    }
  | { readonly recovered: false; readonly blockId: string; readonly reason: string };

export interface CaseOutcome {
  readonly caseId: string;
  readonly candidateId: string;
  readonly repetition: number;
  /**
   * Ausente cuando no hubo respuesta que clasificar: una conexión cortada o un
   * timeout no producen ninguna. Rellenarlo con `provider_error` escondería la
   * causa detrás de la consecuencia, que es lo que P-II §8.4 prohíbe al hablar
   * de truncamientos disfrazados de fallo de esquema.
   */
  readonly classification?: ValidatedOutput<unknown>['classification'];
  /** Sólo en casos con fallo inyectado: qué se observó frente a lo declarado. */
  readonly faultObservation?: FaultObservation;
  /** Intentos consumidos: 1, o 2 cuando hubo el reintento único. */
  readonly attempts: number;
  /**
   * Ausente en los casos con caída simulada: no hubo llamada al proveedor, así
   * que no hay unidades facturadas que reportar. **No se pone en ceros**: este
   * módulo rechaza un `usage` ausente precisamente porque un cero fabricado
   * haría parecer la corrida más barata de lo que fue, y fabricarlo aquí sería
   * cometer ese error desde dentro.
   */
  readonly usage?: ProviderUsage;
  readonly costMxn: number;
  /**
   * Lo que el modelo respondió, ya validado. **Sin esto no hay gates**: fugas
   * de solución, preguntas fuera de corpus e invenciones de reglas se miden
   * sobre el contenido, no sobre la clasificación. Un benchmark que descarta la
   * respuesta sólo sabe decir si parseó.
   */
  readonly data?: unknown;
  /**
   * Texto bruto tal como llegó, incluso cuando la salida se descartó. Es lo
   * único que permite auditar después por qué un caso se clasificó como se
   * clasificó, y P-II §8.4 exige conservarlo pase lo que pase.
   *
   * **Es el del último intento.** Para los gates cuya unidad de análisis es la
   * «solicitud inicial» hay que mirar `initialRawOutput`.
   */
  readonly rawOutput: string;
  /**
   * Texto bruto del **primer** intento, conservado aparte.
   *
   * Sin esto, dos de los seis gates de P-III §6.2 no se pueden medir: fugas de
   * solución e invenciones de reglas congelan como unidad la **solicitud
   * inicial**, y un reintento limpio borraría la evidencia de lo que la primera
   * respuesta dijo. Medir el reintento y llamarlo «solicitud inicial» daría por
   * bueno justo el caso que el gate existe para cazar — el de cero fallos y
   * bloqueante.
   */
  readonly initialRawOutput: string;
  /** Clasificación del primer intento; ausente si no hubo respuesta. */
  readonly initialClassification?: ValidatedOutput<unknown>['classification'];
  /**
   * Sólo en casos con caída declarada. **Ausente no significa «no recuperó»**:
   * significa que el caso no ejercitó la ruta degradada, y `scoring.ts`
   * distingue las dos cosas en vez de contar la ausencia como fallo.
   */
  readonly degradedRecovery?: DegradedRecovery;
}

export interface RunResult {
  readonly runId: string;
  readonly purpose: CaseSetPurpose;
  readonly outcomes: readonly CaseOutcome[];
  readonly totalCostMxn: number;
  /** Lo que el piloto existe para responder. */
  readonly costPerCaseMxn: number;
  readonly ageSecondsByCandidate: Readonly<Record<string, number>>;
  /** Proveniencia de la corrida (D-80): con qué partición y con qué prompt. */
  readonly partitionSeed: number;
  readonly instructionsSha256: string;
}

function assertPlanFrozenBeforeStart(plan: RunPlan): void {
  const congelado = Date.parse(plan.frozenAt);
  const arranque = Date.parse(plan.startedAt);
  if (Number.isNaN(congelado) || Number.isNaN(arranque)) {
    throw new BenchRunError(
      `El plan ${plan.runId} trae fechas ilegibles (frozenAt=${plan.frozenAt}, ` +
        `startedAt=${plan.startedAt}).`,
    );
  }
  if (congelado > arranque) {
    throw new BenchRunError(
      `El plan ${plan.runId} se congeló después de arrancar. Fijar tamaño y repeticiones ` +
        'mirando resultados es elegir el resultado (P-III §6.1).',
    );
  }
  if (plan.repetitions < 1 || !Number.isInteger(plan.repetitions)) {
    throw new BenchRunError(
      `Repeticiones inválidas (${String(plan.repetitions)}): debe ser un entero ≥ 1.`,
    );
  }
  if (!Number.isInteger(plan.partitionSeed)) {
    throw new BenchRunError(
      `Semilla de partición inválida (${String(plan.partitionSeed)}): debe ser un entero. La ` +
        'partición de §8.5 no puede depender de un valor que nadie declaró.',
    );
  }
}

/**
 * La huella del plan tiene que ser la de las instrucciones que de verdad se
 * envían (D-80).
 *
 * Sin esta comprobación el campo sería decorativo: dos copias del mismo hecho, y
 * la que se queda vieja es siempre la copia. Un informe que declara una huella
 * que no corresponde a su prompt es peor que uno sin huella, porque invita a
 * comparar dos experimentos distintos creyendo que son el mismo.
 */
function assertInstructionsDigestMatches(plan: RunPlan, instructions: string): void {
  const real = sha256(instructions);
  if (real !== plan.instructionsSha256) {
    throw new BenchRunError(
      `El plan ${plan.runId} declara instructionsSha256=${plan.instructionsSha256} y las ` +
        `instrucciones que se van a enviar hashean ${real}. Una huella que no corresponde a su ` +
        'prompt hace incomparables dos corridas sin avisar.',
    );
  }
}

/** SHA-256 en hexadecimal, el mismo patrón que el resto del repositorio. */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function usageOrFail(
  validado: ValidatedOutput<unknown>,
  caso: BenchCase,
  candidato: Candidate,
): ProviderUsage {
  if (validado.usage !== undefined) return validado.usage;

  // Un error de proveedor **no se reporta como «faltan tokens»**: la causa real
  // es el error, y esconderla detrás de la consecuencia es exactamente lo que
  // P-II §8.4 prohíbe al hablar de truncamientos disfrazados de fallo de
  // esquema. El cuerpo entra en el mensaje porque sin él no se depura nada.
  if (validado.classification === 'provider_error') {
    throw new BenchRunError(
      `${candidato.candidateId} devolvió un error de proveedor en el caso ${caso.caseId}: ` +
        `${validado.envelope.rawOutput}`,
    );
  }

  throw new BenchRunError(
    `${candidato.candidateId} no reportó unidades facturadas en el caso ${caso.caseId} ` +
      `(clasificación ${validado.classification}). Sin tokens no hay costo, y seguir gastando ` +
      'sin poder tarifar es gastar a ciegas. No se asume cero: un cero fabricado haría parecer ' +
      'la corrida más barata de lo que fue.',
  );
}

/**
 * Que todo caso con caída declarada tenga quien la produzca, **antes** de la
 * primera llamada.
 *
 * Se comprueba de golpe y no caso por caso a propósito: descubrirlo a mitad de
 * la corrida dejaría medio benchmark cobrado y sin dictamen, y la corrida
 * material es el único punto del repositorio donde eso cuesta dinero.
 */
function assertFaultInjectorsAvailable(
  casos: readonly BenchCase[],
  candidates: readonly Candidate[],
): void {
  const conFallo = casos.filter((c) => c.injectedFault !== undefined);
  if (conFallo.length === 0) return;

  const sinInyector = candidates.filter((c) => c.faultyGatewayFor === undefined);
  if (sinInyector.length > 0) {
    throw new BenchRunError(
      `El conjunto trae ${String(conFallo.length)} casos con caída simulada y los candidatos ` +
        `${sinInyector.map((c) => c.candidateId).join(', ')} no declaran cómo producirla. ` +
        'Correrlos como preguntas normales daría por aprobado el gate de recuperación —100 % y ' +
        'bloqueante— sin haber simulado una sola caída: el gate pasaría por vacío (P-III §6.1).',
    );
  }
}

/**
 * Que haya fragmentos para todo caso que declare bloque, **antes** de la
 * primera llamada.
 *
 * Un bloque sin fragmentos dejaría la pregunta sin material contra el que
 * anclar, y todas las anclas de esa respuesta serían irresolubles por
 * construcción: el gate mediría el harness y no al candidato. Descubrirlo a
 * mitad de corrida dejaría medio benchmark cobrado.
 */
function assertAnchorFragmentsAvailable(
  casos: readonly BenchCase[],
  deps: RunDependencies,
): void {
  const conBloque = casos.filter((c) => c.blockId !== undefined);
  if (conBloque.length === 0) return;
  const paquete = deps.contentPackage;
  if (paquete === undefined) {
    throw new BenchRunError(
      `El conjunto trae ${String(conBloque.length)} casos con bloque declarado y la corrida no ` +
        'aporta paquete de contenido. Sin fragmentos que enviar, toda ancla de la respuesta es ' +
        'irresoluble y el gate de anclas mediría el harness (P-II §8.3).',
    );
  }
  const huerfanos = [
    ...new Set(
      conBloque
        .map((c) => c.blockId as string)
        .filter((bloque) => (paquete.authorizedFragmentsByBlock.get(bloque) ?? []).length === 0),
    ),
  ];
  if (huerfanos.length > 0) {
    throw new BenchRunError(
      `El paquete \`${paquete.assetVersion}\` no tiene fragmentos autorizados para ` +
        `${huerfanos.join(', ')}, y hay casos que los declaran. Un bloque vacío haría cero por ` +
        'construcción el gate de anclas de esos casos.',
    );
  }
}

/**
 * Compone lo que se le envía al modelo: la pregunta del caso más los fragmentos
 * autorizados de su bloque.
 *
 * **Los fragmentos los pone el harness, no el caso.** Son contenido del paquete
 * y cambian cuando cambia el corpus; escribirlos en los 200 casos crearía una
 * copia del corpus que se queda vieja. Y no se envía nada más: la entrada de
 * sesión es una whitelist (P-II §8.3), y este es su equivalente de benchmark.
 */
function componerEntrada(caso: BenchCase, deps: RunDependencies): string {
  const bloque = caso.blockId;
  if (bloque === undefined) return caso.input;
  const fragmentos = deps.contentPackage?.authorizedFragmentsByBlock.get(bloque) ?? [];
  if (fragmentos.length === 0) {
    throw new BenchRunError(
      `El caso ${caso.caseId} declara el bloque ${bloque} y la corrida no trae fragmentos para ` +
        'él. `assertAnchorFragmentsAvailable()` debería haberlo parado antes de correr.',
    );
  }
  // Se presenta el **mango** y no el identificador canónico (D-77). El canónico
  // son ~105 caracteres con espacio, paréntesis, dos `@`, dos `#` y una barra:
  // copiar eso literalmente en cada ancla es lo que hundió el gate en la corrida
  // del 2026-08-23. El validador sigue aceptando los dos.
  return [
    `Bloque autorizado: ${bloque}`,
    'Fragmentos autorizados (ancla copiando el mango exacto de la izquierda):',
    ...fragmentos.map((f) => `- ${fragmentHandle(f.fragmentId)}: ${f.text}`),
    '',
    `Alumno: ${caso.input}`,
  ].join('\n');
}

/**
 * Que exista el perfil degradado en cuanto haya una sola caída declarada,
 * **antes** de la primera llamada.
 *
 * Mismo motivo que el inyector de fallos, por el otro extremo de la ruta: sin
 * inyector no hay caída que medir; sin perfil degradado hay caída y no hay
 * continuación, y el gate de recuperación se computaría sobre una ruta que el
 * sistema no tiene. Que el gate sea de 100 % y bloqueante es justo lo que hace
 * inaceptable descubrirlo a mitad de corrida.
 */
function assertDegradedProfileAvailable(
  casos: readonly BenchCase[],
  deps: RunDependencies,
): void {
  const conFallo = casos.filter((c) => c.injectedFault !== undefined);
  if (conFallo.length === 0) return;
  if (deps.degraded === undefined) {
    throw new BenchRunError(
      `El conjunto trae ${String(conFallo.length)} casos con caída simulada y la corrida no ` +
        'declara perfil degradado. P-II §8.6 define la continuidad ante caída sobre activos ' +
        'congelados: sin ellos la corrida sólo mediría que el reintento falló, y el gate de ' +
        'recuperación —100 % y bloqueante— se apoyaría en una ruta que no se ejecutó.',
    );
  }
}

/**
 * Continúa con contenido congelado tras agotar el reintento único.
 *
 * **Un activo ausente no se disfraza de recuperación fallida silenciosa**: se
 * registra con su motivo y cuenta como fallo del gate, que es lo que es. Y no
 * se rellena con texto genérico: `DegradedProfile` lanza a propósito, porque un
 * relleno haría pasar por «el núcleo respondió» algo que no estaba y el perfil
 * dejaría de servir para aislar si el fallo vino del modelo o del núcleo.
 */
function continuarDegradado(caso: BenchCase, deps: RunDependencies): DegradedRecovery {
  const bloque = caso.degradedBlockId;
  if (bloque === undefined) {
    throw new BenchRunError(
      `El caso ${caso.caseId} declara caída y no declara bloque degradado. ` +
        '`assertFaultDeclarationCoherent()` debería haberlo parado antes de correr.',
    );
  }
  const perfil = deps.degraded;
  if (perfil === undefined) {
    throw new BenchRunError(
      `La corrida no declara perfil degradado y el caso ${caso.caseId} cayó. ` +
        '`assertDegradedProfileAvailable()` debería haberlo parado antes de correr.',
    );
  }
  try {
    const activo = perfil.asset('explicacion', bloque);
    return {
      recovered: true,
      blockId: bloque,
      assetKind: 'explicacion',
      assetKey: bloque,
      assetVersion: activo.freezeVersion,
      assetChars: activo.text.length,
    };
  } catch (error) {
    if (error instanceof FrozenAssetMissingError) {
      return { recovered: false, blockId: bloque, reason: error.message };
    }
    throw error;
  }
}

/**
 * Ejecuta un caso con fallo inyectado. **No sale a la red y no factura**: la
 * caída se sintetiza, así que no hay tokens que tarifar ni presupuesto que
 * consumir. Por eso tampoco pasa por `assertBillableAllowed()`: ese freno
 * existe para lo que se cobra, y aquí no se cobra nada.
 */
async function ejecutarCaida(
  caso: BenchCase,
  fault: InjectedFault,
  candidato: Candidate,
  deps: RunDependencies,
  repeticion: number,
): Promise<CaseOutcome> {
  const fabrica = candidato.faultyGatewayFor;
  if (fabrica === undefined) {
    throw new BenchRunError(
      `${candidato.candidateId} no declara cómo producir la caída del caso ${caso.caseId}.`,
    );
  }
  const pasarela = fabrica(fault);

  const intentar = async (attempt: number): Promise<{
    observation: FaultObservation;
    classification?: ValidatedOutput<unknown>['classification'];
    rawOutput: string;
  }> => {
    try {
      const validado = await pasarela.execute({
        operation: caso.operation,
        instructions: deps.instructions,
        input: caso.input,
        schema: deps.schema,
        codeFence: deps.codeFence,
        attempt,
        ...(deps.parameters === undefined ? {} : { parameters: deps.parameters }),
      });
      if (validado.classification === 'valid') {
        // La inyección no ocurrió. Registrarlo como un caso que pasó sería
        // decir que el sistema se recuperó de una caída que nunca hubo.
        throw new BenchRunError(
          `El caso ${caso.caseId} declara la caída ${fault.kind} y la pasarela devolvió una ` +
            'salida válida: el fallo no se inyectó. Un gate de recuperación medido sobre ' +
            'respuestas normales no mide nada.',
        );
      }
      return {
        observation: validado.classification,
        classification: validado.classification,
        rawOutput: validado.envelope.rawOutput,
      };
    } catch (error) {
      if (error instanceof TransportError) {
        return { observation: 'transport_failure', rawOutput: error.message };
      }
      throw error;
    }
  };

  const primero = await intentar(1);
  // El reintento único de P-III §6.2 también se ejerce aquí: recuperarse es
  // justamente lo que esta familia mide, y un reintento que no se ejecuta no
  // demuestra que la ruta de reintento funcione.
  const segundo = await intentar(2);

  // La continuación degradada se intenta **después** del reintento único, no en
  // su lugar: caer al modo degradado ante el primer fallo escondería que el
  // reintento habría bastado, y P-III §6.2 mide las dos cosas por separado.
  const degradedRecovery = continuarDegradado(caso, deps);

  return {
    caseId: caso.caseId,
    candidateId: candidato.candidateId,
    repetition: repeticion,
    ...(segundo.classification === undefined ? {} : { classification: segundo.classification }),
    ...(primero.classification === undefined ? {} : { initialClassification: primero.classification }),
    initialRawOutput: primero.rawOutput,
    faultObservation: segundo.observation,
    degradedRecovery,
    attempts: 2,
    // Costo cero **medido**, no supuesto: la caída se sintetiza y no se abre
    // ninguna conexión, así que no hay nada que tarifar.
    costMxn: 0,
    rawOutput: segundo.rawOutput,
  };
}

/**
 * Ejecuta la corrida. Cada llamada pasa por el gate de presupuesto **antes** de
 * salir a la red, y el costo entra al ledger inmediatamente después, para que
 * la siguiente comprobación vea el gasto ya hecho.
 */
export async function runBenchmark(
  plan: RunPlan,
  partition: PartitionedCaseSet,
  candidates: readonly Candidate[],
  deps: RunDependencies,
): Promise<RunResult> {
  assertPlanFrozenBeforeStart(plan);
  assertInstructionsDigestMatches(plan, deps.instructions);

  if (plan.purpose !== partition.purpose) {
    throw new BenchRunError(
      `El plan es ${plan.purpose} y el conjunto ${partition.purpose}. Mezclarlos dejaría que ` +
        'un conjunto piloto alimentara una corrida material, o al revés.',
    );
  }
  if (candidates.length === 0) {
    throw new BenchRunError('Una corrida sin candidatos no mide nada.');
  }

  assertFaultInjectorsAvailable([...partition.development, ...partition.evaluation], candidates);
  assertDegradedProfileAvailable([...partition.development, ...partition.evaluation], deps);
  assertAnchorFragmentsAvailable([...partition.development, ...partition.evaluation], deps);

  // Antes de la primera llamada, y por tanto antes del primer peso gastado.
  const autorizacion = assertRefreshAuthorizesBenchmark(deps.refreshRecord, deps.refreshWindow, {
    runId: plan.runId,
    startedAt: plan.startedAt,
    candidateIds: candidates.map((c) => c.candidateId),
    purpose: plan.purpose === 'material' ? 'material' : 'test_fixture',
    ...(deps.unpinnedIdentityWaivers === undefined
      ? {}
      : { unpinnedIdentityWaivers: deps.unpinnedIdentityWaivers }),
  });

  deps.ledger.registerManifest(deps.manifest);

  const casos = [...partition.development, ...partition.evaluation];
  const outcomes: CaseOutcome[] = [];
  let totalCostMxn = 0;
  let secuencia = 0;

  for (const candidato of candidates) {
    for (const caso of casos) {
      for (let repeticion = 1; repeticion <= plan.repetitions; repeticion += 1) {
        // Los casos con caída simulada van por su propia rama: no salen a la
        // red, no facturan y su reintento se ejerce igual.
        if (caso.injectedFault !== undefined) {
          const resultado = await ejecutarCaida(caso, caso.injectedFault, candidato, deps, repeticion);
          outcomes.push(resultado);
          anotar(deps, resultado);
          continue;
        }

        // El freno, antes de la red. Lanza `BudgetBlockedError` si toca.
        deps.budget.assertBillableAllowed();

        const entrada = componerEntrada(caso, deps);
        let validado = await candidato.gateway.execute({
          operation: caso.operation,
          instructions: deps.instructions,
          input: entrada,
          schema: deps.schema,
          codeFence: deps.codeFence,
          attempt: 1,
          ...(deps.parameters === undefined ? {} : { parameters: deps.parameters }),
        });
        let intentos = 1;
        const inicial = {
          rawOutput: validado.envelope.rawOutput,
          classification: validado.classification,
        };
        let usage = usageOrFail(validado, caso, candidato);
        let costoDelCaso = registrar(deps, plan, candidato, usage, intentos, secuencia++);

        // El reintento único de P-III §6.2. Se vuelve a comprobar presupuesto:
        // el intento anterior ya gastó y pudo cruzar el umbral.
        if (validado.classification !== 'valid') {
          deps.budget.assertBillableAllowed();
          validado = await candidato.gateway.execute({
            operation: caso.operation,
            instructions: deps.instructions,
            input: entrada,
            schema: deps.schema,
            codeFence: deps.codeFence,
            attempt: 2,
            ...(deps.parameters === undefined ? {} : { parameters: deps.parameters }),
          });
          intentos = 2;
          const usageReintento = usageOrFail(validado, caso, candidato);
          costoDelCaso += registrar(deps, plan, candidato, usageReintento, intentos, secuencia++);
          usage = sumarUso(usage, usageReintento);
        }

        totalCostMxn += costoDelCaso;
        const resultado: CaseOutcome = {
          caseId: caso.caseId,
          candidateId: candidato.candidateId,
          repetition: repeticion,
          classification: validado.classification,
          attempts: intentos,
          usage,
          costMxn: costoDelCaso,
          ...(validado.classification === 'valid' ? { data: validado.data } : {}),
          rawOutput: validado.envelope.rawOutput,
          initialRawOutput: inicial.rawOutput,
          initialClassification: inicial.classification,
        };
        outcomes.push(resultado);
        anotar(deps, resultado);
      }
    }
  }

  return {
    runId: plan.runId,
    purpose: plan.purpose,
    outcomes,
    totalCostMxn,
    costPerCaseMxn: outcomes.length === 0 ? 0 : totalCostMxn / outcomes.length,
    ageSecondsByCandidate: autorizacion.ageSecondsByCandidate,
    partitionSeed: plan.partitionSeed,
    instructionsSha256: plan.instructionsSha256,
  };
}

/**
 * Avisa al observador, si lo hay. **Un fallo suyo no tira la corrida**: la
 * bitácora es evidencia de lo que ya se pagó, y perder la corrida por no poder
 * escribirla sería cambiar un problema por otro peor.
 */
function anotar(deps: RunDependencies, outcome: CaseOutcome): void {
  const observador = deps.onOutcome;
  if (observador === undefined) return;
  try {
    observador(outcome);
  } catch {
    // Intencionalmente vacío: ver arriba.
  }
}

function sumarUso(a: ProviderUsage, b: ProviderUsage): ProviderUsage {
  const cache = (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0);
  const base = {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
  // Sólo se declara la caché si alguno de los dos la reportó: sumar dos
  // ausencias no produce un cero medido.
  return a.cachedInputTokens === undefined && b.cachedInputTokens === undefined
    ? base
    : { ...base, cachedInputTokens: cache };
}

function registrar(
  deps: RunDependencies,
  plan: RunPlan,
  candidato: Candidate,
  usage: ProviderUsage,
  attempt: number,
  secuencia: number,
): number {
  const precio = priceCall(deps.manifest, {
    provider: candidato.binding.provider,
    modelId: candidato.binding.modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    audioSeconds: 0,
    images: 0,
    requests: 0,
  });

  const evento: CostEvent = {
    costEventId: `${plan.runId}-${String(secuencia)}`,
    occurredAt: plan.startedAt,
    stage: 'benchmark',
    provider: candidato.binding.provider,
    bindingId: candidato.binding.bindingId,
    pricingManifestId: deps.manifest.pricingManifestId,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    tokensCached: usage.cachedInputTokens ?? 0,
    audioSeconds: 0,
    images: 0,
    attempts: attempt,
    retries: attempt - 1,
    failures: 0,
    costCalculated: precio.costCalculated,
    currency: precio.currency,
  };
  deps.ledger.append(evento);
  return precio.costCalculated;
}
