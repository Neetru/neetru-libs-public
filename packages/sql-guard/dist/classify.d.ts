/**
 * `classifyStatement` — o classificador read-only do `@neetru/sql-guard`.
 *
 * Decide se um statement SQL e seguro para rodar como consulta de leitura no
 * visualizador de banco em producao. E a camada de politica acima do parser.
 *
 * PRINCIPIO FAIL-CLOSED: `safe: true` so quando o statement e POSITIVAMENTE
 * provado seguro. Qualquer erro de parse, input vazio, AST nao reconhecido,
 * multiplos statements, ou funcao da blocklist -> `safe: false`.
 */
import type { SqlVerdict } from './types.js';
export type Dialect = 'postgresql' | 'mysql';
/**
 * Classifica um statement SQL como seguro (read-only) ou perigoso.
 *
 * Fail-closed: so devolve `safe: true` para SELECT, EXPLAIN (de read-only) e
 * `WITH ... SELECT` puramente de leitura. Tudo mais — incluindo erro de parse,
 * input vazio, multiplos statements e SELECTs que tocam a blocklist — e
 * `safe: false`.
 *
 * @param sql      O statement SQL.
 * @param dialect  Dialeto do parser. Default `postgresql`.
 */
export declare function classifyStatement(sql: string, dialect?: Dialect): SqlVerdict;
