/**
 * @neetru/db-classifier
 *
 * Avaliador de severidade de migracao SQL — fonte unica de verdade do Neetru
 * Core DB. Recebe o output do `drizzle-kit generate` e devolve um
 * `ClassificationReport` marcando cada statement como `aditiva` (seguro) ou
 * `destrutiva` (perda de dados / risco).
 *
 * Funcao pura, deterministica, sem I/O. Parser AST (`node-sql-parser`), nunca
 * regex. Fail-closed: tudo que nao for reconhecido vira `destrutiva`.
 */

export { classifyMigration, explainStatement } from './classify.js';
export { STATEMENT_RULES } from './rules.js';
export type { RuleKey, StatementSeverity } from './rules.js';
export type {
  ClassificationReport,
  StatementClassification,
} from './types.js';
