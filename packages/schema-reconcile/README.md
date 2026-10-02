# @neetru/schema-reconcile — NÃO PUBLICADO (`"private": true`)

Reconciliação aditiva de schema do Neetru Core DB: parseia os `CREATE TABLE` de
uma migração e, contra as colunas vivas introspectadas, planeja os
`ALTER TABLE ADD COLUMN` que um `CREATE TABLE IF NOT EXISTS` deixou de aplicar
numa tabela que já existia. Função pura, determinística, só aditiva.

## Por que está marcado como `private`

Este pacote **nunca foi publicado no npm** (`npm view @neetru/schema-reconcile`
→ 404) e **ninguém o consome daqui**. A ideia original era ser a fonte única
compartilhada entre Core e agente, mas cada um seguiu com a sua própria cópia:

| Quem | Onde está a implementação em uso |
|---|---|
| Neetru Core | `src/lib/actions/_db-migrations-deps.ts` (`reconcileSchemaPostApply`) |
| Agente (`neetru-agent-service-vm`) | `src/lib/schema-reconcile-shim.ts` |

O `"private": true` existe para que um `npm publish` (inclusive um
`npm publish --workspaces` ou um loop de publish das libs) **recuse** este
pacote em vez de publicar por engano uma terceira cópia que ninguém usa — e
que poderia divergir das duas que estão em produção.

## Se um dia for virar a fonte única

1. Decidir com o owner que Core e agente passam a importar daqui.
2. Conferir que este código está igual (ou à frente) das duas cópias acima.
3. Remover o `"private": true`, revisar `license` e versão, e publicar seguindo
   o fluxo normal das libs (o `prepublishOnly` já roda a trava de manifesto).
4. Trocar as cópias no Core e no agente pelo pacote publicado.
