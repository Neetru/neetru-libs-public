/**
 * Parser char-a-char de `CREATE TABLE` Postgres → colunas declaradas por tabela.
 *
 * Robusto a: strings (`'...'` com `''`), identificadores (`"..."` com `""`),
 * dollar-quoting (`$$...$$` / `$tag$...$tag$`, inclui `DO $$ ... END $$`),
 * comentarios (linha `--` e bloco), o separador nativo do drizzle-kit
 * `--> statement-breakpoint`, tipos multi-palavra (`timestamp with time zone`),
 * `numeric(10,2)`, defaults com virgula/parenteses em literal, constraints de
 * tabela (puladas), `LIKE ... INCLUDING` (pulado) e schema-qualificacao
 * (`public.t` aceito; schema != public pulado por seguranca).
 *
 * Zero dependencias. Estes helpers ja passaram por revisao adversarial de 4
 * lentes (2026-08-07); os cenarios de defeito (breakpoint, literais, cross-schema,
 * LIKE) estao cobertos em `parse.test.ts`.
 */

import type { DeclaredColumn } from './types.js';

/** Palavras que iniciam uma CONSTRAINT de tabela (NAO sao colunas). */
const TABLE_CONSTRAINT_KEYWORDS = [
  'CONSTRAINT',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'UNIQUE',
  'CHECK',
  'EXCLUDE',
] as const;

/** Avanca o indice ate logo depois de uma string `'...'` (com `''` como escape). */
function skipSingleQuoted(s: string, i: number): number {
  let j = i + 1;
  const n = s.length;
  while (j < n) {
    if (s[j] === "'" && s[j + 1] === "'") {
      j += 2;
      continue;
    }
    if (s[j] === "'") return j + 1;
    j++;
  }
  return n; // string nao fechada — consome o resto (defensivo)
}

/** Avanca ate logo depois de um identificador `"..."` (com `""` como escape). */
function skipDoubleQuoted(s: string, i: number): number {
  let j = i + 1;
  const n = s.length;
  while (j < n) {
    if (s[j] === '"' && s[j + 1] === '"') {
      j += 2;
      continue;
    }
    if (s[j] === '"') return j + 1;
    j++;
  }
  return n;
}

/**
 * Se `s[i]` inicia um bloco dollar-quoted (`$$...$$` ou `$tag$...$tag$`), avanca
 * ate logo depois do delimitador de fechamento e devolve esse indice. Caso
 * contrario devolve `i` (nao era dollar-quote — ex.: `$1` posicional, `$` solto).
 * Cobre os guards `DO $$ ... END $$;` que o drizzle-kit gera pra CREATE TYPE.
 */
function skipDollarQuoted(s: string, i: number): number {
  const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i));
  if (!tag) return i;
  const delim = tag[0];
  const end = s.indexOf(delim, i + delim.length);
  return end === -1 ? s.length : end + delim.length;
}

/**
 * Se `s[i]` inicia um comentario — de linha (`--`) ou de bloco (barra-estrela …
 * estrela-barra) — avanca ate o fim dele. Caso contrario devolve `i`.
 */
function skipComment(s: string, i: number): number {
  const n = s.length;
  if (s[i] === '-' && s[i + 1] === '-') {
    let j = i + 2;
    while (j < n && s[j] !== '\n') j++;
    return j;
  }
  if (s[i] === '/' && s[i + 1] === '*') {
    let j = i + 2;
    while (j < n && !(s[j] === '*' && s[j + 1] === '/')) j++;
    return Math.min(j + 2, n);
  }
  return i;
}

/**
 * Divide um script SQL Postgres em statements de nivel-superior, respeitando
 * strings (`'...'`), identificadores (`"..."`), dollar-quoting (`$$...$$` — inclui
 * blocos `DO $$ ... END $$`) e comentarios (linha `--` e bloco). O `;` so corta no
 * nivel superior. Statements vazios sao omitidos.
 */
