import pkg from 'node-sql-parser';
import { STATEMENT_RULES } from './rules.js';
import { splitSqlStatements, isEffectivelyEmpty } from './split.js';
const { Parser } = pkg;
const PARSER_OPTIONS = { database: 'postgresql' };
/**
 * Keywords de CREATE que criam um objeto nomeado NOVO sem tocar dados
 * existentes (aditivo). Mapeia o `keyword` do node-sql-parser -> RuleKey.
 * Deliberadamente NAO inclui view/function/extension/materialized view —
 * vide nota no branch CREATE de `classifyAst`.
 */
const ADDITIVE_CREATE_KEYWORDS = {
    type: 'CREATE_TYPE',
    schema: 'CREATE_SCHEMA',
    sequence: 'CREATE_SEQUENCE',
    domain: 'CREATE_DOMAIN',
};
const ADDITIVE_CREATE_LABELS = {
    type: 'tipo',
    schema: 'schema',
    sequence: 'sequence',
    domain: 'dominio',
};
/**
 * Sugestoes expand-contract por regra destrutiva (PT-BR).
 */
const SUGGESTIONS = {
    DROP_COLUMN: 'Padrao expand-contract: pare de usar a coluna no codigo e faca o deploy primeiro; remova a coluna num apply posterior.',
    DROP_TABLE: 'Padrao expand-contract: garanta que nada mais le ou escreve na tabela e faca o deploy primeiro; remova a tabela num apply posterior. Considere fazer backup antes.',
    ALTER_COLUMN_TYPE: 'Padrao expand-contract: crie uma coluna nova com o tipo desejado, copie os dados, migre o codigo e so depois remova a coluna antiga. Mudar o tipo in-place pode reescrever a tabela inteira e travar a aplicacao.',
    ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT: 'Adicione uma clausula DEFAULT (a coluna passa a ser aditiva), ou faca em dois passos: 1) adicione a coluna como nullable e preencha os dados; 2) num apply posterior aplique o NOT NULL.',
    RENAME_COLUMN: 'Padrao expand-contract: adicione a coluna nova, escreva nas duas, migre as leituras e o codigo, e so entao remova a coluna antiga. Renomear quebra qualquer codigo que ainda usa o nome antigo.',
    DROP_CONSTRAINT: 'Confirme que nenhuma garantia de integridade depende dessa constraint antes de remove-la. Se for recriar com outra definicao, faca isso de forma controlada num apply dedicado.',
    UNKNOWN: 'O classificador nao reconheceu este statement com seguranca. Revise manualmente: por seguranca (fail-closed) ele e tratado como destrutivo e exige confirmacao humana.',
};
/**
 * Extrai o nome de coluna de um no `column_ref` do node-sql-parser.
 * A forma do no varia: pode ser string direta ou `{ expr: { value } }`.
 */
function columnName(col) {
    if (col == null)
        return null;
    if (typeof col === 'string')
        return col;
    if (typeof col === 'object') {
        const c = col;
        // forma column_ref: { column: { expr: { value } } } ou { column: string }
        if ('column' in c) {
            const inner = c['column'];
            if (typeof inner === 'string')
                return inner;
            if (inner && typeof inner === 'object') {
                const innerObj = inner;
                const expr = innerObj['expr'];
                if (expr && typeof expr === 'object') {
                    const v = expr['value'];
                    if (typeof v === 'string')
                        return v;
                }
                const directVal = innerObj['value'];
                if (typeof directVal === 'string')
                    return directVal;
            }
        }
        // forma direta { expr: { value } }
        const expr = c['expr'];
        if (expr && typeof expr === 'object') {
            const v = expr['value'];
            if (typeof v === 'string')
                return v;
        }
        const val = c['value'];
        if (typeof val === 'string')
            return val;
    }
    return null;
}
/**
 * Extrai o nome da tabela de um no `table` (que pode ser array de refs ou ref).
 */
function tableName(node) {
    if (node == null)
        return null;
    const ref = Array.isArray(node) ? node[0] : node;
    if (typeof ref === 'string')
        return ref;
    if (ref && typeof ref === 'object') {
        const t = ref['table'];
        if (typeof t === 'string')
            return t;
    }
    return null;
}
/**
 * Classifica uma unica acao dentro de um `ALTER TABLE`.
 */
