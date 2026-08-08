/**
 * Tipos canonicos da reconciliacao aditiva de schema.
 */

/** Uma coluna declarada num `CREATE TABLE`: nome + o resto da definicao. */
export interface DeclaredColumn {
  name: string;
  /** Tudo depois do nome (ex.: `timestamp with time zone`, `text NOT NULL`). */
  definition: string;
}

/**
 * Uma coluna VIVA introspectada do banco. `table`/`column` sao os nomes crus
 * como `information_schema.columns` devolve (schema `public`). O consumidor
 * (Core via node-pg, agente via psql/stdout) normaliza o resultset pra este
 * shape antes de chamar `planAdditiveReconciliation`.
 */
export interface IntrospectedColumn {
  table: string;
  column: string;
}

/**
 * Um `ALTER TABLE ADD COLUMN` planejado — a coluna declarada faltante numa
 * tabela EXISTENTE, com o SQL aditivo pronto pra executar. O consumidor roda
 * `sql` (try/catch fail-open) e classifica em healed/unhealed.
 */
export interface ReconciliationAlter {
  table: string;
  column: string;
  /** `ALTER TABLE "<t>" ADD COLUMN IF NOT EXISTS "<c>" <def>`. */
  sql: string;
}

/** Plano de reconciliacao: os ALTER a executar (vazio = sem drift a curar). */
export interface ReconciliationPlan {
  alters: ReconciliationAlter[];
}

/**
 * RESULTADO da reconciliacao — o contrato compartilhado Core↔agente (o que vai
 * pro `result` do comando de migracao e persiste em
 * `ProductDbMigration.reconciliation`). Produzido pelo lado que roda o I/O
 * (Core via node-pg, agente via psql) a partir do `ReconciliationPlan`.
 */
export interface MigrationReconciliation {
  /** `true` se houve QUALQUER drift (coluna curada ou tentada). */
  driftDetected: boolean;
  /** Colunas curadas com sucesso (ALTER aplicou). */
  healed: Array<{ table: string; column: string }>;
  /** Colunas que falharam a cura (ex.: NOT NULL sem default em tabela populada). */
  unhealed: Array<{ table: string; column: string; error: string }>;
}
