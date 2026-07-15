import type { ClassificationReport, StatementClassification } from './types.js';
/**
 * Classifica um unico statement bruto (texto). Fail-closed: qualquer erro de
 * parse vira `destrutiva` com a regra UNKNOWN.
 *
 * Nota: o `astify` do node-sql-parser pode devolver um ARRAY de nos quando o
 * texto contem mais de um statement. Nesse caso classificamos TODOS os nos e
 * agregamos — nunca apenas o primeiro. Exportada para teste direto do caminho
 * multi-AST.
 */
export declare function classifyOneStatement(rawSql: string): StatementClassification;
/**
 * Classifica uma migracao SQL inteira (que pode conter varios statements
 * separados por `;`). Funcao pura, deterministica, sem I/O.
 */
export declare function classifyMigration(sql: string): ClassificationReport;
/**
 * Descricao humana de uma linha (PT-BR) de uma classificacao de statement.
 * Usada pelo `neetru db diff`. Funcao pura de formatacao de string.
 */
export declare function explainStatement(c: StatementClassification): string;
