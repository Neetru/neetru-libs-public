/**
 * Planejamento PURO da reconciliacao aditiva: dado o que a migracao DECLARA e o
 * que o banco TEM VIVO, calcula os `ALTER TABLE ADD COLUMN IF NOT EXISTS` a rodar.
 *
 * A parte de I/O (introspectar o banco, rodar os ALTER) NAO mora aqui — e
 * por-ambiente: o Core usa um client node-pg (`db.execute`), o agente usa `psql`
 * por stdin/stdout. Ambos: `parseDeclaredColumns` → `buildIntrospectionQuery` →
 * (introspecta) → `planAdditiveReconciliation` → (roda cada `alter.sql`,
 * try/catch fail-open, classifica healed/unhealed).
 *
 * Garantias: ADITIVO-only (so `ADD COLUMN IF NOT EXISTS`, nunca DROP/ALTER TYPE),
 * so cura tabela EXISTENTE (colunas vivas > 0 — tabela nova recem-criada e
 * ignorada), fail-safe. Zero dependencias.
 */

import type {
  DeclaredColumn,
  IntrospectedColumn,
  ReconciliationAlter,
  ReconciliationPlan,
} from './types.js';

/** Escapa um identificador pra interpolar com seguranca dentro de `"..."`. */
export function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

/**
 * Remove `PRIMARY KEY` inline da definicao de uma coluna antes de montar o
 * `ADD COLUMN`. `ADD COLUMN ... PRIMARY KEY` numa tabela existente (que ja tem
 * PK) falharia; e a coluna faltante nunca e a PK da tabela. Scanner
 * literal-aware: so remove PRIMARY KEY FORA de aspas simples (senao corromperia
 * `DEFAULT 'PRIMARY KEY'` ou colapsaria espacos dentro de literais).
 */
export function stripInlinePrimaryKey(def: string): string {
  let out = '';
  let i = 0;
  const n = def.length;
  let inSq = false;
  while (i < n) {
    const ch = def[i] as string;
    if (inSq) {
      out += ch;
      if (ch === "'") {
        if (def[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        inSq = false;
      }
      i++;
      continue;
    }
    if (ch === "'") {
      inSq = true;
      out += ch;
      i++;
      continue;
    }
    const m = /^PRIMARY\s+KEY\b/i.exec(def.slice(i));
    if (m) {
      out += ' ';
      i += (m[0] as string).length;
      continue;
    }
    out += ch;
    i++;
  }
  return out.trim();
}

/**
 * Monta o `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` pra uma coluna declarada
 * faltante. Aditivo + idempotente; a def perde `PRIMARY KEY` inline.
 */
export function buildAlterColumnSql(table: string, column: DeclaredColumn): string {
  const def = stripInlinePrimaryKey(column.definition);
  return (
    `ALTER TABLE ${quoteIdent(table)} ADD COLUMN IF NOT EXISTS ${quoteIdent(column.name)}` +
    (def ? ` ${def}` : '')
  );
}

/**
 * Monta o SELECT que introspecta as colunas vivas das `tableNames` no schema
 * `public`. Postgres-only (em MySQL `table_schema='public'` devolve zero linhas
 * → degrada gracioso pra "sem drift"). Nomes escapados por seguranca (vem do
 * parse do proprio SQL, mas o resultado vira SQL cru).
 *
 * Devolve `null` se nao ha tabelas a introspectar (o consumidor pula o I/O).
 */
export function buildIntrospectionQuery(tableNames: string[]): string | null {
  if (tableNames.length === 0) return null;
  const inList = tableNames.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ');
  return (
    `SELECT table_name, column_name FROM information_schema.columns ` +
    `WHERE table_schema = 'public' AND table_name IN (${inList})`
  );
}

/**
 * Diff PURO: dado o que a migracao declara (`declared`) e as colunas vivas
 * introspectadas (`introspected`), devolve os ALTER a rodar.
 *
 * Regra (identica a reconcileSchemaPostApply do Core):
 *   - Tabela sem NENHUMA coluna viva = nova (o CREATE criou tudo) OU
 *     nao-introspectavel → NAO e drift, pula (so curamos tabela confirmada
 *     existente).
 *   - Pra tabela existente, cada coluna declarada AUSENTE nas vivas → um ALTER
 *     ADD COLUMN aditivo.
 */
export function planAdditiveReconciliation(
  declared: Map<string, DeclaredColumn[]>,
  introspected: IntrospectedColumn[],
): ReconciliationPlan {
  const realByTable = new Map<string, Set<string>>();
  for (const row of introspected) {
    if (!row || typeof row.table !== 'string' || typeof row.column !== 'string') continue;
    if (!row.table || !row.column) continue;
    let set = realByTable.get(row.table);
    if (!set) {
      set = new Set<string>();
      realByTable.set(row.table, set);
    }
    set.add(row.column);
  }

  const alters: ReconciliationAlter[] = [];
  for (const [table, columns] of declared) {
    const realCols = realByTable.get(table);
    if (!realCols || realCols.size === 0) continue; // tabela nova/nao-introspectavel — nao e drift
    for (const col of columns) {
      if (realCols.has(col.name)) continue; // coluna ja existe
      alters.push({ table, column: col.name, sql: buildAlterColumnSql(table, col) });
    }
  }
  return { alters };
}
