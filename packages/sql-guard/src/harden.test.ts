import { describe, it, expect } from 'vitest';
import { hardenSelect } from './harden.js';
import { classifyStatement } from './classify.js';

/** Le o LIMIT mais a direita (= o LIMIT externo do wrap). */
function outerLimitOf(sql: string): number | null {
  const matches = [...sql.matchAll(/\bLIMIT\s+(\d+)/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return Number(last[1]);
}

describe('hardenSelect — impoe LIMIT (sempre encapsula)', () => {
  it('SELECT sem LIMIT recebe LIMIT 500 no wrap externo', () => {
    const out = hardenSelect('SELECT * FROM users', { maxRows: 500 });
    expect(out).toContain('_neetru_capped');
    expect(outerLimitOf(out)).toBe(500);
  });

  // SEC (auditoria 2026-06-18): inner terminando em comentario de linha nao pode
  // engolir o `)` + LIMIT externo. O wrap newline-safe poe o cap em linha propria.
  it('SELECT terminando em comentario de linha — cap externo fica em linha propria', () => {
    const out = hardenSelect('SELECT id FROM users -- meu comentario', { maxRows: 500 });
    expect(out).toContain('\n) AS _neetru_capped LIMIT 500');
    expect(outerLimitOf(out)).toBe(500);
    const lines = out.split('\n');
    const lastLine = lines[lines.length - 1]!;
    expect(lastLine).toContain('LIMIT 500');
    expect(lastLine).not.toContain('--'); // o cap nao esta dentro do comentario
  });

  it('SELECT com LIMIT 9999 e encapsulado com cap externo LIMIT 500', () => {
    const out = hardenSelect('SELECT * FROM users LIMIT 9999', { maxRows: 500 });
    expect(out).toContain('_neetru_capped');
    expect(outerLimitOf(out)).toBe(500);
  });

  it('SELECT com LIMIT 10 — wrap externo cap 500, LIMIT interno menor vence', () => {
    const out = hardenSelect('SELECT * FROM users LIMIT 10', { maxRows: 500 });
    expect(out).toContain('_neetru_capped');
    // o cap externo e sempre maxRows; o LIMIT interno 10 (menor) ainda limita
    expect(outerLimitOf(out)).toBe(500);
    expect(out).toContain('LIMIT 10');
  });

  it('SELECT com LIMIT 10000 OFFSET 1 — wrap externo ainda cap 500 (Codex HIGH)', () => {
    // Codex finding: `value[value.length-1]` lia o OFFSET (1), nao a contagem
    // (10000), e devolvia o SELECT com LIMIT 10000 SEM CAP. O wrap elimina isso.
    const out = hardenSelect('SELECT * FROM users LIMIT 10000 OFFSET 1', {
      maxRows: 500,
    });
    expect(out).toContain('_neetru_capped');
    expect(outerLimitOf(out)).toBe(500);
  });

  it('preserva colunas, WHERE e ORDER BY dentro do wrap', () => {
    const out = hardenSelect(
      "SELECT id, name FROM users WHERE status = 'active' ORDER BY id",
      { maxRows: 100 },
    );
    expect(outerLimitOf(out)).toBe(100);
    expect(out.toLowerCase()).toContain('where');
    expect(out.toLowerCase()).toContain('order by');
    expect(classifyStatement(out).safe).toBe(true);
  });

  it('encapsula WITH ... SELECT', () => {
    const out = hardenSelect(
      'WITH t AS (SELECT id FROM users) SELECT * FROM t',
      { maxRows: 250 },
    );
    expect(out).toContain('_neetru_capped');
    expect(outerLimitOf(out)).toBe(250);
  });

  it('strip do ponto-e-virgula final antes do wrap', () => {
    const out = hardenSelect('SELECT * FROM users;  ', { maxRows: 500 });
    expect(out).toContain('_neetru_capped');
    expect(out).not.toContain(');');
    expect(outerLimitOf(out)).toBe(500);
  });

  it('o output continua read-only seguro', () => {
    const out = hardenSelect('SELECT * FROM users', { maxRows: 500 });
    expect(classifyStatement(out).safe).toBe(true);
  });
});

describe('hardenSelect — rejeicoes', () => {
  it('lanca em statement nao-SELECT (UPDATE)', () => {
    expect(() =>
      hardenSelect('UPDATE users SET x = 1 WHERE id = 2', { maxRows: 500 }),
    ).toThrow();
  });

  it('lanca em statement nao-SELECT (DROP)', () => {
    expect(() => hardenSelect('DROP TABLE users', { maxRows: 500 })).toThrow();
  });

  it('lanca em SELECT que toca a blocklist', () => {
    expect(() =>
      hardenSelect("SELECT pg_read_file('/etc/passwd')", { maxRows: 500 }),
    ).toThrow();
  });

  it('lanca em SQL lixo', () => {
    expect(() => hardenSelect('not sql', { maxRows: 500 })).toThrow();
  });

  it('lanca quando maxRows e 0', () => {
    expect(() => hardenSelect('SELECT * FROM users', { maxRows: 0 })).toThrow();
  });

  it('lanca quando maxRows e negativo', () => {
    expect(() => hardenSelect('SELECT * FROM users', { maxRows: -5 })).toThrow();
  });

  it('lanca quando maxRows nao e inteiro', () => {
    expect(() =>
      hardenSelect('SELECT * FROM users', { maxRows: 12.5 }),
    ).toThrow();
  });
});

describe('hardenSelect — determinismo', () => {
  it('mesmo input -> mesmo output', () => {
    const a = hardenSelect('SELECT * FROM users', { maxRows: 500 });
    const b = hardenSelect('SELECT * FROM users', { maxRows: 500 });
    expect(a).toBe(b);
  });
});
