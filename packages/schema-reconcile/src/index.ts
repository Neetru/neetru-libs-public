/**
 * @neetru/schema-reconcile
 *
 * Reconciliacao ADITIVA de schema do Neetru Core DB. O `db apply` roda
 * `drizzle-kit generate` contra um tmpdir vazio → gera o schema INTEIRO como
 * `CREATE TABLE IF NOT EXISTS`, nunca `ALTER`. Uma coluna NOVA numa tabela
 * EXISTENTE vira no-op silencioso (o `IF NOT EXISTS` engole o statement) →
 * `applied` mas a coluna nao existe → 500 em runtime (foi `user_profiles.deleted_at`
 * no pdv, bug_3f0781a2). Esta lib parseia os `CREATE TABLE` da migracao e, contra
 * as colunas vivas introspectadas, planeja os `ALTER TABLE ADD COLUMN` que curam
 * o drift.
 *
 * FONTE UNICA compartilhada: o Core (Cloud SQL, via node-pg) e o agente (VM, via
 * psql) usam ESTA MESMA logica de parse+plan — so o I/O (introspectar + rodar o
 * ALTER) e por-ambiente. Evita a divergencia entre irmaos (a causa-raiz #1 da
 * auditoria de estabilizacao 2026-08-05).
 *
 * Garantias cravadas: ADITIVO-only (nunca DROP/ALTER TYPE), so cura tabela
 * EXISTENTE, public-only (schema alheio pulado), fail-safe. Funcao pura,
 * deterministica, zero dependencias.
 */

export { parseDeclaredColumns } from './parse.js';
export {
  planAdditiveReconciliation,
  buildIntrospectionQuery,
  buildAlterColumnSql,
  stripInlinePrimaryKey,
  quoteIdent,
} from './plan.js';
export type {
  DeclaredColumn,
  IntrospectedColumn,
  ReconciliationAlter,
  ReconciliationPlan,
  MigrationReconciliation,
} from './types.js';
