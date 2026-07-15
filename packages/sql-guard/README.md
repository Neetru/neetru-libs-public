# @neetru/sql-guard

Classificador read-only de SQL e gate de hardening do Neetru Core DB. É a
camada de **política** acima do parser SQL (`@neetru/db-classifier` cuida da
severidade de migração; este pacote cuida do que pode rodar no visualizador de
banco em produção).

## O que faz

Três responsabilidades, todas sobre um único statement SQL:

1. **Classificar** — decide se o statement é seguro para rodar como consulta de
   leitura no visualizador de banco em produção.
2. **Hardenizar** — recebe um SELECT seguro e devolve-o com um teto de linhas
   (`LIMIT`) imposto, para uma consulta de leitura nunca varrer a tabela
   inteira.
3. **Barrar break-glass perigoso** — verifica que uma escrita de emergência
   (`UPDATE`/`DELETE` break-glass) tem um `WHERE` não-tautológico, para um
   `UPDATE ... WHERE 1=1` não atingir todas as linhas.

## Princípio fail-closed

Código crítico de segurança. **`safe: true` só quando o statement é
positivamente provado seguro.** Erro de parse, input vazio, AST não
reconhecido, múltiplos statements, função da blocklist, `WHERE` que não se
prova não-trivial — tudo é tratado como **inseguro**. Na dúvida, recusa. É
preferível barrar uma operação legítima (o operador reescreve) a deixar passar
uma exfiltração de arquivo ou um write que toca a tabela inteira.

A decisão de segurança é sempre sobre o **AST** (`node-sql-parser`), nunca
regex. A varredura da blocklist percorre a árvore inteira — uma função perigosa
escondida dentro de um subquery, de uma CTE, de um argumento de função, em
qualquer profundidade, é detectada.

## API

```ts
import {
  classifyStatement,
  hardenSelect,
  assertNonTrivialWhere,
  type SqlVerdict,
} from '@neetru/sql-guard';

// 1. Classificar
const v: SqlVerdict = classifyStatement('SELECT * FROM users');
// { safe: true, statementType: 'select', reason: '...' }

classifyStatement("SELECT pg_read_file('/etc/passwd')");
// { safe: false, statementType: 'select', reason: '...',
//   dangerousFunctions: ['pg_read_file'] }

// 2. Hardenizar — impõe LIMIT
hardenSelect('SELECT * FROM users', { maxRows: 500 });
// 'SELECT * FROM "users" LIMIT 500'

// 3. Barrar break-glass — joga se o WHERE for trivial
assertNonTrivialWhere('DELETE FROM users WHERE id = 5'); // ok
assertNonTrivialWhere('DELETE FROM users WHERE 1=1');    // throws
assertNonTrivialWhere('DELETE FROM users');              // throws (sem WHERE)
```

### `classifyStatement(sql, dialect?)`

Devolve um `SqlVerdict`. `safe: true` apenas para `SELECT`, `EXPLAIN` (de um
statement read-only) e `WITH ... SELECT` puramente de leitura. Dialeto opcional:
`'postgresql'` (default) ou `'mysql'`.

### `hardenSelect(sql, { maxRows, dialect? })`

Recebe um SELECT seguro (classifica internamente; joga se não for) e devolve-o
com `LIMIT maxRows` garantido — anexa se não houver, reduz se for maior, mantém
se for menor ou igual. `maxRows` precisa ser inteiro positivo.

### `assertNonTrivialWhere(sql, dialect?)`

Para o break-glass. Joga `Error` se o statement não for `UPDATE`/`DELETE`, não
tiver `WHERE`, ou o `WHERE` for tautológico (`1=1`, `true`, `'a'='a'`, literal
truthy, cadeia `OR` com tautologia). Um predicado de coluna genuíno passa.

## Estado

Implementado (M0). Suíte vitest cobrindo classificação read-only, blocklist
recursiva, hardening de LIMIT e guarda de WHERE break-glass.
