/**
 * `detectRawLexerHazard` — guarda de TEXTO CRU (antes de qualquer parse).
 *
 * node-sql-parser e o Postgres NAO lexam SQL de forma identica. Alguns padroes
 * fazem o parser ver UM statement de leitura seguro enquanto o banco executa
 * codigo escondido. Como o parser e o banco discordam, nenhuma checagem baseada
 * no AST pega esses casos — eles precisam ser barrados no texto cru, fail-closed.
 *
 * Mesma familia e mesma estrategia do `\'`/`\"` (bug_4eb8f07d): recusar no raw.
 *
 * Divergencias cobertas (todas reproduzidas em Postgres real — PGlite):
 *
 *  1. Retorno de carro (CR, \r) e demais caracteres de controle.
 *     O comentario de linha `--` do Postgres fecha em `[\n\r]` (scan.l); o lexer
 *     do node-sql-parser fecha SO no `\n` (`--[^\n]*`). Entao em
 *       SELECT 1 --x\r, pg_advisory_lock(8)
 *     o guard trata `--x\r, pg_advisory_lock(8)` inteiro como comentario (ve so
 *     `SELECT 1`, safe:true), mas o PG fecha o comentario no `\r` e EXECUTA o
 *     `, pg_advisory_lock(8)` — lock preso na conexao do pool PgBouncer
 *     (pool_mode=transaction). No write, `UPDATE t SET a=1 --x\r, b=2 WHERE id=5`
 *     esconde o segundo SET do `assertNonTrivialWhere`. (bug_0aea20a4)
 *     Fail-closed: um visualizador read-only nunca precisa de CR nem de nenhum
 *     caractere de controle cru no SQL. Recusamos todo controle C0/C1 + DEL,
 *     EXCETO `\n` (quebra de linha legitima) e `\t` (tabulacao). Isso inclui NUL
 *     (que o protocolo do PG nem aceita), \v, \f, \b, etc. U+2028/U+2029 (line/
 *     paragraph separator do Unicode) foram verificados: o PG NAO os trata como
 *     fim de comentario `--`, entao NAO divergem e NAO sao bloqueados (evita
 *     recusar texto Unicode legitimo dentro de string).
 *
 *  2. Tag de dollar-quote com caractere fora de `[A-Za-z0-9_]`.
 *     O PG aceita tag de dollar-quote com letra nao-ASCII (`$é$`, regra de
 *     identificador). O node-sql-parser desalinha o fim do dollar-quote nesses
 *     casos: em `SELECT $é$a$$b$é$ AS z, pg_advisory_lock(202)` o parser ve a
 *     string terminada em outro ponto e o `, pg_advisory_lock(202)` fica
 *     escondido do guard (safe:true), mas o PG executa (lock tomado — divergencia
 *     reproduzida). Recusamos qualquer delimitador `$<tag>$` cuja tag contenha um
 *     caractere fora de `[A-Za-z0-9_]`. NAO afeta parametros posicionais (`$1`,
 *     `$2`), dollar-quote de tag vazia (`$$...$$`) nem tags ASCII (`$tag$`).
 */
/**
 * Devolve uma mensagem de recusa PT-BR se o SQL cru contem uma divergencia de
 * lexer conhecida entre o parser e o Postgres; senao `null`.
 */
export declare function detectRawLexerHazard(sql: string): string | null;
