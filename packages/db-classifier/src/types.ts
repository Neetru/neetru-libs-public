import type { StatementSeverity } from './rules.js';

export type { StatementSeverity } from './rules.js';

/**
 * Classificação de um único statement SQL.
 */
export interface StatementClassification {
  /** SQL bruto deste statement (trimado). */
  sql: string;
  /** Severidade atribuída. */
  severity: StatementSeverity;
  /** Motivo em PT-BR — por que recebeu essa severidade. */
  reason: string;
  /**
   * Orientação expand-contract em PT-BR. Presente quando `severity` é
   * `destrutiva`; ausente quando `aditiva`.
   */
  suggestion?: string;
}

/**
 * Relatório completo da classificação de uma migração (que pode conter
 * múltiplos statements separados por `;`).
 */
export interface ClassificationReport {
  /** `destrutiva` se QUALQUER statement for destrutiva; caso contrário `aditiva`. */
  overallSeverity: StatementSeverity;
  /** Classificação por statement, na ordem do arquivo. */
  statements: StatementClassification[];
  /** `true` sse `overallSeverity === 'destrutiva'` — dispara a pausa sagrada. */
  requiresConfirmation: boolean;
}