function classifyAlterAction(action, table) {
    const tbl = table ?? 'desconhecida';
    const act = String(action['action'] ?? '').toLowerCase();
    const resource = String(action['resource'] ?? '').toLowerCase();
    const col = columnName(action['column']);
    const colLabel = col ? `"${col}"` : 'desconhecida';
    // ADD COLUMN ...
    if (act === 'add' && resource === 'column') {
        const nullable = action['nullable'];
        const isNotNull = nullable != null &&
            typeof nullable === 'object' &&
            String(nullable['type'] ?? '')
                .toLowerCase()
                .includes('not null');
        const hasDefault = action['default_val'] != null &&
            typeof action['default_val'] === 'object';
        if (isNotNull && !hasDefault) {
            return {
                rule: 'ADD_COLUMN_NOT_NULL_WITHOUT_DEFAULT',
                reason: `Adiciona a coluna ${colLabel} na tabela "${tbl}" como NOT NULL sem DEFAULT — falha se a tabela ja tiver linhas e bloqueia o apply.`,
            };
        }
        if (isNotNull && hasDefault) {
            return {
                rule: 'ADD_COLUMN_NOT_NULL_WITH_DEFAULT',
                reason: `Adiciona a coluna ${colLabel} na tabela "${tbl}" como NOT NULL com DEFAULT — seguro, as linhas existentes recebem o valor padrao.`,
            };
        }
        return {
            rule: 'ADD_COLUMN_NULLABLE',
            reason: `Adiciona a coluna ${colLabel} (nullable) na tabela "${tbl}" — seguro, nao afeta dados existentes.`,
        };
    }
    // ADD CONSTRAINT ... (FK / CHECK / UNIQUE / PRIMARY KEY)
    // bug_0e89270321 (2026-06-11): ADD CONSTRAINT cai em act='add'/resource=
    // 'constraint'. Sem regra explicita, caia no UNKNOWN fail-closed -> destrutiva,
    // forcando confirm --mfa em migracoes 100% aditivas. Adicionar uma constraint
    // (FK/CHECK/UNIQUE/PK) NAO apaga dados — e estrutural e ADITIVA. As clausulas
    // ON DELETE/UPDATE (cascade/restrict/set null) sao comportamento referencial
    // FUTURO (quando uma linha referenciada for deletada depois), nao uma operacao
    // destrutiva no apply. Pode FALHAR se os dados existentes violarem a constraint,
    // mas falha de apply != perda de dados (o rehearse efemero pega antes do push).
    if (act === 'add' && resource === 'constraint') {
        const constraint = action['constraint'];
        const cLabel = typeof constraint === 'string' ? `"${constraint}"` : 'desconhecida';
        return {
            rule: 'ADD_CONSTRAINT',
            reason: `Adiciona a constraint ${cLabel} na tabela "${tbl}" — aditiva (FK/CHECK/UNIQUE/PK). Clausulas ON DELETE/UPDATE sao comportamento referencial futuro, nao deletam dados no apply.`,
        };
    }
    // DROP COLUMN ...
    if (act === 'drop' && resource === 'column') {
        return {
            rule: 'DROP_COLUMN',
            reason: `Remove a coluna ${colLabel} da tabela "${tbl}" — perda permanente dos dados dessa coluna.`,
        };
    }
    // DROP CONSTRAINT ...
    if (act === 'drop' && resource === 'constraint') {
        const constraint = action['constraint'];
        const cLabel = typeof constraint === 'string' ? `"${constraint}"` : 'desconhecida';
        return {
            rule: 'DROP_CONSTRAINT',
            reason: `Remove a constraint ${cLabel} da tabela "${tbl}" — pode abrir a porta para dados invalidos / inconsistencia de integridade.`,
        };
    }
    // ALTER COLUMN ... TYPE ...
    if (act === 'alter' && resource === 'column') {
        return {
            rule: 'ALTER_COLUMN_TYPE',
            reason: `Altera o tipo da coluna ${colLabel} na tabela "${tbl}" — pode reescrever a tabela, travar a aplicacao e perder dados na conversao.`,
        };
    }
    // RENAME COLUMN ... / RENAME TABLE ...
    if (act === 'rename') {
        if (resource === 'table') {
            const newName = action['table'];
            const nLabel = typeof newName === 'string' ? `"${newName}"` : 'novo nome';
            return {
                rule: 'RENAME_COLUMN',
                reason: `Renomeia a tabela "${tbl}" para ${nLabel} — quebra todo codigo que ainda usa o nome antigo.`,
            };
        }
        return {
            rule: 'RENAME_COLUMN',
            reason: `Renomeia a coluna ${colLabel} na tabela "${tbl}" — quebra todo codigo que ainda usa o nome antigo.`,
        };
    }
    // acao de ALTER TABLE nao reconhecida -> fail-closed
    return {
        rule: 'UNKNOWN',
        reason: `Acao de ALTER TABLE nao reconhecida (${act || 'sem acao'}/${resource || 'sem recurso'}) na tabela "${tbl}" — tratada como destrutiva por seguranca (fail-closed).`,
    };
}
/**
 * Classifica um statement ja parseado (um no do AST).
 */
