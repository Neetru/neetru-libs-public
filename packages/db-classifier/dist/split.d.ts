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
export declare function splitSqlStatements(input: string): string[];
/**
 * Remove comentarios e espacos de um statement para checar se "sobra" algo
 * executavel. Usado para descartar trechos so-comentario.
 */
export declare function isEffectivelyEmpty(stmt: string): boolean;
