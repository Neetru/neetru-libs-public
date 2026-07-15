/**
 * Cobertura fail-closed dos caminhos INTERNOS de `classifyOneStatement`
 * que dependem da forma do retorno de `astify` do node-sql-parser.
 *
 * Estes testes vivem num arquivo separado de `classify.test.ts` porque
 * `vi.mock('node-sql-parser', ...)` e module-scoped (hoisted): mockar o
 * parser aqui nao contamina os testes de parsing real do outro arquivo.
 *
 * Dois caminhos cobertos (Codex re-review, Fix A2):
 *  - `astify` devolve `[null]` (zero nos validos apos normalizacao) →
 *    `validNodes.length === 0` → fail-closed `destrutiva`.
 *  - `astify` devolve `[null, <DROP node valido>]` (mistura valido/invalido) →
 *    `validNodes.length !== nodes.length` → fail-closed `destrutiva`.
 *
 * `classify.ts` faz `import pkg from 'node-sql-parser'`, depois
 * `const { Parser } = pkg` e `new Parser().astify(sql, opts)`. O mock abaixo
 * espelha exatamente essa forma: default export com a classe `Parser`.
 */
import { describe, it, expect, vi } from 'vitest';

/** Controla, por teste, o que o `astify` mockado devolve. */
let astifyResult: unknown = null;

vi.mock('node-sql-parser', () => {
  class Parser {
    astify(): unknown {
      return astifyResult;
    }
  }
  // `classify.ts` usa `import pkg from 'node-sql-parser'` + `const { Parser } = pkg`
  // — ou seja, le `Parser` do default export. Expomos nas duas formas por seguranca.
  return { default: { Parser }, Parser };
});

// Import APOS o vi.mock — o vitest faz o hoist do mock, entao o modulo ja vem mockado.
const { classifyOneStatement, classifyMigration } = await import('./classify.js');

describe('fail-closed interno — astify devolve nos invalidos (Fix A2)', () => {
  it('astify → [null] (zero nos validos) → destrutiva', () => {
    astifyResult = [null];
    const c = classifyOneStatement('CREATE TABLE whatever (id int);');
    expect(c.severity).toBe('destrutiva');
    expect(c.suggestion).toBeTruthy();
  });

  it('astify → [null] propaga pra overallSeverity destrutiva', () => {
    astifyResult = [null];
    const r = classifyMigration('CREATE TABLE whatever (id int);');
    expect(r.overallSeverity).toBe('destrutiva');
    expect(r.requiresConfirmation).toBe(true);
  });

  it('astify → [null, <DROP node valido>] (mistura valido/invalido) → destrutiva', () => {
    // Um no DROP TABLE perfeitamente valido, mas precedido de um `null`.
    // O `validNodes.length !== nodes.length` deve disparar fail-closed —
    // nao da pra provar que o que sobrou e seguro.
    astifyResult = [
      null,
      { type: 'drop', keyword: 'table', name: [{ table: 'x' }] },
    ];
    const c = classifyOneStatement('DROP TABLE x;');
    expect(c.severity).toBe('destrutiva');
    expect(c.suggestion).toBeTruthy();
  });

  it('astify → [<DROP node valido>] (controle: so nos validos) → ainda destrutiva', () => {
    // Controle: garante que o mock em si funciona — um DROP valido sozinho
    // tambem e destrutivo, mas pela regra DROP_TABLE, nao pelo fail-closed.
    astifyResult = [
      { type: 'drop', keyword: 'table', name: [{ table: 'x' }] },
    ];
    const c = classifyOneStatement('DROP TABLE x;');
    expect(c.severity).toBe('destrutiva');
  });
});