function classifyAst(ast) {
    const type = String(ast['type'] ?? '').toLowerCase();
    const keyword = String(ast['keyword'] ?? '').toLowerCase();
    // CREATE ...
    if (type === 'create') {
        if (keyword === 'table') {
            const tbl = tableName(ast['table']);
            return finalize('CREATE_TABLE', {
                rule: 'CREATE_TABLE',
                reason: `Cria a tabela "${tbl ?? 'nova'}" — seguro, nenhum dado existente e afetado.`,
            });
        }
        if (keyword === 'index') {
            const concurrently = ast['concurrently'];
            const isConcurrent = typeof concurrently === 'string' &&
                concurrently.toLowerCase().includes('concurrently');
            const idx = ast['index'];
            const idxLabel = typeof idx === 'string' ? `"${idx}"` : 'novo indice';
            const tbl = tableName(ast['table']);
            if (isConcurrent) {
                return finalize('CREATE_INDEX_CONCURRENTLY', {
                    rule: 'CREATE_INDEX_CONCURRENTLY',
                    reason: `Cria o indice ${idxLabel} em "${tbl ?? 'tabela'}" com CONCURRENTLY — seguro e sem lock de escrita na tabela.`,
                });
            }
            return finalize('CREATE_INDEX', {
                rule: 'CREATE_INDEX',
                reason: `Cria o indice ${idxLabel} em "${tbl ?? 'tabela'}" — seguro (considere CONCURRENTLY para evitar lock de escrita em tabelas grandes).`,
            });
        }
        // CREATE TYPE / SCHEMA / SEQUENCE / DOMAIN — objeto nomeado NOVO.
        // bug_59ee92b8 (2026-06-12): drizzle-kit emite `CREATE TYPE ... AS ENUM`
        // pra enums; o classificador so cobria table/index e caia no UNKNOWN
        // fail-closed -> destrutiva, marcando migracoes 100% aditivas como
        // destrutivas (forcava confirm --mfa). Criar um TYPE/SCHEMA/SEQUENCE/DOMAIN
        // e ADITIVO: cria um objeto novo, nao toca em nenhum dado existente (igual
        // CREATE TABLE). So pode falhar se o nome ja existir, mas falha de apply
        // != perda de dados (o rehearse efemero pega antes do push). NAO inclui
        // VIEW/FUNCTION/EXTENSION/MATERIALIZED VIEW de proposito: extensoes rodam
        // scripts de install arbitrarios e corpos de funcao sao codigo livre —
        // ficam no fail-closed ate haver necessidade comprovada.
        const additiveRule = ADDITIVE_CREATE_KEYWORDS[keyword];
        if (additiveRule) {
            const label = ADDITIVE_CREATE_LABELS[keyword] ?? keyword;
            return finalize(additiveRule, {
                rule: additiveRule,
                reason: `Cria um novo ${label} (CREATE ${keyword.toUpperCase()}) — aditivo, nenhum dado existente e afetado.`,
            });
        }
        // CREATE de outro tipo (view, function, extension, ...) -> fail-closed
        return finalize('UNKNOWN', {
            rule: 'UNKNOWN',
            reason: `Statement CREATE ${keyword || 'de tipo desconhecido'} nao esta na allowlist do classificador — tratado como destrutivo por seguranca (fail-closed).`,
        });
    }
    // DROP TABLE ...
    if (type === 'drop') {
        if (keyword === 'table') {
            const tbl = tableName(ast['name']);
            return finalize('DROP_TABLE', {
                rule: 'DROP_TABLE',
                reason: `Remove a tabela "${tbl ?? 'desconhecida'}" — perda permanente da tabela e de todos os seus dados.`,
            });
        }
        return finalize('UNKNOWN', {
            rule: 'UNKNOWN',
            reason: `Statement DROP ${keyword || 'de tipo desconhecido'} nao esta na allowlist do classificador — tratado como destrutivo por seguranca (fail-closed).`,
        });
    }
    // ALTER TABLE ... (uma ou mais acoes)
    if (type === 'alter') {
        const table = tableName(ast['table']);
        const exprRaw = ast['expr'];
        const actions = Array.isArray(exprRaw)
            ? exprRaw
            : exprRaw && typeof exprRaw === 'object'
                ? [exprRaw]
                : [];
        if (actions.length === 0) {
            return finalize('UNKNOWN', {
                rule: 'UNKNOWN',
                reason: `ALTER TABLE sem acao reconhecivel na tabela "${table ?? 'desconhecida'}" — tratado como destrutivo por seguranca (fail-closed).`,
            });
        }
        const hits = actions.map((a) => classifyAlterAction(a, table));
        // severidade do statement: destrutiva se QUALQUER acao for destrutiva
        const destructive = hits.find((h) => STATEMENT_RULES[h.rule] === 'destrutiva');
        if (destructive) {
            if (hits.length === 1)
                return finalize(destructive.rule, destructive);
            const reasons = hits.map((h) => h.reason).join(' ');
            return finalize('UNKNOWN', {
                rule: destructive.rule,
                reason: `ALTER TABLE com multiplas acoes, ao menos uma destrutiva. ${reasons}`,
            });
        }
        // todas aditivas
        if (hits.length === 1)
            return finalize(hits[0].rule, hits[0]);
        const reasons = hits.map((h) => h.reason).join(' ');
        return finalize(hits[0].rule, {
            rule: hits[0].rule,
            reason: `ALTER TABLE com multiplas acoes, todas aditivas. ${reasons}`,
        });
    }
    // Qualquer outra coisa: DML (delete/update/insert/select), truncate,
    // grant, etc. -> fail-closed.
    return finalize('UNKNOWN', {
        rule: 'UNKNOWN',
        reason: `Statement do tipo "${type || 'desconhecido'}" nao e DDL de schema reconhecido (ex.: DML como DELETE/UPDATE, TRUNCATE, GRANT) — tratado como destrutivo por seguranca (fail-closed).`,
    });
}
/**
 * Monta a `StatementClassification` final a partir de uma regra + motivo.
 * O `sql` e preenchido depois pelo chamador.
 */
