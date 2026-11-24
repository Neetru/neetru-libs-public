---
name: neetru-troubleshooting
description: Use when an AI (Claude) building a Neetru product hits ANY failure in the Neetru path and does not yet know WHOSE bug it is — deploy/migration/SDK error, OIDC secret missing, agent on a stale version, `Unknown command`, VM/DB suddenly `offline`, `ECONNREFUSED <vm>:5433` from `client.db.sql`, health `degraded`/503, a site that "does not connect" — and needs to DIAGNOSE WITHOUT HALLUCINATING: first DECIDE if it is the product's own bug or a Core/agent/infra bug, gather ground-truth evidence, apply the cross-layer known-failure catalog, then escalate WITH evidence instead of rewriting its own schema/config. Routes to `neetru-deploy` / `neetru-migrations` / `neetru-sdk-troubleshooting` / `neetru-release-gates` for the actual fix.
---

# neetru-troubleshooting — «é meu bug ou do Core?» antes de tocar código

> Roteador e decisão. Os consertos detalhados vivem nas skills de domínio (`neetru-deploy`, `neetru-migrations`, `neetru-sdk-troubleshooting`, `neetru-release-gates`). Aqui está o **método de triagem, a verdade de cada camada e o pacote de escalonamento**. Procurando o passo a passo de um incidente de VM ou de infra: o `SINTESE.md` do capítulo (`neetru-docs`, `docs/sistema/runbooks/` e `docs/sistema/manuais/infra/`) responde as perguntas mais comuns e diz o que está vencido, antes de você abrir o runbook inteiro.

## Passo 0 — é MEU (produto) ou do Core, do agente ou da infra?
Decida ANTES de mexer no código. Foi a falta disso que causou o retrabalho do ME1: o `schema.ts` estava intacto, o defeito era do **motor de migração do Core**, e quase reescreveram o schema à toa. Regra: se o seu código e o teste local passam e a falha só aparece no caminho Neetru (deploy, migração, runtime), **suspeite do Core, do agente e da infra primeiro** e junte evidência.

## O SINTOMA reportado pode estar errado: confirme antes de agir na causa
Quem reporta já traz um palpite embutido («a máquina travou», «o deploy quebrou», «o banco caiu»), e o palpite aponta para o lugar errado com frequência. **Reproduza o sintoma você mesmo** (`curl`, resolver o DNS, resultado do comando) e deixe a EVIDÊNCIA escolher a camada. Incidente real: «servidor travado, já reiniciei 2 vezes e persiste», mas o app respondia **200 direto no IP**; a causa era **domínio expirado no registrador** (NXDOMAIN), nada a ver com a VM. Se a primeira ação (reiniciar, redeployar) não muda nada, a camada certa é OUTRA: pare de repetir o gesto e refaça a triagem.

## Ground-truth por camada (e o que MENTE)
- **Deploy ou comando em VM:** o doc do **command** (`servers/{id}/commands/{cid}`: `.status` e `.result`) é a verdade, **não** o doc do deployment (pode ficar preso em `queued` por um defeito de permissão à parte).
- **Ambiente do produto:** `neetru environments status <slug>` (estado do app, bancos, VMs e o último sinal de cada uma) e `neetru db where --product <slug>`. Antes de pedir qualquer coisa ao Core, meça aqui.
- **SDK:** `NeetruError.code`, `.requestId` e `.status` (nunca `.message`).
- **Versões:** CLI (`neetru --version`) · Core (`/api/health`, `.sha` e `.revision`) · agente (`neetru servers list`, campo `agentVersion`; e o hash do binário rodando contra o `.sha256` do release no GCS).
- **MENTE (lição de incidente):** `gcloud ssh … node --version` na VM (o `pkg` muta `process.env` em runtime e reroteia `node`); **smoke manual por SSH** usa o env de startup e engana. Só **deploy real** e o **resultado do comando** verificam.

## Cold-start ≠ queda
`/api/health` `warming` (HTTP 200) ou `503` na 1ª request depois de ficar parado = Core com `min-instances=0` esquentando. **Chame de novo, já quente**, antes de cravar falha de banco ou de serviço.

