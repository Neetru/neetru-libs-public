# @neetru/db-classifier

Avaliador de severidade de migração de schema SQL. Recebe um `.sql` (o output do
`drizzle-kit generate`) e devolve um `ClassificationReport` — cada statement
marcado **aditiva** ou **destrutiva**, com motivo em PT-BR e sugestão
expand-contract.

## Por que é um pacote próprio

A classificação roda **duas vezes** no Neetru Core DB:

1. No **CLI** — fase 4 do pipeline `neetru db apply`, para mostrar o diff e
   decidir se dispara a *pausa sagrada* (confirmação humana em migração
   destrutiva).
2. No **Core** — que **recomputa** a classificação, porque não confia na que o
   cliente mandou.

Se CLI e Core classificassem com lógicas diferentes, abriria um buraco de
segurança: o CLI diria "aditiva", o dev não veria alerta, e o Core aplicaria
sem a pausa. A defesa é ser **um único pacote**, importado pelos dois lados.

## Princípios

- **Função pura, determinística, sem I/O.** Mesmo input → mesmo output.
- **Isomórfico Node** — roda em buildtime no CLI e server-side no Core.
- **Parser AST** (`node-sql-parser`), nunca regex.
- **Fail-closed** — statement fora da allowlist é classificado `destrutiva`.

## API (contrato)

```ts
classifyMigration(sql: string): ClassificationReport
explainStatement(c: StatementClassification): string
```

> **Estado: implementado (M0).** `classifyMigration` e `explainStatement` estão
> entregues, com suíte de testes vitest cobrindo aditiva/destrutiva/fail-closed.
> O contrato canônico (tipos `ClassificationReport`, allowlist `STATEMENT_RULES`)
> vem da especificação do conselho do Neetru Core DB —
> `docs/_projetos/conselho-core-db/` no repositório Neetru Core (cadeira 01-cli
> e §6.1 item 1 do relatório central).
