import { z } from 'zod';
import { Id } from './primitives.js';

/**
 * Salida estructurada anclada — **transcripción literal de P-II §8.4** (I-7).
 *
 * El validador local rechaza (P-II §8.4):
 *  - anchors inexistentes;
 *  - texto que introduce símbolos no autorizados;
 *  - instrucciones que contradicen el cálculo;
 *  - solución o fragmentos canario;
 *  - salida fuera de esquema.
 *
 * La salida estructurada del proveedor **no es evidencia suficiente de
 * validez**: toda respuesta cruza un validador local independiente y el flujo
 * falla cerrado ante schema inválido, truncamiento, rechazo ambiguo o contrato
 * desconocido.
 */

/** Función del segmento — enum literal P-II §8.4. */
export const SegmentFunction = z.enum(['definition', 'explanation', 'example', 'transition']);
export type SegmentFunction = z.infer<typeof SegmentFunction>;

export const AnchoredSegment = z.object({
  text: z.string().min(1),
  /** Referencias a fragmentos autorizados; deben resolver (I-7). */
  anchors: z.array(z.string().min(1)),
  function: SegmentFunction,
});
export type AnchoredSegment = z.infer<typeof AnchoredSegment>;

/**
 * Entrada de sesión por whitelist — literal P-II §8.3. No consulta tablas de
 * soluciones.
 */
export const SESSION_CONTEXT_WHITELIST = [
  'fragmentos_autorizados',
  'estado_minimo',
  'objetivo',
  'modo_pedagogico',
  'estrategia_seleccionada',
  'nivel_de_ayuda_permitido',
  'error_estructurado',
  'pista_seleccionada',
] as const;

/** Causas de rechazo del validador local (P-II §8.4). */
export const AnchorRejectionReason = z.enum([
  'anchor_inexistente',
  'simbolo_no_autorizado',
  'instruccion_contradice_calculo',
  'solucion_o_canario',
  'fuera_de_esquema',
]);
export type AnchorRejectionReason = z.infer<typeof AnchorRejectionReason>;

export const AnchoredOutput = z.object({
  operationId: Id,
  segments: z.array(AnchoredSegment).min(1),
  /** Bloque autorizado desde el que se construyó el contexto (P-II §8.3). */
  authorizedBlockId: Id,
});
export type AnchoredOutput = z.infer<typeof AnchoredOutput>;
