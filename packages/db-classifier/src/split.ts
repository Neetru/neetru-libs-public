/**
 * Divisor de SQL em statements individuais, preservando o texto bruto.
 *
 * O `node-sql-parser` consegue parsear SQL multi-statement, mas ao re-serializar
 * perde a formatacao original. Para o campo `sql` de cada `StatementClassification`
 * precisamos do texto EXATO que o dev escreveu, entao fazemos o split nos mesmos.
 *
 * O split respeita:
 *  - literais de string entre aspas simples (`'...'`, com `''` como escape)
 *  - identificadores entre aspas duplas (`"..."`)
 *  - dollar-quoting do Postgres (`$$...$$`, `$tag$...$tag$`)
 *  - comentarios de linha (`-- ...`) e de bloco (barra-estrela ... estrela-barra)
 *
 * Um `;` so termina um statement quando esta fora de todos esses contextos.
 */

/**
 * Abertura valida de dollar-quote do Postgres: `$` + tag opcional
 * (`[A-Za-z_][A-Za-z0-9_]*`) + `$`. Regex STICKY (`y`) — casa apenas na
 * posicao corrente do scanner (`lastIndex`), sem alocar substrings.
 *
 * IMPORTANTE: parametros posicionais (`$1`, `$2`, ...) NAO casam — `1` nao e
 * `[A-Za-z_]` e nao ha `$` de fechamento — logo nunca disparam o estado de
 * dollar-quote. So e considerado opener quando o scanner NAO esta dentro de
 * outro contexto (string, identificador, comentario ou outro dollar-quote),
 * o que e garantido pela ordem dos `if`/`continue` no loop abaixo.
 */
const DOLLAR_OPEN = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/y;

export function splitSqlStatements(input: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i]!;
    const next = i + 1 < n ? input[i + 1] : '';

    // comentario de linha
    if (ch === '-' && next === '-') {
      let j = i;
      while (j < n && input[j] !== '\n') j++;
      current += input.slice(i, j);
      i = j;
      continue;
    }

    // comentario de bloco
    if (ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n && !(input[j] === '*' && input[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);
      current += input.slice(i, j);
      i = j;
      continue;
    }

    // literal de string com aspas simples
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (input[j] === "'") {
          if (input[j + 1] === "'") {
            j += 2; // aspa escapada
            continue;
          }
          j++; // fecha
          break;
        }
        j++;
      }
      current += input.slice(i, j);
      i = j;
      continue;
    }

    // identificador com aspas duplas
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (input[j] === '"') {
          if (input[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      current += input.slice(i, j);
      i = j;
      continue;
    }

    // dollar-quoting: $tag$ ... $tag$ (token-boundary-aware via regex sticky).
    // So entramos aqui se NAO estivermos dentro de string/identificador/
    // comentario — os `if`/`continue` acima ja consumiram esses contextos.
    if (ch === '$') {
      // Dollar-quote so abre num limite de token — nunca quando o `$` esta
      // colado a um caractere de identificador (ex.: `foo$bar$baz`, onde `$`
      // e parte do identificador). PG so aceita dollar-quote apos
      // espaco/delimitador/inicio de input.
      const prev = i > 0 ? input[i - 1]! : '';
      const atBoundary = i === 0 || !/[A-Za-z0-9_$]/.test(prev);
      DOLLAR_OPEN.lastIndex = i;
      const tagMatch = atBoundary ? DOLLAR_OPEN.exec(input) : null;
      if (tagMatch && tagMatch.index === i) {
        const tag = tagMatch[0]; // ex.: "$$" ou "$body$"
        // O bloco fecha no PROXIMO token $tag$ EXATAMENTE igual.
        const closeIdx = input.indexOf(tag, i + tag.length);
        const end = closeIdx === -1 ? n : closeIdx + tag.length;
        current += input.slice(i, end);
        i = end;
        continue;
      }
      // `$` que nao forma opener valido (ex.: param posicional `$1`):
      // cai no caminho normal abaixo, tratado como caractere comum.
    }

    // separador de statement
    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);

  return statements;
}

/**
 * Remove comentarios e espacos de um statement para checar se "sobra" algo
 * executavel. Usado para descartar trechos so-comentario.
 */
export function isEffectivelyEmpty(stmt: string): boolean {
  const stripped = stmt
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .trim();
  return stripped.length === 0;
}
