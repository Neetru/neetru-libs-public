/**
 * Blocklist de funções SQL perigosas.
 *
 * Mesmo que um statement seja sintaticamente um SELECT (read-only), se ele
 * referenciar QUALQUER função desta lista ele é classificado como inseguro.
 * São funções que leem/escrevem arquivos do sistema, abrem conexões externas,
 * ou consomem recursos do servidor — capazes de exfiltrar dados ou derrubar o
 * banco a partir de uma "consulta de leitura".
 *
 * A lista é fechada e em minúsculas; a detecção compara sempre em minúsculas.
 */
export const DANGEROUS_FUNCTIONS: ReadonlySet<string> = new Set([
  // leitura/escrita de arquivos do servidor
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_stat_file',
  'lo_import',
  'lo_export',
  // ESCRITA de arquivos / execução de programa no host (RCE — ex: escrever
  // /etc/cron.d via pg_write_server_files vira backdoor). Faltavam na blocklist.
  'pg_write_server_files',
  'pg_write_binary_file',
  'pg_execute_server_program',
  'lo_create',
  'lo_write',
  'lo_put',
  // conexões externas / execução remota
  'dblink',
  'dblink_exec',
  // consumo de recurso / controle de processos
  'pg_sleep',
  'pg_terminate_backend',
  'pg_cancel_backend',
  // ── MySQL ──────────────────────────────────────────────────────────────
  // Faltavam: a blocklist só cobria Postgres, então em `dialect:'mysql'` um
  // `SELECT LOAD_FILE('/etc/passwd')` passava como leitura segura. (`INTO
  // OUTFILE/DUMPFILE` é barrado por keyword em classify.ts — não é função.)
  'load_file', // lê arquivo arbitrário do servidor (exfiltração)
  'sleep', // DoS time-based (equivalente MySQL do pg_sleep)
  'benchmark', // DoS / side-channel de timing
  'sys_exec', // RCE via UDF lib_mysqludf_sys (executa comando no host)
  'sys_eval', // RCE via UDF lib_mysqludf_sys (executa e captura saída)
]);

/**
 * Testa se um nome de função (qualquer caixa) está na blocklist.
 */
export function isDangerousFunction(name: string): boolean {
  return DANGEROUS_FUNCTIONS.has(name.toLowerCase());
}
