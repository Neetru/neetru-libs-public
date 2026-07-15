/**
 * `assertNonTrivialWhere` — guarda do break-glass.
 *
 * Numa escrita de emergencia (break-glass UPDATE/DELETE no banco de producao)
 * o operador autenticado tem permissao de escrita, mas um WHERE tautologico
 * — `WHERE 1=1`, `WHERE true`, `WHERE 'a'='a'` — ou um WHERE que o guard nao
 * consegue entender transforma a escrita pontual num "atinge todas as linhas".
 *
 * FAIL-CLOSED (mandato): esta funcao SO passa quando consegue PROVAR que o
 * WHERE e um predicado restritivo nao-trivial. Qualquer outra coisa — sem
 * WHERE, tautologia conhecida, ou forma de WHERE que o guard nao reconhece —
 * faz a funcao jogar. E melhor barrar uma escrita break-glass legitima (o
 * operador reescreve o WHERE de forma mais clara) do que deixar passar um
 * UPDATE/DELETE que toca a tabela inteira.
 */
import pkg from 'node-sql-parser';
const { Parser } = pkg;
/**
 * Recebe um UPDATE/DELETE e joga `Error` a menos que o WHERE seja
 * COMPROVADAMENTE um predicado restritivo nao-trivial.
 *
 * Joga quando:
 *  - o SQL nao parseia (fail-closed);
 *  - o statement nao e UPDATE nem DELETE;
 *  - o input contem mais de um statement;
 *  - nao ha clausula WHERE;
 *  - o WHERE e tautologico (`1=1`, `true`, `'a'='a'`, `1`, `col = col`, ...);
 *  - o WHERE contem QUALQUER `OR` (rejeitado categoricamente — OR sempre
 *    alarga o conjunto e ramos complementares cobrem todas as linhas);
 *  - o WHERE tem qualquer forma que o guard NAO consegue provar ser um
 *    predicado coluna-vs-literal restritivo (ex.: `NOT false`).
 *
 * Passa SOMENTE quando o WHERE e, ou e uma arvore `AND` cujos ramos resolvem
 * para, um predicado em que pelo menos um operando e uma referencia de coluna
 * comparada contra um literal ou um placeholder/parametro (`id = $1`,
 * `status = 'x'`, `age > 5`, `col IN (...)`, `col IS NOT NULL`,
 * `col LIKE '...'`, ...). `IN (...)` e um operador distinto, NAO um no `OR` —
 * logo continua aceito.
 *
 * @param sql      O statement UPDATE/DELETE.
 * @param dialect  Dialeto do parser. Default `postgresql`.
 */