function finalize(rule, hit) {
    const severity = STATEMENT_RULES[rule];
    const out = {
        sql: '',
        severity,
        reason: hit.reason,
    };
    if (severity === 'destrutiva') {
        out.suggestion = SUGGESTIONS[hit.rule] ?? SUGGESTIONS.UNKNOWN;
    }
    return out;
}
/**
 * Deteccao leve, baseada em palavra-chave, de um RENAME COLUMN que o parser
 * NAO consegue parsear (limitacao do node-sql-parser 5.x para a sintaxe
 * `ALTER TABLE ... RENAME COLUMN`). So e usada para dar um `reason` melhor;
 * a severidade ja seria destrutiva pelo caminho fail-closed de qualquer jeito.
 */
function detectUnparseableRename(rawSql) {
    const normalized = rawSql.replace(/\s+/g, ' ').trim().toUpperCase();
    if (/^ALTER\s+TABLE\s+.+\bRENAME\s+COLUMN\b/.test(normalized)) {
        return {
            rule: 'RENAME_COLUMN',
            reason: 'Renomeia uma coluna (ALTER TABLE ... RENAME COLUMN) — quebra todo codigo que ainda usa o nome antigo.',
        };
    }
    if (/^ALTER\s+TABLE\s+.+\bRENAME\s+TO\b/.test(normalized)) {
        return {
            rule: 'RENAME_COLUMN',
            reason: 'Renomeia uma tabela (ALTER TABLE ... RENAME TO) — quebra todo codigo que ainda usa o nome antigo.',
        };
    }
    return null;
}
/**
 * Deteccao leve, baseada em palavra-chave, de um CREATE de objeto nomeado novo
 * (TABLE/TYPE/SCHEMA/SEQUENCE/DOMAIN) que o parser NAO consegue parsear.
 *
 * Motivacao (bug_59ee92b8 2026-06-12): o node-sql-parser nao parseia
 * `CREATE TABLE ... (col "public"."meu_enum")` — colunas com tipo definido pelo
 * usuario (enum/composite com schema). Sem este fallback essas tabelas caiam no
 * UNKNOWN fail-closed -> destrutiva, e como a migracao drizzle tipica usa os
 * enums como tipo de coluna, a migracao inteira virava destrutiva mesmo sendo
 * 100% aditiva.
 *
 * SEGURANCA: um statement UNICO que comeca com `CREATE TABLE|TYPE|SCHEMA|
 * SEQUENCE|DOMAIN` e SEMPRE aditivo — cria um objeto novo, nao toca dado
 * existente, independentemente do corpo. So retornamos um hit aditivo se:
 *   1. o texto comeca com um desses CREATEs, E
 *   2. NAO ha um segundo statement escondido no chunk (`;` seguido de conteudo)
 *      — defesa caso o splitter nao tenha separado um statement composto.
 * Qualquer outra coisa retorna null e segue pro fail-closed.
 */
