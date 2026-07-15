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
import type { Dialect } from './classify.js';
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
export declare function assertNonTrivialWhere(sql: string, dialect?: Dialect): void;
