/**
 * Utilitários de travessia do AST do `node-sql-parser`.
 *
 * O AST é uma árvore heterogênea de objetos e arrays sem schema estável entre
 * versões — subqueries, CTEs, argumentos de função, cláusulas WHERE etc. todos
 * aninham nós de forma irregular. Para garantir que NADA passe despercebido
 * (uma função bloqueada escondida três níveis abaixo num subquery, p.ex.), a
 * detecção de risco precisa de uma travessia genérica que visita CADA nó.
 */

import { DANGEROUS_FUNCTIONS } from './blocklist.js';

/** Um nó qualquer do AST. */
export type AstNode = unknown;

/**
 * Visita recursivamente CADA nó do AST, chamando `visit` em cada objeto.
 *
 * Anda em objetos e arrays indistintamente. Usa um `WeakSet` de visitados para
 * não entrar em loop caso o parser produza referências cíclicas (defensivo —
 * o node-sql-parser normalmente não produz ciclos, mas a travessia precisa ser
 * à prova de tudo já que é código de segurança).
 */
export function walkAst(
  root: AstNode,
  visit: (node: Record<string, unknown>) => void,
): void {
  const seen = new WeakSet<object>();

  function recur(node: AstNode): void {
    if (node == null || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const child of node) recur(child);
      return;
    }

    const obj = node as Record<string, unknown>;
    visit(obj);
    for (const key of Object.keys(obj)) {
      recur(obj[key]);
    }
  }

  recur(root);
}

/**
 * Extrai o nome de uma função a partir de um nó `function` / `aggr_func` do
 * node-sql-parser. A forma do campo `name` varia entre versões:
 *  - string direta: `name: "pg_sleep"`
 *  - `{ name: [{ value: "pg_sleep" }] }` (forma 5.x)
 *  - `{ schema, name }` qualificado
 * Junta todos os segmentos de identificador que encontrar e devolve o ÚLTIMO
 * (o nome da função em si, ignorando o schema). Devolve `null` se não achar.
 */
function functionNameOf(node: Record<string, unknown>): string | null {
  const raw = node['name'];
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;

  // coleta recursivamente todos os `value` string dentro de `name`
  const segments: string[] = [];
  walkAst(raw, (n) => {
    const v = n['value'];
    if (typeof v === 'string') segments.push(v);
  });
  if (segments.length === 0) return null;
  // o último segmento é o nome da função (anteriores seriam schema/catálogo)
  return segments[segments.length - 1] ?? null;
}

/**
 * Tenta extrair um nome de funcao de UM NO QUALQUER do AST, independentemente
 * do `type` do no. Utilizado pela deteccao estrutural — qualquer no que tenha
 * um campo `name` interpretavel como nome de funcao e testado contra a blocklist.
 *
 * Retorna `null` se o no nao tiver campo `name` utilizavel.
 */
function tryExtractFunctionName(node: Record<string, unknown>): string | null {
  // Se o no ja tem `name` diretamente, usa functionNameOf.
  if ('name' in node) {
    return functionNameOf(node);
  }
  // Alguns parsers usam `function` como campo de nome (ex.: window_func).
  if ('function' in node) {
    const fn = node['function'];
    if (typeof fn === 'string') return fn;
    if (fn != null && typeof fn === 'object') {
      return functionNameOf(fn as Record<string, unknown>);
    }
  }
  return null;
}

/**
 * Varre TODO o AST atrás de funções da blocklist.
 *
 * Deteccao ESTRUTURAL: para CADA no visitado, independentemente do seu `type`,
 * tenta extrair um nome de funcao e testa contra a blocklist. Isso garante que
 * funcoes bloqueadas alcancem a deteccao mesmo quando embrulhadas em nos de
 * tipo `window_func`, `cast`, ou qualquer outra forma irregular que o parser
 * possa produzir.
 *
 * A travessia e total: pega funcao dentro de subquery, de CTE, de WHERE, de
 * argumento de outra funcao, de qualquer profundidade.
 *
 * Devolve a lista (deduplicada, ordenada, em minusculas) de funcoes bloqueadas
 * encontradas — vazia se nenhuma.
 */
export function findDangerousFunctions(ast: AstNode): string[] {
  const found = new Set<string>();

  walkAst(ast, (node) => {
    // Deteccao estrutural: tenta extrair nome de funcao de qualquer no.
    const fnName = tryExtractFunctionName(node);
    if (fnName && DANGEROUS_FUNCTIONS.has(fnName.toLowerCase())) {
      found.add(fnName.toLowerCase());
    }
  });

  return [...found].sort();
}

/**
 * Procura no AST qualquer nó que represente um statement de modificação de
 * dados (`insert` / `update` / `delete` / `replace`). Usado para barrar CTEs
 * data-modifying do Postgres (`WITH x AS (DELETE ...) SELECT ...`) — onde o nó
 * raiz é `select`, mas há um `delete` aninhado no `with`.
 *
 * Devolve o `type` do primeiro nó de modificação encontrado, ou `null`.
 */
export function findDataModifyingNode(ast: AstNode): string | null {
  const WRITE_TYPES = new Set(['insert', 'update', 'delete', 'replace']);
  let hit: string | null = null;

  walkAst(ast, (node) => {
    if (hit) return;
    const type = typeof node['type'] === 'string' ? node['type'] : '';
    if (WRITE_TYPES.has(type)) hit = type;
  });

  return hit;
}