function detectUnparseableAdditiveCreate(rawSql) {
    const normalized = rawSql.replace(/\s+/g, ' ').trim();
    // Guard 2: rejeita chunk com 2+ statements (`;` seguido de algo nao-vazio).
    if (/;\s*\S/.test(normalized))
        return null;
    const m = /^CREATE\s+(TABLE|TYPE|SCHEMA|SEQUENCE|DOMAIN)\b/i.exec(normalized);
    if (!m)
        return null;
    // Guard 3 (SEGURANCA, auditoria 2026-06-30): a premissa "CREATE ... e SEMPRE
    // aditivo independente do corpo" e FALSA para CTAS com CTE que modifica dado:
    //   CREATE TABLE x AS WITH t AS (DELETE FROM y RETURNING *) SELECT * FROM t
    // o DELETE/UPDATE/INSERT/MERGE/TRUNCATE EXECUTA e altera dado existente -> NAO
    // e aditivo. Como esta funcao e o fallback de SQL NAO-parseavel, nao da pra
    // confiar na AST aqui; entao fail-CLOSED (return null -> destrutiva, exige
    // confirmacao MFA) se o statement contem qualquer keyword que modifica dado.
    // `CREATE TABLE (...)` puro e `CREATE TABLE AS SELECT ...` puro nao as contem.
    if (/\b(DELETE|UPDATE|INSERT|MERGE|TRUNCATE)\b/i.test(normalized))
        return null;
    const kw = m[1].toLowerCase();
    const ruleByKw = {
        table: 'CREATE_TABLE',
        type: 'CREATE_TYPE',
        schema: 'CREATE_SCHEMA',
        sequence: 'CREATE_SEQUENCE',
        domain: 'CREATE_DOMAIN',
    };
    const labelByKw = {
        table: 'tabela',
        type: 'tipo',
        schema: 'schema',
        sequence: 'sequence',
        domain: 'dominio',
    };
    const rule = ruleByKw[kw];
    return {
        rule,
        reason: `Cria ${kw === 'table' ? 'a' : 'um'} ${labelByKw[kw]} (CREATE ${kw.toUpperCase()}) — aditivo, nenhum dado existente e afetado. (parser nao reconheceu a sintaxe completa, ex.: coluna com tipo definido pelo usuario; classificado por palavra-chave.)`,
    };
}
/**
 * Agrega uma lista de classificacoes (uma por no de AST) numa unica
 * `StatementClassification`. Fail-closed: o chunk e `destrutiva` se QUALQUER
 * no for `destrutiva`, e o `reason`/`suggestion` refletem o no destrutivo.
 * Nunca descarta um no: o `astify` pode devolver varios nos a partir de um
 * unico chunk de texto, e perder o no destrutivo aplicaria uma migracao
 * perigosa sem a pausa de confirmacao.
 */
