import { describe, expect, it } from 'vitest';

import {
  FRAGMENT_HANDLE_PATTERN,
  FragmentHandleCollisionError,
  buildFragmentHandleTable,
  fragmentHandle,
  fragmentHandleEntries,
} from '../src/fragment-handle.js';

/** El identificador canónico real del corpus vigente, con sus seis clases de carácter. */
const CANONICO =
  'forallx-yyc/tfl-deduccion-natural@master@ec34df8 (2025-12-18)#forallx-yyc-tfl.tex#truth-functional-logic';

describe('fragmentHandle (D-77)', () => {
  it('produce la forma F- más ocho dígitos hexadecimales', () => {
    expect(fragmentHandle(CANONICO)).toMatch(FRAGMENT_HANDLE_PATTERN);
  });

  it('es determinista: el mismo id da el mismo mango', () => {
    expect(fragmentHandle(CANONICO)).toBe(fragmentHandle(CANONICO));
  });

  it('acorta el identificador a diez caracteres', () => {
    // El motivo de existir de D-77, comprobado en vez de afirmado.
    expect(CANONICO.length).toBeGreaterThan(100);
    expect(fragmentHandle(CANONICO)).toHaveLength(10);
  });

  it('no contiene ninguna de las seis clases de carácter que invitaban al error', () => {
    const mango = fragmentHandle(CANONICO);
    for (const caracter of [' ', '(', ')', '@', '#', '/']) {
      expect(mango).not.toContain(caracter);
    }
  });

  it('es derivado y no correlativo: no depende del orden de la lista (D-17)', () => {
    const ids = [CANONICO, `${CANONICO}-b`, `${CANONICO}-c`];
    const directa = buildFragmentHandleTable(ids);
    const invertida = buildFragmentHandleTable([...ids].reverse());
    for (const id of ids) {
      expect(directa.get(fragmentHandle(id))).toBe(id);
      expect(invertida.get(fragmentHandle(id))).toBe(id);
    }
  });

  it('ids distintos dan mangos distintos, incluso si difieren en un carácter', () => {
    expect(fragmentHandle(CANONICO)).not.toBe(fragmentHandle(`${CANONICO}x`));
  });
});

describe('buildFragmentHandleTable', () => {
  it('resuelve el mango de vuelta al identificador canónico', () => {
    const tabla = buildFragmentHandleTable([CANONICO]);
    expect(tabla.get(fragmentHandle(CANONICO))).toBe(CANONICO);
  });

  it('tolera el mismo id repetido: es el mismo objeto, no una colisión', () => {
    expect(() => buildFragmentHandleTable([CANONICO, CANONICO])).not.toThrow();
    expect(buildFragmentHandleTable([CANONICO, CANONICO]).size).toBe(1);
  });

  it('falla cerrado ante una colisión real, no simulada', () => {
    // Control positivo. Una guarda sin un caso que la dispare pasa por vacío y
    // nadie sabe si detecta algo, así que aquí se busca una colisión **de
    // verdad** en vez de fabricar el error a mano: con 8 dígitos hexadecimales
    // el cumpleaños la encuentra en ~2^16 pruebas, que son milisegundos.
    // La búsqueda recorre enteros en orden, así que es determinista: el par que
    // encuentra es el mismo en cada corrida y en cada máquina.
    const vistos = new Map<string, string>();
    let par: readonly [string, string] | null = null;
    for (let i = 0; i < 1_000_000 && par === null; i += 1) {
      const id = `fragmento-sintetico-${i}`;
      const mango = fragmentHandle(id);
      const previo = vistos.get(mango);
      if (previo !== undefined) par = [previo, id];
      else vistos.set(mango, id);
    }

    expect(par).not.toBeNull();
    const [a, b] = par as readonly [string, string];
    // Que de verdad sea una colisión: dos ids distintos, un solo mango.
    expect(a).not.toBe(b);
    expect(fragmentHandle(a)).toBe(fragmentHandle(b));

    expect(() => buildFragmentHandleTable([a, b])).toThrow(FragmentHandleCollisionError);
    // Y el mensaje nombra a los dos, que es lo que hace accionable el fallo.
    expect(() => buildFragmentHandleTable([a, b])).toThrow(new RegExp(a));
  });

  it('el corpus vigente no colisiona — y la comprobación no pasa por vacío', () => {
    // Control negativo del control positivo: la guarda tiene que dejar pasar una
    // lista sana. Si esto fallara, `buildFragmentHandleTable` estaría lanzando
    // siempre y la prueba de arriba pasaría sin significar nada.
    const sanos = Array.from({ length: 656 }, (_, i) => `${CANONICO}#kc-${i}`);
    expect(() => buildFragmentHandleTable(sanos)).not.toThrow();
    expect(buildFragmentHandleTable(sanos).size).toBe(656);
  });
});

describe('fragmentHandleEntries', () => {
  it('ordena por mango, no por aparición', () => {
    const ids = [CANONICO, `${CANONICO}-b`, `${CANONICO}-c`];
    const directa = fragmentHandleEntries(ids).map((e) => e.handle);
    const invertida = fragmentHandleEntries([...ids].reverse()).map((e) => e.handle);
    expect(directa).toEqual(invertida);
    expect(directa).toEqual([...directa].sort((a, b) => a.localeCompare(b)));
  });
});
