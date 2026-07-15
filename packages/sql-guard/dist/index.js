/**
 * @neetru/sql-guard
 *
 * Classificador read-only de SQL + gate de hardening do Neetru Core DB. E a
 * camada de POLITICA acima do parser SQL: decide se um statement e seguro para
 * rodar como consulta de leitura no visualizador de banco em producao, impoe um
 * LIMIT de linhas em SELECTs, e verifica que uma escrita break-glass tem um
 * WHERE nao-tautologico (para um UPDATE/DELETE de emergencia nao atingir todas
 * as linhas).
 *
 * Codigo critico de seguranca, FAIL-CLOSED: nada que nao seja positivamente
 * provado seguro e tratado como seguro.
 *
 * Parser AST (`node-sql-parser`), nunca regex para decisao de seguranca.
 */
export { classifyStatement } from './classify.js';
export { hardenSelect } from './harden.js';
export { assertNonTrivialWhere } from './where-guard.js';
export { DANGEROUS_FUNCTIONS, isDangerousFunction } from './blocklist.js';
//# sourceMappingURL=index.js.map