## Serviço inacessível («não conecta», NXDOMAIN, 503): isole a CAMADA antes de reiniciar ou redeployar
«Não abre» tem várias causas, em camadas diferentes. Teste de CIMA para baixo; mexer na VM ou no app é o ÚLTIMO passo.
1. **O domínio resolve?** `nslookup <dominio> 8.8.8.8`. **NXDOMAIN** no resolver público **e** no servidor autoritativo do TLD (não é cache local) = domínio **sem delegação: expirado ou suspenso no registrador**. Para `.br`: `curl -s https://rdap.registro.br/domain/<dominio>` mostra `status: ["inactive"]` e o evento `expiration`. **Reiniciar a VM ou redeployar NÃO conserta domínio**: a correção é renovar no registrador (ação do dono, fora do Neetru).
2. **O app responde sem passar pelo DNS?** `curl -k -H "Host: <dominio>" https://<IP-ou-origem>/`. **200 = VM e app sãos**: o problema está ACIMA (DNS, domínio, mapeamento), não no seu código nem no deploy. Timeout ou connection refused: aí sim, VM, app ou porta parados.
3. **502/503 com o app vivo?** É proxy, vhost ou certificado, não o app. Produto Neetru: `--domain` errado ou ainda não propagado (`neetru-deploy`). Em VM lacrada, o estado real do proxy só aparece por SSH (`sudo apache2ctl -S`): o exec sandbox e o smoke mentem sobre qual vhost está vencendo.

**Domínio próprio não é responsabilidade do Neetru:** um domínio mapeado (`hosting create-mapping`) tem ciclo de vida no registrador e no DNS, FORA do Neetru. Expirou ou o DNS quebrou: **nenhum comando `neetru` conserta**; é renovação ou registro. O Neetru só garante do mapeamento para baixo (Cloud Run ou VM, e o app).

## Catálogo entre camadas (sintoma → veredito → onde vai)
| Sintoma | Veredito | Vai para |
|---|---|---|
| `missing_api_key` ou `unauthorized` só em produção | o `--env-file` descartou `*SECRET*` ou o OIDC | `neetru-deploy` |
| Login não faz nada (sem popup nem redirect) só em produção, sem erro no deploy | `.env.local` venceu `.env.production`: o bundle compilou com `NEXT_PUBLIC_NEETRU_ENV=dev` e o MockAuth ficou ativo (incidente do pdv-agiliza, 22/07/2026) | `neetru-sdk-troubleshooting` · `neetru-deploy`, armadilha 3 |
| `--domain` dá 403 em VM | usou o caminho do Cloud Run numa VM | `neetru-deploy` |
| migração `type already exists` | hash redundante (ME1), do motor do Core | `neetru-migrations` (DDL idempotente; não reescreva o schema) |
| backup que nunca chega a `completed` | gated por release do agente | `neetru-release-gates` |
| `Unknown command: agent.*`, ou a versão «subiu» e o comportamento é o velho | self-update cosmético (`bug_b4d009f6`) | `neetru-release-gates` |
| `ECONNREFUSED <vm>:5433` no `db.sql` | falta o Direct VPC Egress (do dono); **não é o seu código** | cobrar o gate pelo `neetru-chat` |
| VM ou banco `offline` de repente | possível delete por nome do purge-cron (`bug_d11f051f`) | reportar; **não reuse nome de instância** |
| erro de `@neetru/sdk` (build, `list()`, código) | SDK | `neetru-sdk-troubleshooting` |
| «não conecta», NXDOMAIN, ou o domínio próprio cai e o app responde direto no IP | camada de DNS, domínio ou mapeamento, ACIMA do app; reiniciar não muda nada | seção acima; renovar no registrador (dono); `hosting create-mapping` (`neetru-deploy`) |

## VM: nome ≠ identidade
Um doc `servers/` `offline` ou velho pode coexistir com VM viva, e nome de instância é REUSADO entre tentativas. Nunca trate o **nome** como prova de posse: confira o `externalId` (id do GCE) e o GCP real. (Foi a causa raiz do incidente que apagou a VM de produção.)

## Pacote para escalar (anexe no `neetru-chat`)
Resultado do comando · `requestId` · versões (CLI, Core, agente) · `NeetruError.code` · `neetru doctor --json` · id do deploy · hora com fuso. **Nunca** cole segredo, token, `.env` ou secret OIDC no chat. O escopo de bug Neetru é só Core, SDK, CLI e libs (`neetru-regras`); regra de negócio do produto se resolve local.

## Confirmar que o conserto é REAL
`resolved` só depois do **deploy LIVE e do smoke**, ou do resultado do comando passar: nunca depois de smoke manual.
