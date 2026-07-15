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
import pkg from 'node-sql-parser';
import { findDangerousFunctions, findDataModifyingNode } from './ast.js';
const { Parser } = pkg;
/**
 * Tipos de statement do AST que sao read-only puros.
 *
 * `desc` / `describe`: o `DESCRIBE <tabela>` / `DESC <tabela>` do MySQL apenas
 * LE METADADOS do schema da tabela (nomes de coluna, tipos, chaves) — nunca
 * le dados de linhas, nunca toca o sistema de arquivos, nunca escreve. E
 * read-only por construcao e util para o visualizador de banco, por isso fica
 * na allowlist.
 */
const READ_ONLY_TYPES = new Set(['select', 'explain', 'desc', 'describe']);
/**
 * Remove comentarios SQL (bloco `/* *​/` e linha `--`) de um trecho de SQL.
 *
 * Usado tanto para achar a 1a keyword (`keywordPrefix`) quanto para limpar o
 * input antes de retirar a keyword `EXPLAIN` (`classifyExplain`) — sem isso um
 * comentario inicial faria o strip ancorado em `^explain` nao progredir.
 */
function stripSqlComments(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--[^\n]*/g, ' ');
}
/**
 * Constroi um veredito inseguro com mensagem padronizada.
 */
function unsafe(statementType, reason, dangerousFunctions) {
    const verdict = { safe: false, statementType, reason };
    if (dangerousFunctions && dangerousFunctions.length > 0) {
        verdict.dangerousFunctions = dangerousFunctions;
    }
    return verdict;
}
/**
 * Constroi um veredito seguro.
 */
function safe(statementType, reason) {
    return { safe: true, statementType, reason };
}
/**
 * Detecta, por palavra-chave, statements que o node-sql-parser NAO consegue
 * parsear no dialeto postgresql mas que precisamos reconhecer mesmo assim.
 *
 * Dois casos confirmados na v5.x:
 *  - `EXPLAIN ...` (e `EXPLAIN ANALYZE ...`) — nao parseia no dialeto pg.
 *  - `COPY ... TO/FROM ...` — nao parseia em nenhum dialeto.
 *
 * Sem este fallback, um `EXPLAIN SELECT` cairia no caminho fail-closed e seria
 * recusado mesmo sendo seguro; e um `COPY ... TO '/tmp/x'` (exfiltracao de
 * arquivo) so seria barrado por ser um parse-error generico — preferimos
 * barra-lo com motivo explicito.
 *
 * Devolve `'explain'` | `'copy'` | `null`.
 */
function keywordPrefix(sql) {
    // remove comentarios de linha/bloco para achar a 1a keyword
    const stripped = stripSqlComments(sql).trim();
    const firstWord = /^([A-Za-z_]+)/.exec(stripped)?.[1]?.toLowerCase() ?? '';
    if (firstWord === 'explain')
        return 'explain';
    if (firstWord === 'copy')
        return 'copy';
    return null;
}
/**
 * Trata um `EXPLAIN ...` que nao parseou no dialeto pg.
 *
 * Estrategia: remover a keyword `EXPLAIN` (e um eventual `ANALYZE` / lista de
 * opcoes entre parenteses) e classificar recursivamente o statement interno.
 * Um `EXPLAIN` so e seguro se o que ele explica tambem for — `EXPLAIN ANALYZE
 * UPDATE ...` de fato EXECUTA o UPDATE, entao o interno precisa ser read-only.
 */
