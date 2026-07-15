/**
 * Utilitários de travessia do AST do `node-sql-parser`.
 *
 * O AST é uma árvore heterogênea de objetos e arrays sem schema estável entre
 * versões — subqueries, CTEs, argumentos de função, cláusulas WHERE etc. todos
 * aninham nós de forma irregular. Para garantir que NADA passe despercebido
 * (uma função bloqueada escondida três níveis abaixo num subquery, p.ex.), a
 * detecção de risco precisa de uma travessia genérica que visita CADA nó.
 */
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
export declare function walkAst(root: AstNode, visit: (node: Record<string, unknown>) => void): void;
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
export declare function findDangerousFunctions(ast: AstNode): string[];
/**
 * Procura no AST qualquer nó que represente um statement de modificação de
 * dados (`insert` / `update` / `delete` / `replace`). Usado para barrar CTEs
 * data-modifying do Postgres (`WITH x AS (DELETE ...) SELECT ...`) — onde o nó
 * raiz é `select`, mas há um `delete` aninhado no `with`.
 *
 * Devolve o `type` do primeiro nó de modificação encontrado, ou `null`.
 */
export declare function findDataModifyingNode(ast: AstNode): string | null;
