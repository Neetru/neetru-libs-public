import { describe, it, expect } from 'vitest';
import { classifyStatement } from './classify.js';

describe('classifyStatement — safe (read-only)', () => {
  it('aprova SELECT * FROM users', () => {
    const v = classifyStatement('SELECT * FROM users');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('select');
  });

  it('aprova SELECT 1', () => {
    const v = classifyStatement('SELECT 1');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('select');
  });

  it('aprova SELECT com WHERE/ORDER BY/LIMIT genuinos', () => {
    const v = classifyStatement(
      "SELECT id, name FROM users WHERE status = 'active' ORDER BY id LIMIT 10",
    );
    expect(v.safe).toBe(true);
  });

  it('aprova EXPLAIN SELECT ... (dialeto pg via fallback)', () => {
    const v = classifyStatement('EXPLAIN SELECT * FROM users');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('explain');
  });

  it('aprova EXPLAIN ANALYZE SELECT ...', () => {
    const v = classifyStatement('EXPLAIN ANALYZE SELECT * FROM users');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('explain');
  });

  it('aprova EXPLAIN SELECT no dialeto mysql', () => {
    const v = classifyStatement('EXPLAIN SELECT * FROM users', 'mysql');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('explain');
  });

  it('aprova WITH t AS (SELECT ...) SELECT * FROM t', () => {
    const v = classifyStatement(
      'WITH t AS (SELECT id FROM users) SELECT * FROM t',
    );
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('with');
  });

  it('aprova SELECT com subquery de leitura', () => {
    const v = classifyStatement(
      'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)',
    );
    expect(v.safe).toBe(true);
  });

  it('aprova EXPLAIN com comentario de bloco antes (sem recursao infinita)', () => {
    // Codex MEDIUM: comentario `/*x*/` antes do EXPLAIN fazia o strip
    // ancorado em ^explain nao progredir -> recursao no input inalterado.
    const v = classifyStatement('/*x*/ EXPLAIN SELECT 1');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('explain');
  });

  it('aprova EXPLAIN com comentario de linha antes', () => {
    const v = classifyStatement('-- nota\nEXPLAIN SELECT * FROM users');
    expect(v.safe).toBe(true);
    expect(v.statementType).toBe('explain');
  });

  it('aprova DESCRIBE users (metadados read-only)', () => {
    const v = classifyStatement('DESCRIBE users', 'mysql');
    expect(v.safe).toBe(true);
  });

  it('aprova DESC users (metadados read-only)', () => {
    const v = classifyStatement('DESC users', 'mysql');
    expect(v.safe).toBe(true);
  });
});

describe('classifyStatement — unsafe (write/DDL)', () => {
  it('recusa UPDATE', () => {
    const v = classifyStatement("UPDATE users SET name = 'x' WHERE id = 1");
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('update');
  });

  it('recusa DELETE', () => {
    const v = classifyStatement('DELETE FROM users WHERE id = 1');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('delete');
  });

  it('recusa INSERT', () => {
    const v = classifyStatement("INSERT INTO users (name) VALUES ('x')");
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('insert');
  });

  it('recusa DROP TABLE', () => {
    const v = classifyStatement('DROP TABLE users');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('drop');
  });

  it('recusa TRUNCATE', () => {
    const v = classifyStatement('TRUNCATE TABLE users');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('truncate');
  });

  it('recusa CREATE TABLE', () => {
    const v = classifyStatement('CREATE TABLE t (id int)');
    expect(v.safe).toBe(false);
  });

  it('recusa ALTER TABLE', () => {
    const v = classifyStatement('ALTER TABLE users ADD COLUMN x int');
    expect(v.safe).toBe(false);
  });

  it('recusa GRANT', () => {
    const v = classifyStatement('GRANT SELECT ON users TO bob');
    expect(v.safe).toBe(false);
  });

  it('recusa CTE data-modifying (WITH x AS (DELETE ...) SELECT *)', () => {
    const v = classifyStatement(
      'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
    );
    expect(v.safe).toBe(false);
  });

  it('recusa EXPLAIN ANALYZE de um UPDATE (executa de verdade)', () => {
    const v = classifyStatement(
      'EXPLAIN ANALYZE UPDATE users SET x = 1 WHERE id = 2',
    );
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('explain');
  });
});

