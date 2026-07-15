/**
 * `hardenSelect` — impoe um LIMIT de linhas num SELECT seguro.
 *
 * O visualizador de banco em producao nunca deve retornar a tabela inteira: um
 * `SELECT * FROM event_log` sem LIMIT trava a UI e estressa o banco. Este
 * modulo recebe um SELECT (ja classificado como seguro) e devolve o mesmo
 * SELECT com `LIMIT <maxRows>` garantido.
 */
import { classifyStatement } from './classify.js';
/**
 * Recebe um SELECT seguro e devolve-o com `LIMIT maxRows` imposto.
 *
 * COMO impoe o LIMIT — SEMPRE ENCAPSULA (wrap), nunca faz clamp no AST:
 *   O retorno e sempre da forma
 *
 *     SELECT * FROM (<SELECT original>) AS _neetru_capped LIMIT <maxRows>
 *
 *   O `LIMIT maxRows` da query EXTERNA limita a contagem de linhas de forma
 *   incondicional, independente de qualquer LIMIT/OFFSET interno:
 *    - sem LIMIT interno          -> o externo impoe o teto;
 *    - LIMIT interno MAIOR        -> o externo corta no teto (correto);
 *    - LIMIT interno MENOR        -> o interno vence, ja que nao consegue
 *                                    produzir mais linhas que ele mesmo (correto);
 *    - `LIMIT n OFFSET m`         -> idem; o externo limita o resultado final.
 *
 *   POR QUE wrap e nao clamp no AST: o teto de seguranca precisa ser impossivel
 *   de errar. O clamp dependia de ler o no `limit` do node-sql-parser, cuja
 *   forma varia (`LIMIT n` -> `value: [n]`; `LIMIT n OFFSET m` -> `value: [n, m]`
 *   com `separator: 'offset'`). Ler "a ultima entrada de `value`" pegava o
 *   OFFSET em vez da contagem e devolvia o SELECT SEM CAP. O wrap elimina TODA
 *   dependencia da forma do AST de LIMIT — nao ha o que parsear errado.
 *
 *   A query interna ja foi provada read-only por `classifyStatement` antes do
 *   wrap, entao envelopa-la num SELECT externo nao introduz risco.
 *
 * Lanca `Error` se `maxRows` nao for inteiro positivo, ou se `sql` nao for um
 * SELECT seguro (classificado internamente antes de qualquer coisa).
 */
export function hardenSelect(sql, opts) {
    const { maxRows } = opts;
    const dialect = opts.dialect ?? 'postgresql';
    // ---- valida maxRows -------------------------------------------------
    if (typeof maxRows !== 'number' ||
        !Number.isInteger(maxRows) ||
        maxRows <= 0) {
        throw new Error(`hardenSelect: maxRows precisa ser um inteiro positivo (recebido: ${String(maxRows)}).`);
    }
    // ---- valida que o input e um SELECT seguro --------------------------
    const verdict = classifyStatement(sql, dialect);
    if (!verdict.safe) {
        throw new Error(`hardenSelect: o SQL nao e um SELECT seguro (${verdict.statementType}): ${verdict.reason}`);
    }
    // EXPLAIN nao recebe LIMIT — nao retorna linhas de dados. So SELECT/WITH.
    if (verdict.statementType !== 'select' && verdict.statementType !== 'with') {
        throw new Error(`hardenSelect: so aceita SELECT ou WITH...SELECT (recebido: ${verdict.statementType}).`);
    }
    // ---- wrap: o teto e imposto pela query externa, sempre --------------
    // Tira ponto-e-virgula final e espacos para que o SELECT interno seja uma
    // subquery sintaticamente valida.
    const inner = sql.trim().replace(/;\s*$/, '').trim();
    // SEC (auditoria 2026-06-18): o `)` de fechamento e o LIMIT ficam em LINHA
    // PROPRIA. Se o `inner` terminar num comentario de linha (`-- ...`), numa
    // unica linha esse comentario engoliria `) AS _neetru_capped LIMIT N` e o teto
    // sumiria/quebraria a query. Com `\n`, o comentario so afeta a linha do inner.
    return `SELECT * FROM (\n${inner}\n) AS _neetru_capped LIMIT ${maxRows}`;
}
//# sourceMappingURL=harden.js.map