function aggregateNodeClassifications(results) {
    const destructive = results.find((r) => r.severity === 'destrutiva');
    if (destructive) {
        if (results.length === 1) {
            return {
                severity: 'destrutiva',
                reason: destructive.reason,
                ...(destructive.suggestion
                    ? { suggestion: destructive.suggestion }
                    : {}),
            };
        }
        const reasons = results.map((r) => r.reason).join(' ');
        return {
            severity: 'destrutiva',
            reason: `Chunk com multiplos statements, ao menos um destrutivo. ${reasons}`,
            suggestion: destructive.suggestion ?? SUGGESTIONS.UNKNOWN,
        };
    }
    // todos aditivos
    if (results.length === 1) {
        return { severity: 'aditiva', reason: results[0].reason };
    }
    const reasons = results.map((r) => r.reason).join(' ');
    return {
        severity: 'aditiva',
        reason: `Chunk com multiplos statements, todos aditivos. ${reasons}`,
    };
}
/**
 * Classifica um unico statement bruto (texto). Fail-closed: qualquer erro de
 * parse vira `destrutiva` com a regra UNKNOWN.
 *
 * Nota: o `astify` do node-sql-parser pode devolver um ARRAY de nos quando o
 * texto contem mais de um statement. Nesse caso classificamos TODOS os nos e
 * agregamos — nunca apenas o primeiro. Exportada para teste direto do caminho
 * multi-AST.
 */
