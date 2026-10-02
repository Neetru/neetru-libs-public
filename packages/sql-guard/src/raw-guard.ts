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
 * Caracteres de controle recusados: todo o range C0 (U+0000–U+001F) EXCETO
 * `\t` (U+0009) e `\n` (U+000A), mais DEL + C1 (U+007F–U+009F). Inclui CR
 * (U+000D), NUL, \v, \f, \b.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

/**
 * Delimitador de dollar-quote com tag contendo caractere fora de `[A-Za-z0-9_]`.
 *
 * `\$` + tag-chars ASCII validos (possivelmente vazio) + PELO MENOS UM caractere
 * ofensor (nao-espaco, nao-`$`, fora de `[A-Za-z0-9_]`) + mais tag-chars
 * nao-espaco/nao-`$` + `\$`. A proibicao de espaco e de `$` no meio impede
 * falso-positivo com parametros posicionais (`WHERE a > $1 AND b < $2` nao casa:
 * ha espaco entre eles) e com valores monetarios (`$5.00 ... $0.50` nao fecha
 * par antes de um espaco).
 */
const BAD_DOLLAR_QUOTE_TAG = /\$[A-Za-z0-9_]*[^\s$A-Za-z0-9_][^\s$]*\$/;

/**
 * Devolve uma mensagem de recusa PT-BR se o SQL cru contem uma divergencia de
 * lexer conhecida entre o parser e o Postgres; senao `null`.
 */
export function detectRawLexerHazard(sql: string): string | null {
  const ctrl = CONTROL_CHARS.exec(sql);
  if (ctrl) {
    const code = ctrl[0].codePointAt(0) ?? 0;
    const hex = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
    if (code === 13) {
      return (
        'SQL contem retorno de carro (CR, \\r). O Postgres fecha o comentario ' +
        'de linha `--` no CR, mas o parser so fecha no `\\n` — o texto apos o ' +
        'CR seria comentario para o guard e CODIGO para o banco. Recusado por ' +
        'seguranca (fail-closed). Use `\\n` (nova linha) para quebrar linhas.'
      );
    }
    return (
      `SQL contem caractere de controle (${hex}) que o parser e o banco podem ` +
      'tratar de forma diferente — recusado por seguranca (fail-closed). ' +
      'Apenas `\\n` (nova linha) e `\\t` (tabulacao) sao permitidos como ' +
      'controle; remova os demais.'
    );
  }

  if (BAD_DOLLAR_QUOTE_TAG.test(sql)) {
    return (
      'SQL contem tag de dollar-quote com caractere fora de [A-Za-z0-9_] (ex.: ' +
      '`$é$`). O Postgres aceita a tag mas o parser desalinha o fim da string, ' +
      'escondendo codigo do guard — recusado por seguranca (fail-closed). Use ' +
      'tag de dollar-quote so com letras ASCII, digitos e underscore (`$tag$`), ' +
      'ou aspas simples com `\'\'` para escapar.'
    );
  }

  return null;
}