function classifyExplain(sql, dialect) {
    // tira comentarios iniciais ANTES do strip de EXPLAIN — sem isso um
    // `/*x*/ EXPLAIN ...` faria o regex ancorado em `^explain` nao casar, o
    // input ficaria inalterado e classifyStatement recursaria pra sempre.
    let inner = stripSqlComments(sql).trim();
    // tira a keyword EXPLAIN
    inner = inner.replace(/^\s*explain\s+/i, '');
    // tira lista de opcoes entre parenteses (ANALYZE, FORMAT JSON), se houver
    inner = inner.replace(/^\s*\((?:[^()]|\([^()]*\))*\)\s*/i, '');
    // tira ANALYZE / VERBOSE soltos, se houver
    inner = inner.replace(/^\s*(?:analyze\s+|verbose\s+)+/i, '');
    if (inner.trim().length === 0) {
        return unsafe('explain', 'EXPLAIN sem statement interno reconhecivel — recusado por seguranca (fail-closed).');
    }
    const innerVerdict = classifyStatement(inner, dialect);
    if (!innerVerdict.safe) {
        return unsafe('explain', `EXPLAIN de um statement que nao e read-only (${innerVerdict.statementType}): ${innerVerdict.reason}`, innerVerdict.dangerousFunctions);
    }
    return safe('explain', 'EXPLAIN de um statement read-only — apenas mostra o plano de execucao, seguro.');
}
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
export function classifyStatement(sql, dialect = 'postgresql') {
    // ---- guarda de input ------------------------------------------------
    if (typeof sql !== 'string' || sql.trim().length === 0) {
        return unsafe('unknown', 'Input SQL vazio — recusado por seguranca (fail-closed).');
    }
    const trimmed = sql.trim();
    // ---- comentario executavel MySQL (/*! ... */) — fail-closed ----------
    // Regressao da auditoria 2026-06-10 (S1, era CRIT): o MySQL EXECUTA o
    // conteudo dentro de `/*! ... */` (e da forma versionada `/*!50000 ... */`)
    // como SQL real, mas QUALQUER remocao de comentario (stripSqlComments) o
    // descarta. Isso contorna TODAS as guardas abaixo — keyword (INTO OUTFILE),
    // AST (blocklist load_file/sys_exec) e o proprio parser: um
    // `SELECT 1 /*! INTO OUTFILE '/var/www/x.php' */` ou `/*!50000 sys_exec('id') */`
    // chega como SELECT limpo e o payload escondido roda no servidor (RCE/exfil).
    // Reproduzido E2E contra o dist 0.1.2. Um visualizador read-only NUNCA
    // precisa de comentario executavel -> recusa fail-closed. Vale qualquer
    // dialeto: no Postgres `/*! */` e comentario inerte, recusar nao perde nada
    // util. Checado no RAW (antes de strip/parse) pois o ataque vive no texto cru.
    if (/\/\*!/.test(trimmed)) {
        return unsafe('unknown', 'SQL contem comentario executavel MySQL (/*! ... */) cujo conteudo o servidor executaria escondido das guardas — recusado por seguranca (fail-closed).');
    }
    // ---- fallbacks por palavra-chave (parser nao cobre no dialeto pg) ----
    const kw = keywordPrefix(trimmed);
    if (kw === 'copy') {
        // COPY ... TO/FROM um arquivo: leitura/escrita do sistema de arquivos do
        // servidor. SEMPRE inseguro, independente de direcao.
        return unsafe('copy', 'COPY le ou escreve arquivos do servidor — sempre recusado, nao e uma consulta de leitura.');
    }
    // ---- INTO OUTFILE / DUMPFILE (MySQL) — escreve arquivo no host ---------
    // `SELECT ... INTO OUTFILE '/var/www/shell.php'` e sintaticamente um SELECT
    // mas ESCREVE um arquivo no servidor (vetor de RCE no MySQL). O parser pode
    // aceita-lo como `select`, entao barramos por keyword (defense-in-depth),
    // independente do dialeto. Um visualizador read-only nunca usa OUTFILE.
    if (/\binto\s+(?:out|dump)file\b/i.test(stripSqlComments(trimmed))) {
        return unsafe('select', 'SELECT ... INTO OUTFILE/DUMPFILE escreve arquivos do servidor — sempre recusado, nao e uma consulta de leitura.');
    }
    // ---- parse ----------------------------------------------------------
    const parser = new Parser();
    let ast;
    try {
        ast = parser.astify(trimmed, { database: dialect });
    }
    catch {
        // o parser falhou. Se for um EXPLAIN (nao parseavel no dialeto pg),
        // tratamos via fallback dedicado; senao, fail-closed.
        if (kw === 'explain') {
            return classifyExplain(trimmed, dialect);
        }
        return unsafe('unknown', 'SQL nao pode ser parseado (sintaxe nao reconhecida) — recusado por seguranca (fail-closed).');
    }
    // ---- multiplos statements -------------------------------------------
    // astify devolve um ARRAY quando ha mais de um statement. Multiplos
    // statements nunca sao seguros para o visualizador de banco.
    if (Array.isArray(ast)) {
        if (ast.length === 0) {
            return unsafe('unknown', 'O parser nao produziu nenhum statement — recusado por seguranca (fail-closed).');
        }
        if (ast.length > 1) {
            return unsafe('multiple', `Input contem ${ast.length} statements — apenas um unico statement read-only e permitido.`);
        }
        ast = ast[0];
    }
    if (ast == null || typeof ast !== 'object') {
        return unsafe('unknown', 'O parser devolveu um AST nao utilizavel — recusado por seguranca (fail-closed).');
    }
    const node = ast;
    const type = typeof node['type'] === 'string' ? node['type'].toLowerCase() : 'unknown';
    // ---- blocklist de funcoes perigosas (varre o AST inteiro) -----------
    // Checada ANTES de aprovar qualquer coisa: mesmo um SELECT e inseguro se
    // tocar a blocklist. A varredura e recursiva — pega funcao aninhada em
    // subquery, CTE, WHERE, argumento de funcao, qualquer profundidade.
    const dangerous = findDangerousFunctions(node);
    if (dangerous.length > 0) {
        return unsafe(type === 'select' ? 'select' : type, `O statement referencia ${dangerous.length === 1 ? 'a funcao perigosa' : 'as funcoes perigosas'} ${dangerous
            .map((f) => `\`${f}\``)
            .join(', ')} — recusado.`, dangerous);
    }
    // ---- CTE data-modifying (WITH x AS (DELETE ...) SELECT ...) ----------
    // No Postgres uma CTE pode conter INSERT/UPDATE/DELETE. O no raiz seria
    // `select`, mas ha escrita aninhada. Varremos o AST inteiro a procura.
    // (Na pratica a v5.x do parser rejeita essa sintaxe e ela cai no
    // fail-closed acima; mantemos a checagem como defesa em profundidade.)
    const writeNode = findDataModifyingNode(node);
    if (writeNode) {
        return unsafe(type, `O statement contem uma operacao de escrita (${writeNode.toUpperCase()}) — possivelmente uma CTE data-modifying. Recusado.`);
    }
    // ---- decisao por tipo de statement ----------------------------------
    if (type === 'select') {
        // `WITH ... SELECT`: o no raiz e `select` com campo `with` populado. Como
        // ja varremos o AST inteiro acima por escrita e blocklist, um SELECT com
        // CTE puramente de leitura e seguro.
        const hasWith = Array.isArray(node['with']) && node['with'].length > 0;
        return safe(hasWith ? 'with' : 'select', hasWith
            ? 'WITH ... SELECT puramente de leitura — seguro.'
            : 'SELECT read-only — seguro.');
    }
    if (READ_ONLY_TYPES.has(type)) {
        // EXPLAIN parseado direto (acontece no dialeto mysql). Seu `expr` interno
        // ja foi varrido por blocklist/escrita acima.
        return safe(type, `Statement \`${type}\` read-only — seguro.`);
    }
    // ---- tudo o mais e inseguro -----------------------------------------
    return unsafe(type, `Statement do tipo \`${type}\` nao e read-only — apenas SELECT, EXPLAIN e WITH...SELECT sao permitidos.`);
}
//# sourceMappingURL=classify.js.map