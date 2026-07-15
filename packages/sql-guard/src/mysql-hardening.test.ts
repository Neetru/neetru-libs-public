/**
 * Regressão da auditoria 2026-06-10 (HIGH #1): a blocklist só cobria Postgres,
 * então no `dialect:'mysql'` um `SELECT LOAD_FILE('/etc/passwd')` (leitura de
 * arquivo) e `SELECT ... INTO OUTFILE` (escrita de arquivo / RCE) passavam como
 * leitura segura. Estes testes travam o fechamento desse vetor.
 */
import { describe, it, expect } from 'vitest';
import { classifyStatement } from './classify.js';
import { isDangerousFunction } from './blocklist.js';

describe('sql-guard — hardening MySQL (leitura/escrita de arquivo, DoS, RCE)', () => {
  it('recusa SELECT LOAD_FILE(...) no dialeto mysql', () => {
    const v = classifyStatement("SELECT LOAD_FILE('/etc/passwd')", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('recusa SLEEP(...) e flagra a funcao perigosa (DoS time-based)', () => {
    const v = classifyStatement('SELECT SLEEP(10)', 'mysql');
    expect(v.safe).toBe(false);
    expect(v.dangerousFunctions).toContain('sleep');
  });

  it('recusa BENCHMARK(...) (DoS)', () => {
    expect(classifyStatement("SELECT BENCHMARK(1000000, MD5('x'))", 'mysql').safe).toBe(false);
  });

  it('recusa sys_exec/sys_eval (RCE via UDF lib_mysqludf_sys)', () => {
    expect(classifyStatement("SELECT sys_exec('id')", 'mysql').safe).toBe(false);
    expect(classifyStatement("SELECT sys_eval('id')", 'mysql').safe).toBe(false);
  });

  it('recusa SELECT ... INTO OUTFILE (escrita de arquivo no host = RCE)', () => {
    const v = classifyStatement("SELECT * FROM users INTO OUTFILE '/var/www/html/x.php'", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('recusa SELECT ... INTO DUMPFILE', () => {
    const v = classifyStatement("SELECT data FROM blobs INTO DUMPFILE '/tmp/x'", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('barra INTO OUTFILE mesmo com comentario tentando esconder', () => {
    const v = classifyStatement("SELECT 1 /* x */ INTO OUTFILE '/tmp/y'", 'mysql');
    expect(v.safe).toBe(false);
  });

  // ── Comentario executavel MySQL /*! ... */ (S1 — auditoria 2026-06-10) ──
  // O MySQL executa o conteudo de `/*! */`; stripSqlComments o descarta, o que
  // contornava as guardas keyword/AST/parser. Estes travam o fechamento.
  it('recusa INTO OUTFILE escondido em comentario executavel /*! */', () => {
    const v = classifyStatement("SELECT 1 /*! INTO OUTFILE '/var/www/html/x.php' */", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('recusa sys_exec escondido em comentario executavel versionado /*!50000 */', () => {
    const v = classifyStatement("SELECT /*!50000 sys_exec('id') */ 1", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('recusa load_file escondido em comentario executavel /*! */', () => {
    const v = classifyStatement("SELECT 1 /*! UNION SELECT load_file('/etc/passwd') */", 'mysql');
    expect(v.safe).toBe(false);
  });

  it('recusa /*! */ tambem no dialeto postgresql (fail-closed cross-dialeto)', () => {
    expect(classifyStatement("SELECT 1 /*! DROP TABLE x */", 'postgresql').safe).toBe(false);
  });

  it('NAO da falso-positivo em comentario de bloco inerte /* ... */', () => {
    const v = classifyStatement('SELECT id /* nota inocente */ FROM users LIMIT 5', 'mysql');
    expect(v.safe).toBe(true);
  });

  it('blocklist reconhece as funcoes MySQL (case-insensitive)', () => {
    for (const fn of ['load_file', 'sleep', 'benchmark', 'sys_exec', 'sys_eval']) {
      expect(isDangerousFunction(fn.toUpperCase())).toBe(true);
    }
  });

  it('ainda aprova um SELECT legitimo no dialeto mysql', () => {
    const v = classifyStatement("SELECT id, name FROM users WHERE status = 'active' LIMIT 5", 'mysql');
    expect(v.safe).toBe(true);
  });
});