export function classifyOneStatement(rawSql) {
    const sql = rawSql.trim();
    // SEGURANCA (auditoria 2026-06-30): um CTAS — `CREATE TABLE|MATERIALIZED VIEW
    // ... AS <query>` — pode EXECUTAR DML via CTE:
    //   CREATE TABLE x AS WITH t AS (DELETE FROM y WHERE ... RETURNING *) SELECT * FROM t
    // o DELETE/UPDATE/INSERT/MERGE/TRUNCATE roda e ALTERA dado existente. O
    // node-sql-parser PARSEIA isso como um simples 'create table' (classifyAst ->
    // aditiva) e, no caminho nao-parseavel, o fallback por palavra-chave tambem
    // dava aditiva -> ambos BYPASSAVAM o gate de confirmacao MFA de migracao
    // destrutiva. Fail-CLOSED ANTES de qualquer AST/fallback: se um CREATE
    // TABLE/MATERIALIZED VIEW e um CTAS (tem `AS`) e contem keyword que modifica
    // dado, e destrutivo. `CREATE TABLE (...)` puro e `CREATE TABLE AS SELECT`
    // puro nao tem essas keywords -> seguem aditivos pelo caminho normal.
    const normForCtas = sql.replace(/\s+/g, ' ');
    if (/^CREATE\s+(?:TABLE|MATERIALIZED\s+VIEW)\b/i.test(normForCtas) &&
        /\bAS\b/i.test(normForCtas) &&
        /\b(?:DELETE|UPDATE|INSERT|MERGE|TRUNCATE)\b/i.test(normForCtas)) {
        return {
            sql,
            severity: 'destrutiva',
            reason: 'CREATE ... AS (CTAS) com CTE/subquery que modifica dado (DELETE/UPDATE/INSERT/MERGE/TRUNCATE) — executa DML e altera dado existente; tratado como destrutivo por seguranca (fail-closed).',
            suggestion: SUGGESTIONS.UNKNOWN,
        };
    }
    const parser = new Parser();
    try {
        const ast = parser.astify(sql, PARSER_OPTIONS);
        // astify pode devolver um ARRAY (multi-statement) ou um objeto unico.
        // SEGURANCA: quando for array, TODOS os nos sao classificados e agregados
        // (destrutivo se qualquer um for) — nunca apenas `ast[0]`. Classificar so
        // o primeiro perderia, p.ex., um DROP TABLE escondido depois de um
        // CREATE TABLE e aplicaria a migracao destrutiva sem confirmacao.
        const nodes = Array.isArray(ast) ? ast : [ast];
        const validNodes = nodes.filter((node) => node != null && typeof node === 'object');
        if (validNodes.length === 0) {
            return {
                sql,
                severity: 'destrutiva',
                reason: 'Nao foi possivel obter um AST utilizavel para este statement — tratado como destrutivo por seguranca (fail-closed).',
                suggestion: SUGGESTIONS.UNKNOWN,
            };
        }
        // Se o astify descartou nos (array tinha entradas nao-objeto), fail-closed:
        // nao da pra provar que o que sobrou e seguro.
        if (validNodes.length !== nodes.length) {
            return {
                sql,
                severity: 'destrutiva',
                reason: 'O parser devolveu nos de AST nao utilizaveis neste chunk — tratado como destrutivo por seguranca (fail-closed).',
                suggestion: SUGGESTIONS.UNKNOWN,
            };
        }
        const perNode = validNodes.map((node) => classifyAst(node));
        const aggregated = aggregateNodeClassifications(perNode);
        return { sql, ...aggregated };
    }
    catch {
        // Parse falhou. Antes de cair no UNKNOWN generico, tenta detectar um
        // RENAME que o parser nao suporta — so para um motivo mais especifico.
        const renameHit = detectUnparseableRename(sql);
        if (renameHit) {
            return {
                sql,
                severity: STATEMENT_RULES[renameHit.rule], // destrutiva
                reason: renameHit.reason,
                suggestion: SUGGESTIONS[renameHit.rule] ?? SUGGESTIONS.UNKNOWN,
            };
        }
        // CREATE de objeto nomeado novo que o parser nao parseou (ex.: CREATE TABLE
        // com coluna de tipo definido pelo usuario) — aditivo (bug_59ee92b8).
        const additiveHit = detectUnparseableAdditiveCreate(sql);
        if (additiveHit) {
            return {
                sql,
                severity: STATEMENT_RULES[additiveHit.rule], // aditiva
                reason: additiveHit.reason,
            };
        }
        return {
            sql,
            severity: 'destrutiva',
            reason: 'Statement SQL nao pode ser parseado (sintaxe nao reconhecida pelo parser) — tratado como destrutivo por seguranca (fail-closed).',
            suggestion: SUGGESTIONS.UNKNOWN,
        };
    }
}
/**
 * Classifica uma migracao SQL inteira (que pode conter varios statements
 * separados por `;`). Funcao pura, deterministica, sem I/O.
 */
export function classifyMigration(sql) {
    const input = typeof sql === 'string' ? sql : '';
    // Input vazio / so espacos / so comentarios -> nada a aplicar.
    if (isEffectivelyEmpty(input)) {
        return {
            overallSeverity: 'aditiva',
            statements: [],
            requiresConfirmation: false,
        };
    }
    const rawStatements = splitSqlStatements(input).filter((s) => !isEffectivelyEmpty(s));
    if (rawStatements.length === 0) {
        return {
            overallSeverity: 'aditiva',
            statements: [],
            requiresConfirmation: false,
        };
    }
    const statements = rawStatements.map(classifyOneStatement);
    const overallSeverity = statements.some((s) => s.severity === 'destrutiva')
        ? 'destrutiva'
        : 'aditiva';
    return {
        overallSeverity,
        statements,
        requiresConfirmation: overallSeverity === 'destrutiva',
    };
}
/**
 * Descricao humana de uma linha (PT-BR) de uma classificacao de statement.
 * Usada pelo `neetru db diff`. Funcao pura de formatacao de string.
 */
export function explainStatement(c) {
    const tag = c.severity === 'destrutiva' ? 'DESTRUTIVA' : 'ADITIVA';
    return `[${tag}] ${c.reason}`;
}
//# sourceMappingURL=classify.js.map