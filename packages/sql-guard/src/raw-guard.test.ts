import { describe, it, expect } from 'vitest';
import { detectRawLexerHazard } from './raw-guard.js';

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);
const VT = String.fromCharCode(11);
const FF = String.fromCharCode(12);
const BS = String.fromCharCode(8);
const DEL = String.fromCharCode(127);
const E = 'é'; // é

describe('detectRawLexerHazard — caracteres de controle', () => {
  it('detecta CR (\\r) com mensagem especifica', () => {
    const r = detectRawLexerHazard(`SELECT 1 --x${CR}, pg_advisory_lock(8)`);
    expect(r).toMatch(/retorno de carro|CR/);
  });

  it.each([
    ['NUL', NUL],
    ['VT', VT],
    ['FF', FF],
    ['BS', BS],
    ['DEL', DEL],
  ])('detecta controle %s', (_n, ch) => {
    expect(detectRawLexerHazard(`SELECT 1${ch}`)).toMatch(/controle|retorno de carro/);
  });

  it('NAO recusa \\n (LF) nem \\t (TAB) — whitespace legitimo', () => {
    expect(detectRawLexerHazard(`SELECT id${LF}${TAB}FROM t${LF}WHERE a = 1`)).toBeNull();
  });

  it('NAO recusa U+2028 / U+2029 (PG nao os trata como fim de comentario)', () => {
    expect(detectRawLexerHazard(`SELECT '  '`)).toBeNull();
  });
});

describe('detectRawLexerHazard — dollar-quote', () => {
  it.each([
    `SELECT $${E}$x$${E}$`,
    `SELECT $${E}$a$$b$${E}$, pg_advisory_lock(1)`,
    `SELECT $a${E}$y$a${E}$`,
    `SELECT $tag${E}123$body$tag${E}123$`,
  ])('detecta tag nao-ASCII: %s', (sql) => {
    expect(detectRawLexerHazard(sql)).toMatch(/dollar-quote/);
  });

  it.each([
    'SELECT $tag$texto$tag$ AS z',
    'SELECT $$texto$$ AS z',
    'SELECT $q$abc$q$',
    'SELECT * FROM t WHERE a > $1 AND b < $2', // parametros posicionais
    'SELECT * FROM t WHERE a = $1',
    "SELECT price, '$5.00' AS a, '$0.50' AS b FROM t", // cifrao em string
    'SELECT 1', // trivial
  ])('NAO recusa legitimo: %s', (sql) => {
    expect(detectRawLexerHazard(sql)).toBeNull();
  });
});