describe('classifyStatement — unsafe (multi-statement / fail-closed)', () => {
  it('recusa dois statements SELECT 1; DROP TABLE t', () => {
    const v = classifyStatement('SELECT 1; DROP TABLE t');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('multiple');
  });

  it('recusa dois SELECT (apenas um statement permitido)', () => {
    const v = classifyStatement('SELECT 1; SELECT 2');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('multiple');
  });

  it('recusa SQL lixo (parse error)', () => {
    const v = classifyStatement('this is not sql at all');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('unknown');
  });

  it('recusa string vazia', () => {
    const v = classifyStatement('');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('unknown');
  });

  it('recusa string so de espacos', () => {
    const v = classifyStatement('   \n\t  ');
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('unknown');
  });
});

describe('classifyStatement — blocklist de funcoes perigosas', () => {
  it('recusa SELECT pg_read_file(...) e lista a funcao', () => {
    const v = classifyStatement("SELECT pg_read_file('/etc/passwd')");
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toEqual(['pg_read_file']);
  });

  it('recusa funcao bloqueada dentro de subquery', () => {
    const v = classifyStatement(
      'SELECT * FROM users WHERE id IN (SELECT dblink(1))',
    );
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('dblink');
  });

  it('recusa pg_sleep no WHERE', () => {
    const v = classifyStatement(
      'SELECT * FROM users WHERE pg_sleep(10) IS NULL',
    );
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('pg_sleep');
  });

  it('recusa funcao bloqueada dentro de CTE de leitura', () => {
    const v = classifyStatement(
      'WITH t AS (SELECT pg_ls_dir(1) AS d) SELECT * FROM t',
    );
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('pg_ls_dir');
  });

  it('recusa funcao bloqueada aninhada como argumento de outra funcao', () => {
    const v = classifyStatement("SELECT length(pg_read_file('/etc/passwd'))");
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('pg_read_file');
  });

  it('detecta a blocklist independente de caixa (PG_SLEEP)', () => {
    const v = classifyStatement('SELECT PG_SLEEP(1)');
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('pg_sleep');
  });

  it('recusa COPY users TO arquivo', () => {
    const v = classifyStatement("COPY users TO '/tmp/x'");
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('copy');
  });

  it('recusa COPY users FROM arquivo', () => {
    const v = classifyStatement("COPY users FROM '/tmp/x'");
    expect(v.safe).toBe(false);
    expect(v.statementType).toBe('copy');
  });

  it('lista multiplas funcoes bloqueadas quando ha mais de uma', () => {
    const v = classifyStatement(
      "SELECT pg_read_file('/a'), pg_ls_dir('/b')",
    );
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toEqual(['pg_ls_dir', 'pg_read_file']);
  });

  // Regressão: funções de ESCRITA/RCE no host (escrever /etc/cron.d via
  // pg_write_server_files = backdoor). Faltavam na blocklist até wave-8.
  it.each([
    'pg_write_server_files',
    'pg_write_binary_file',
    'pg_execute_server_program',
    'lo_create',
    'lo_write',
    'lo_put',
  ])('recusa SELECT que toca %s (escrita/RCE no host)', (fn) => {
    const v = classifyStatement(`SELECT ${fn}('/etc/cron.d/x', 'payload')`);
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain(fn);
  });
});

describe('classifyStatement — determinismo', () => {
  it('mesmo input -> mesmo output (SELECT seguro)', () => {
    const sql = 'SELECT id FROM users WHERE id = 1';
    const a = classifyStatement(sql);
    const b = classifyStatement(sql);
    expect(a).toEqual(b);
  });

  it('mesmo input -> mesmo output (blocklist)', () => {
    const sql = "SELECT pg_read_file('/etc/passwd')";
    const a = classifyStatement(sql);
    const b = classifyStatement(sql);
    expect(a).toEqual(b);
  });

  it('mesmo input -> mesmo output (parse error)', () => {
    const a = classifyStatement('garbage !!!');
    const b = classifyStatement('garbage !!!');
    expect(a).toEqual(b);
  });
});
