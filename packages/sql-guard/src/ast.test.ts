/**
 * Testes de regressao para `findDangerousFunctions` — deteccao estrutural.
 *
 * Garante que funcoes perigosas sao detectadas mesmo quando embrulhadas em
 * nós de tipo diferente de `function`/`aggr_func` (ex.: `window_func`, `cast`,
 * ou qualquer forma irregular que o parser possa produzir).
 *
 * Testa diretamente `findDangerousFunctions` com ASTs artesanais para
 * verificar a cobertura de tipos de no — sem depender do parser SQL real.
 */
import { describe, it, expect } from 'vitest';
import { findDangerousFunctions } from './ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Constroi um no de funcao do tipo canonico `function` (forma antiga). */
function fnNode(name: string, type = 'function'): Record<string, unknown> {
  return { type, name };
}

/** Constroi um no de funcao com name em forma de array de segmentos (forma 5.x). */
function fnNodeSegmented(
  name: string,
  type = 'function',
): Record<string, unknown> {
  return { type, name: [{ value: name }] };
}

// ---------------------------------------------------------------------------
// Deteccao por tipos canonicos (regressao — nao pode regredir)
// ---------------------------------------------------------------------------

describe('findDangerousFunctions — tipos canonicos (function / aggr_func)', () => {
  it('detecta pg_sleep em no type=function', () => {
    const ast = fnNode('pg_sleep');
    expect(findDangerousFunctions(ast)).toEqual(['pg_sleep']);
  });

  it('detecta pg_read_file em no type=function (name segmentado)', () => {
    const ast = fnNodeSegmented('pg_read_file');
    expect(findDangerousFunctions(ast)).toEqual(['pg_read_file']);
  });

  it('detecta pg_sleep em no type=aggr_func', () => {
    const ast = fnNode('pg_sleep', 'aggr_func');
    expect(findDangerousFunctions(ast)).toEqual(['pg_sleep']);
  });

  it('nao detecta funcao segura', () => {
    const ast = fnNode('count');
    expect(findDangerousFunctions(ast)).toEqual([]);
  });

  it('deduplicada e ordenada quando ha repetidos', () => {
    const ast = {
      type: 'select',
      columns: [fnNode('pg_sleep'), fnNode('pg_sleep'), fnNode('pg_read_file')],
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_read_file', 'pg_sleep']);
  });
});

// ---------------------------------------------------------------------------
// Deteccao estrutural — nós de tipo diferente (novos casos)
// ---------------------------------------------------------------------------

describe('findDangerousFunctions — deteccao estrutural (window_func e outros tipos)', () => {
  it('detecta pg_sleep embrulhado em no type=window_func com campo name', () => {
    // Simula window_func como alguns parsers produzem:
    // SELECT pg_sleep(1) OVER () — nó raiz é window_func com name: 'pg_sleep'
    const ast = {
      type: 'window_func',
      name: 'pg_sleep',
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_sleep']);
  });

  it('detecta pg_sleep embrulhado em window_func com campo function', () => {
    // Alternativa: { type: 'window_func', function: 'pg_sleep', ... }
    const ast = {
      type: 'window_func',
      function: 'pg_sleep',
      over: {},
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_sleep']);
  });

  it('detecta pg_read_file em no sem type reconhecivel (estrutural puro)', () => {
    // Um no sem type mas com name — deteccao estrutural cobre isto.
    const ast = {
      name: 'pg_read_file',
      args: [{ type: 'string', value: '/etc/passwd' }],
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_read_file']);
  });

  it('detecta funcao perigosa 3 niveis abaixo (subquery aninhado)', () => {
    const ast = {
      type: 'select',
      from: [
        {
          type: 'subquery',
          expr: {
            type: 'select',
            columns: [
              {
                type: 'cast',
                name: 'pg_read_file',
              },
            ],
          },
        },
      ],
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_read_file']);
  });

  it('nao detecta falso-positivo em no com name seguro qualquer', () => {
    const ast = {
      type: 'window_func',
      name: 'row_number',
    };
    expect(findDangerousFunctions(ast)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Regressoes especificas exigidas pela sabatina
// ---------------------------------------------------------------------------

describe('findDangerousFunctions — regressoes especificas', () => {
  it('detecta pg_sleep dentro de OVER() simulado (window function)', () => {
    // Representa: SELECT pg_sleep(1) OVER ()
    const ast = {
      type: 'select',
      columns: [
        {
          expr: {
            type: 'window_func',
            name: 'pg_sleep',
            args: { value: [{ type: 'number', value: 1 }] },
            over: { orderby: null, partition: null },
          },
          as: null,
        },
      ],
    };
    expect(findDangerousFunctions(ast)).toEqual(['pg_sleep']);
  });

  it('detecta pg_read_file em cast simulado (pg_read_file(...)::text)', () => {
    // Representa: SELECT pg_read_file('/etc/passwd')::text
    // O parser pode produzir: { type: 'cast', expr: { type: 'function', name: 'pg_read_file' } }
    const ast = {
      type: 'select',
      columns: [
        {
          expr: {
            type: 'cast',
            expr: {
              type: 'function',
              name: 'pg_read_file',
              args: { value: [{ type: 'string', value: '/etc/passwd' }] },
            },
            target: { dataType: 'text' },
          },
        },
      ],
    };
    // A funcao esta num no 'function' dentro do 'cast' — regressao que garante
    // que a travessia total ainda captura o no canonico filho.
    expect(findDangerousFunctions(ast)).toEqual(['pg_read_file']);
  });
});