export function assertNonTrivialWhere(sql, dialect = 'postgresql') {
    if (typeof sql !== 'string' || sql.trim().length === 0) {
        throw new Error('assertNonTrivialWhere: input SQL vazio — recusado (fail-closed).');
    }
    const parser = new Parser();
    let parsed;
    try {
        parsed = parser.astify(sql.trim(), { database: dialect });
    }
    catch {
        throw new Error('assertNonTrivialWhere: SQL nao pode ser parseado — recusado (fail-closed).');
    }
    // multi-statement nunca e aceito num break-glass
    if (Array.isArray(parsed)) {
        if (parsed.length !== 1) {
            throw new Error(`assertNonTrivialWhere: esperado um unico statement UPDATE/DELETE (recebido ${parsed.length}).`);
        }
        parsed = parsed[0];
    }
    if (parsed == null || typeof parsed !== 'object') {
        throw new Error('assertNonTrivialWhere: AST nao utilizavel — recusado (fail-closed).');
    }
    const node = parsed;
    const type = typeof node['type'] === 'string' ? node['type'].toLowerCase() : '';
    if (type !== 'update' && type !== 'delete') {
        throw new Error(`assertNonTrivialWhere: so aceita UPDATE ou DELETE (recebido: \`${type || 'desconhecido'}\`).`);
    }
    const where = node['where'];
    if (where == null) {
        throw new Error(`assertNonTrivialWhere: ${type.toUpperCase()} sem clausula WHERE atingiria TODAS as linhas — recusado.`);
    }
    // FAIL-CLOSED: so passa se conseguirmos PROVAR que o WHERE e restritivo.
    if (!isProvablyRestrictive(where)) {
        throw new Error(`assertNonTrivialWhere: o WHERE do ${type.toUpperCase()} nao foi ` +
            `comprovado restritivo (tautologico, contem OR, ou forma nao ` +
            `reconhecida) — atingiria, ou poderia atingir, TODAS as linhas. ` +
            `Recusado. OR e sempre rejeitado no break-glass: ramos ` +
            `complementares (\`col IS NULL OR col IS NOT NULL\`) cobrem todas as ` +
            `linhas. Use \`IN (...)\` ou statements separados auditados. ` +
            `Forneca um WHERE restritivo explicito (ex.: \`coluna = $1\`).`);
    }
}
/**
 * Decide se um no de expressao do WHERE e COMPROVADAMENTE um predicado
 * restritivo nao-trivial.
 *
 * Retorna `true` SOMENTE quando o no e, ou e uma arvore `AND`/`OR` cujos ramos
 * resolvem para, uma comparacao/predicado em que pelo menos um operando e uma
 * referencia de coluna e o(s) outro(s) sao literais/placeholders — e o no NAO
 * e uma tautologia conhecida.
 *
 * Regras de composicao:
 *  - parenteses (`expr` aninhado, ou flag `parentheses`) sao transparentes;
 *  - `AND`: restritivo se PELO MENOS UM ramo for restritivo (um ramo restritivo
 *    ja limita o conjunto; o AND so pode restringir mais);
 *  - `OR`: SEMPRE rejeitado (devolve `false`). OR sempre ALARGA o conjunto de
 *    linhas, e ramos complementares unidos por OR (`id IS NULL OR id IS NOT
 *    NULL`, `col > 0 OR col <= 0`, `col = 'a' OR col != 'a'`) cobrem TODAS as
 *    linhas mesmo que cada ramo pareca restritivo isoladamente — uma
 *    tautologia complementar que um guard sintatico nao consegue detectar.
 *    Break-glass quase nunca precisa de OR; quem precisa de varios valores usa
 *    `IN (...)` (operador distinto, nao um no OR — logo nao afetado) ou roda
 *    statements separados auditados;
 *  - comparacao folha (`=`, `<>`, `>`, `>=`, `<`, `<=`, `IN`, `NOT IN`, `IS`,
 *    `IS NOT`, `LIKE`, `NOT LIKE`, `BETWEEN`, ...): restritiva se um lado for
 *    coluna e o outro literal/placeholder, EXCETO `col = col` (tautologia).
 *
 * Conservador por design (fail-closed): qualquer forma nao reconhecida —
 * `unary_expr` (`NOT ...`), funcoes soltas, comparacao coluna-vs-coluna,
 * literal solto — devolve `false`, e o caller entao joga.
 */
function isProvablyRestrictive(node) {
    if (node == null || typeof node !== 'object')
        return false;
    const n = node;
    const type = typeof n['type'] === 'string' ? n['type'].toLowerCase() : '';
    // parenteses: o parser pode envolver em { type: 'expr', expr: ... }
    if (type === 'expr' && 'expr' in n) {
        return isProvablyRestrictive(n['expr']);
    }
    // alguns nos carregam o parenteses como flag `parentheses` + `expr`
    if (n['parentheses'] === true && 'expr' in n && type !== 'binary_expr') {
        return isProvablyRestrictive(n['expr']);
    }
    if (type === 'binary_expr') {
        const op = String(n['operator'] ?? '').toUpperCase();
        const left = n['left'];
        const right = n['right'];
        // AND: basta UM ramo restritivo (o AND so estreita o conjunto)
        if (op === 'AND') {
            return (isProvablyRestrictive(left) || isProvablyRestrictive(right));
        }
        // OR: SEMPRE rejeitado (fail-closed). OR sempre ALARGA o conjunto de
        // linhas. Mesmo dois ramos individualmente restritivos podem ser
        // complementares (`id IS NULL OR id IS NOT NULL`, `col > 0 OR col <= 0`,
        // `col = 'a' OR col != 'a'`) e cobrir TODAS as linhas — uma tautologia
        // complementar indetectavel por um guard sintatico. Break-glass nao deve
        // usar OR; use `IN (...)` ou statements separados auditados.
        if (op === 'OR') {
            return false;
        }
        // comparacao folha: restritiva se coluna-vs-literal/placeholder.
        return isColumnVsValuePredicate(op, left, right);
    }
    // unary_expr (`NOT ...`), literais soltos, funcoes, etc.: nao provado
    // restritivo -> fail-closed.
    return false;
}
/**
 * Decide se uma comparacao folha e um predicado restritivo coluna-vs-valor.
 *
 * Restritiva quando exatamente um lado e uma referencia de coluna e o outro e
 * um literal ou placeholder/parametro. `col = col` (duas refs de coluna,
 * inclusive identicas) NAO e restritivo — `col = col` e uma tautologia
 * (sempre verdadeira para linhas onde a coluna nao e NULL), e mesmo
 * `colA = colB` nao e um predicado coluna-vs-literal.
 */
