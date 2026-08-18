import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { stripCodeFence, validateModelOutput } from '../src/output.js';

/**
 * Política de bloque de código (T-H4-10 ← P-II §8.4).
 *
 * Medido en el piloto de BENCH-01 del 2026-08-18: `claude-haiku-4-5-20251001`
 * devolvió JSON válido envuelto en ```` ```json ```` en 14 de 14 casos, y
 * reforzar la instrucción de formato **no** lo corrigió. Sin autorizar el
 * desenvuelto, el gate de salidas estructuralmente utilizables mediría el
 * envoltorio y no al modelo.
 *
 * Lo que estas pruebas defienden es que la autorización sea **explícita** y que
 * el desenvuelto sea **conservador**: recortar por dentro convertiría una
 * respuesta con prosa alrededor en un JSON aparentemente limpio, y eso sí es un
 * fallo que el gate debe seguir contando.
 */

const schema = z.object({ ok: z.boolean() });
const salida = (text: string) => ({ kind: 'output' as const, text, rawStopReason: 'end_turn' });

const validar = (text: string, codeFence: 'reject' | 'unwrap') =>
  validateModelOutput({
    operation: 'explain_block' as const,
    bindingId: 'b1',
    outcome: salida(text),
    schema,
    attempt: 1,
    codeFence,
  });

describe('stripCodeFence', () => {
  it('retira la valla con etiqueta', () => {
    expect(stripCodeFence('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
  });

  it('retira la valla sin etiqueta', () => {
    expect(stripCodeFence('```\n{"ok":true}\n```')).toBe('{"ok":true}');
  });

  it('tolera espacio alrededor de la valla', () => {
    expect(stripCodeFence('  \n```json\n{"ok":true}\n```  \n')).toBe('{"ok":true}');
  });

  it('deja intacto un texto sin valla', () => {
    expect(stripCodeFence('{"ok":true}')).toBe('{"ok":true}');
  });

  it('no recorta por dentro: prosa alrededor sigue siendo prosa alrededor', () => {
    const conProsa = 'Claro, aquí tienes:\n```json\n{"ok":true}\n```\n¿Te sirve?';
    expect(stripCodeFence(conProsa)).toBe(conProsa);
  });

  it('no toca una valla abierta sin cerrar', () => {
    expect(stripCodeFence('```json\n{"ok":true}')).toBe('```json\n{"ok":true}');
  });

  it('no toca una apertura con algo que no es una etiqueta de lenguaje', () => {
    const raro = '```json y además esto\n{"ok":true}\n```';
    expect(stripCodeFence(raro)).toBe(raro);
  });

  it('no confunde una valla de una sola línea', () => {
    expect(stripCodeFence('```{"ok":true}```')).toBe('```{"ok":true}```');
  });
});

describe('la política es explícita', () => {
  it('con reject, la valla es violación de esquema', () => {
    const r = validar('```json\n{"ok":true}\n```', 'reject');
    expect(r.classification).toBe('schema_violation');
  });

  it('con unwrap, el mismo texto valida', () => {
    const r = validar('```json\n{"ok":true}\n```', 'unwrap');
    expect(r.classification).toBe('valid');
    expect(r.data).toEqual({ ok: true });
  });

  it('unwrap no salva una salida que además viene con prosa', () => {
    const r = validar('Aquí tienes:\n```json\n{"ok":true}\n```', 'unwrap');
    expect(r.classification).toBe('schema_violation');
  });

  it('unwrap no salva un JSON que no cumple el esquema', () => {
    const r = validar('```json\n{"ok":"sí"}\n```', 'unwrap');
    expect(r.classification).toBe('schema_violation');
  });

  it('el bruto del envelope conserva la valla: desenvolver es para parsear', () => {
    const conValla = '```json\n{"ok":true}\n```';
    const r = validar(conValla, 'unwrap');
    expect(r.envelope.rawOutput).toBe(conValla);
  });

  it('ninguna política convierte un truncamiento en violación de esquema', () => {
    const r = validateModelOutput({
      operation: 'explain_block',
      bindingId: 'b1',
      outcome: { kind: 'truncated', text: '```json\n{"ok":', rawStopReason: 'max_tokens' },
      schema,
      attempt: 1,
      codeFence: 'unwrap',
    });
    expect(r.classification).toBe('truncated');
  });
});