function splitPgStatements(sql: string): string[] {
  const out: string[] = [];
  let current = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if ((ch === '-' && sql[i + 1] === '-') || (ch === '/' && sql[i + 1] === '*')) {
      const j = skipComment(sql, i);
      // Comentario e NAO-semantico: substitui por um espaco em vez de reter o
      // texto. Sem isso, o separador nativo do drizzle-kit `--> statement-breakpoint`
      // (e qualquer comentario de cabecalho) ficava colado como PREFIXO do proximo
      // chunk, e `parseCreateTableStatement` (ancora `^CREATE TABLE`) descartava a
      // tabela — so a 1a CREATE TABLE do script era vista. O espaco preserva a
      // fronteira de token.
      current += ' ';
      i = j;
      continue;
    }
    if (ch === "'") {
      const j = skipSingleQuoted(sql, i);
      current += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '"') {
      const j = skipDoubleQuoted(sql, i);
      current += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '$') {
      const j = skipDollarQuoted(sql, i);
      if (j !== i) {
        current += sql.slice(i, j);
        i = j;
        continue;
      }
    }
    if (ch === ';') {
      const t = current.trim();
      if (t) out.push(t);
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Le a cadeia de identificadores do nome da tabela logo apos
 * `CREATE TABLE [IF NOT EXISTS] ` — aceita quoted (`"t"`), unquoted (`t`) e
 * schema-qualificado (`"public"."t"` / `public.t`). Devolve o ULTIMO componente
 * (o nome da tabela) + o schema (penultimo, se houver) + chars consumidos.
 */
function parseTableName(
  s: string,
): { table: string; schema?: string; consumed: number } | null {
  let i = 0;
  const n = s.length;
  while (i < n && /\s/.test(s[i] as string)) i++;
  const parts: string[] = [];
  for (;;) {
    if (i >= n) break;
    const ch = s[i];
    if (ch === '"') {
      let j = i + 1;
      let ident = '';
      while (j < n) {
        if (s[j] === '"' && s[j + 1] === '"') {
          ident += '"';
          j += 2;
          continue;
        }
        if (s[j] === '"') {
          j++;
          break;
        }
        ident += s[j];
        j++;
      }
      parts.push(ident);
      i = j;
    } else if (/[A-Za-z_]/.test(ch as string)) {
      let j = i;
      let ident = '';
      while (j < n && /[A-Za-z0-9_$]/.test(s[j] as string)) {
        ident += s[j];
        j++;
      }
      parts.push(ident);
      i = j;
    } else {
      break;
    }
    if (i < n && s[i] === '.') {
      i++;
      continue;
    }
    break;
  }
  const table = parts[parts.length - 1] ?? '';
  if (!table) return null;
  const schema = parts.length > 1 ? parts[parts.length - 2] : undefined;
  return { table, ...(schema ? { schema } : {}), consumed: i };
}

/**
 * Do indice de um `(`, devolve o conteudo ate o `)` que casa (respeitando parens
 * aninhados + quotes + dollar). `null` se desbalanceado.
 */
function extractParenBody(s: string, open: number): string | null {
  let depth = 0;
  let i = open;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === "'") {
      i = skipSingleQuoted(s, i);
      continue;
    }
    if (ch === '"') {
      i = skipDoubleQuoted(s, i);
      continue;
    }
    if (ch === '$') {
      const j = skipDollarQuoted(s, i);
      if (j !== i) {
        i = j;
        continue;
      }
    }
    if (ch === '(') {
      depth++;
      i++;
      continue;
    }
    if (ch === ')') {
      depth--;
      if (depth === 0) return s.slice(open + 1, i);
      i++;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Divide o corpo de um `CREATE TABLE (...)` nas virgulas de nivel-superior
 * (respeitando parens aninhados — ex.: `numeric(10,2)` — + quotes + dollar).
 */
function splitTopLevelCommas(body: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;
  const n = body.length;
  while (i < n) {
    const ch = body[i];
    if (ch === "'") {
      const j = skipSingleQuoted(body, i);
      current += body.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '"') {
      const j = skipDoubleQuoted(body, i);
      current += body.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '$') {
      const j = skipDollarQuoted(body, i);
      if (j !== i) {
        current += body.slice(i, j);
        i = j;
        continue;
      }
    }
    if (ch === '(') {
      depth++;
      current += ch;
      i++;
      continue;
    }
    if (ch === ')') {
      depth--;
      current += ch;
      i++;
      continue;
    }
    if (ch === ',' && depth === 0) {
      const t = current.trim();
      if (t) items.push(t);
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  const tail = current.trim();
  if (tail) items.push(tail);
  return items;
}

/**
 * Classifica um item do corpo do CREATE TABLE como COLUNA (nome + def) ou como
 * CONSTRAINT de tabela / elemento `LIKE` (→ `null`, ignorado).
 */
function parseColumnItem(item: string): DeclaredColumn | null {
  const trimmed = item.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('"')) {
    let j = 1;
    let name = '';
    const n = trimmed.length;
    while (j < n) {
      if (trimmed[j] === '"' && trimmed[j + 1] === '"') {
        name += '"';
        j += 2;
        continue;
      }
      if (trimmed[j] === '"') {
        j++;
        break;
      }
      name += trimmed[j];
      j++;
    }
    const definition = trimmed.slice(j).trim();
    if (!name) return null;
    return { name, definition };
  }

  // `LIKE origem [INCLUDING ...]` e um ELEMENTO de tabela (copia de colunas),
  // nao uma coluna — sem isto o regex abaixo capturaria uma coluna espuria `LIKE`.
  if (/^LIKE\s/i.test(trimmed)) return null;

  const upperNorm = trimmed.toUpperCase().replace(/\s+/g, ' ');
  for (const kw of TABLE_CONSTRAINT_KEYWORDS) {
    if (upperNorm === kw || upperNorm.startsWith(`${kw} `) || upperNorm.startsWith(`${kw}(`)) {
      return null; // constraint de tabela — nao e coluna
    }
  }

  const m = /^([A-Za-z_][A-Za-z0-9_$]*)\s+([\s\S]+)$/.exec(trimmed);
  if (!m) return null;
  return { name: m[1] as string, definition: (m[2] as string).trim() };
}

/**
 * Parseia UM statement `CREATE TABLE [IF NOT EXISTS] <name> ( ... )` → nome da
 * tabela + colunas declaradas. `null` se nao for CREATE TABLE, for malformado,
 * ou for de um schema != public (guard cross-schema — a reconciliacao e
 * public-only, um ALTER em schema alheio cairia na tabela public homonima).
 */
function parseCreateTableStatement(
  stmt: string,
): { table: string; columns: DeclaredColumn[] } | null {
  const head = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i.exec(stmt);
  if (!head) return null;
  let rest = stmt.slice((head[0] as string).length);
  const nameParsed = parseTableName(rest);
  if (!nameParsed) return null;
  if (nameParsed.schema && nameParsed.schema.toLowerCase() !== 'public') {
    return null;
  }
  rest = rest.slice(nameParsed.consumed);
  const open = rest.indexOf('(');
  if (open === -1) return null;
  const body = extractParenBody(rest, open);
  if (body === null) return null;
  const columns: DeclaredColumn[] = [];
  for (const item of splitTopLevelCommas(body)) {
    const col = parseColumnItem(item);
    if (col) columns.push(col);
  }
  return { table: nameParsed.table, columns };
}

/**
 * Extrai, de um script de migracao, as colunas declaradas POR TABELA a partir de
 * todos os `CREATE TABLE [IF NOT EXISTS]`. Pula blocos `DO $$..$$`, constraints de
 * tabela e qualquer statement que nao seja CREATE TABLE public.
 *
 * So Postgres. Se a mesma tabela aparecer 2x, mescla (primeira definicao de cada
 * coluna vence).
 */
export function parseDeclaredColumns(sql: string): Map<string, DeclaredColumn[]> {
  const result = new Map<string, DeclaredColumn[]>();
  for (const stmt of splitPgStatements(sql)) {
    const parsed = parseCreateTableStatement(stmt);
    if (!parsed) continue;
    const existing = result.get(parsed.table);
    if (!existing) {
      result.set(parsed.table, parsed.columns);
      continue;
    }
    for (const col of parsed.columns) {
      if (!existing.some((c) => c.name === col.name)) existing.push(col);
    }
  }
  return result;
}