function isColumnVsValuePredicate(op, left, right) {
    // operadores de comparacao/predicado conhecidos
    const COMPARISON_OPS = new Set([
        '=',
        '!=',
        '<>',
        '>',
        '>=',
        '<',
        '<=',
        'IN',
        'NOT IN',
        'IS',
        'IS NOT',
        'LIKE',
        'NOT LIKE',
        'ILIKE',
        'NOT ILIKE',
        'BETWEEN',
        'NOT BETWEEN',
    ]);
    if (!COMPARISON_OPS.has(op))
        return false;
    // bug_2c3ab1e7: operadores NEGATIVOS/de-exclusao casam ~TODAS as linhas
    // (excluem um conjunto pequeno) -> NAO provam restricao pro break-glass.
    // `col IS NOT NULL` (classico), `col != x`, `col <> x`, `NOT IN/LIKE/BETWEEN`
    // passavam como restritivos e furavam a guarda. Break-glass deve usar
    // predicado POSITIVO que estreita (`= x`, `IN (...)`, `> x`, `IS NULL`,
    // `LIKE 'prefixo%'`).
    const NON_RESTRICTIVE_OPS = new Set([
        '!=',
        '<>',
        'IS NOT',
        'NOT IN',
        'NOT LIKE',
        'NOT ILIKE',
        'NOT BETWEEN',
    ]);
    if (NON_RESTRICTIVE_OPS.has(op))
        return false;
    const leftIsCol = isColumnRef(left);
    const rightIsCol = isColumnRef(right);
    const leftIsVal = isValueOperand(left);
    const rightIsVal = isValueOperand(right);
    // exatamente um lado coluna, o outro um valor (literal/placeholder/lista)
    const colVsVal = (leftIsCol && rightIsVal) || (rightIsCol && leftIsVal);
    if (!colVsVal) {
        // col = col, col vs funcao, valor vs valor: nao e predicado restritivo
        return false;
    }
    // LIKE/ILIKE com padrao SO-curinga (`%`, `%%`, ...) casa TODAS as linhas
    // nao-NULL -> tautologia. Padrao com conteudo (`abc%`, `%abc%`) estreita.
    if (op === 'LIKE' || op === 'ILIKE') {
        const pattern = stringLiteralValue(leftIsCol ? right : left);
        if (pattern !== null && /^%+$/.test(pattern))
            return false;
    }
    return true;
}
/**
 * Extrai o valor de string de um no literal (single/double quote string),
 * desembrulhando `expr`. Retorna `null` se nao for um literal de string —
 * placeholders/numeros/listas nao tem padrao de curinga a inspecionar.
 */
function stringLiteralValue(node) {
    if (node == null || typeof node !== 'object')
        return null;
    const n = node;
    if (n['type'] === 'expr' && 'expr' in n)
        return stringLiteralValue(n['expr']);
    const type = typeof n['type'] === 'string' ? n['type'].toLowerCase() : '';
    if ((type === 'single_quote_string' ||
        type === 'string' ||
        type === 'double_quote_string') &&
        typeof n['value'] === 'string') {
        return n['value'];
    }
    return null;
}
/**
 * `true` se o no e uma referencia de coluna do node-sql-parser.
 */
function isColumnRef(node) {
    if (node == null || typeof node !== 'object')
        return false;
    const n = node;
    if (n['type'] === 'expr' && 'expr' in n)
        return isColumnRef(n['expr']);
    return n['type'] === 'column_ref';
}
/**
 * `true` se o no e um operando "valor": um literal constante, um placeholder/
 * parametro (`$1`, `?`, `:name`), ou uma lista de literais (`expr_list` /
 * `value_list` de um `IN (...)`).
 *
 * Funcoes e subqueries NAO contam — uma chamada de funcao pode ser
 * volatil/sempre-verdadeira; um break-glass deve usar literal ou placeholder.
 */
function isValueOperand(node) {
    if (node == null || typeof node !== 'object')
        return false;
    const n = node;
    const type = typeof n['type'] === 'string' ? n['type'].toLowerCase() : '';
    if (type === 'expr' && 'expr' in n)
        return isValueOperand(n['expr']);
    // literais constantes
    if (type === 'number' ||
        type === 'single_quote_string' ||
        type === 'string' ||
        type === 'double_quote_string' ||
        type === 'bool' ||
        type === 'null' ||
        type === 'bigint') {
        return true;
    }
    // placeholder / parametro: `$1` (var), `?` / `:name` (param)
    if (type === 'var' || type === 'param' || type === 'origin') {
        return true;
    }
    // lista de valores de um IN (...): expr_list / value_list — restritiva
    // somente se todos os itens forem valores.
    if (type === 'expr_list' || type === 'value_list') {
        const value = n['value'];
        if (Array.isArray(value) && value.length > 0) {
            return value.every((item) => isValueOperand(item));
        }
        return false;
    }
    return false;
}
//# sourceMappingURL=where-guard.js.map