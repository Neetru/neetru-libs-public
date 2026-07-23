---
name: neetru-troubleshooting
description: Use when an AI (Claude) building a Neetru product hits ANY failure in the Neetru path and does not yet know WHOSE bug it is — deploy/migration/SDK error, OIDC secret missing, agent on a stale version, `Unknown command`, artifact 500, VM/DB suddenly `offline`, `ECONNREFUSED <vm>:5433` from `client.db.sql`, health `degraded`/503 — and needs to DIAGNOSE WITHOUT HALLUCINATING: first DECIDE if it is the product's own bug or a Core/agent/infra bug, gather ground-truth evidence, apply the cross-layer known-failure catalog, then escalate WITH evidence instead of rewriting its own schema/config. Routes to `neetru-deploy` / `neetru-migrations` / `neetru-sdk-troubleshooting` / `neetru-release-gates` for the actual fix.
---

# neetru-troubleshooting — "é meu bug ou do Core?" antes de tocar código

> Roteador/decisão. Os fixes detalhados vivem nas skills de domínio (`neetru-deploy`, `neetru-migrations`, `neetru-sdk-troubleshooting`, `neetru-release-gates`). Aqui é o **método de triagem + ground-truth + bundle de escalonamento**.

## Passo 0 — É MEU (produto) ou do Core/agente/infra?
Decida ANTES de mexer no código. Foi o gap que causou o retrabalho no ME1: o `schema.ts` estava intacto, o bug era do **motor de migração do Core** — e quase reescreveram o schema à toa. Regra: se o teu código/teste local passa e a falha só aparece no caminho Neetru (deploy/migrate/runtime), **suspeite do Core/agente/infra primeiro** e junte evidência.

## O SINTOMA reportado pode estar errado — confirme antes de agir na causa
Quem reporta já traz um palpite embutido ("a máquina travou", "o deploy quebrou", "o banco caiu") — e o palpite aponta pro lugar errado com frequência. **Reproduza o sintoma você mesmo** (`curl` / resolve DNS / command-result) e deixe a EVIDÊNCIA escolher a camada, não o palpite. Incidente real: "servidor travado, já reiniciei 2x e persiste" → o app respondia **200 direto no IP**; a causa era **domínio expirado no registrador** (NXDOMAIN), zero a ver com a VM — reiniciar nunca ia resolver. Se a primeira ação (restart/redeploy) não muda nada, é sinal de que a camada certa é OUTRA — pare de repetir o gesto e re-triagem.

## Ground-truth por camada (e o que MENTE)
- **Deploy/comando em VM:** o doc do **command** (`servers/{id}/commands/{cid}.status`+`.result`) é a verdade — **NÃO** a deployment doc (pode ficar presa em `queued` por um bug de permissão separado).
- **SDK:** `NeetruError.code` + `.requestId` + `.status` (nunca `.message`).
- **Versões:** CLI (`neetru --version`) · Core (`/api/health` `.sha`+`.revision`) · agente (`neetru servers list` `agentVersion`; e o hash do binário rodando vs o `.sha256` do release no GCS).
- **MENTE (lição de incidente):** `gcloud ssh … node --version` na VM (o `pkg` muta `process.env` em runtime → reroteia `node`); **smoke manual via SSH** usa env de startup e engana. Só **deploy real / command-result** verifica.

## Cold-start ≠ outage
`/api/health` `warming` (HTTP 200) ou `503` na 1ª request após idle = Core `min-instances=0` esquentando. **Re-poll quente** antes de cravar falha de DB/serviço.

## Serviço inacessível ("não conecta" / NXDOMAIN / 503) — isole a CAMADA antes de reiniciar/redeployar
"Não abre" tem várias causas em camadas diferentes. Teste de CIMA pra baixo — mexer na VM/app é o ÚLTIMO passo, não o primeiro:
1. **O domínio resolve?** `nslookup <dominio> 8.8.8.8`. **NXDOMAIN** no resolver público **E** no NS autoritativo do TLD (não é cache local) = domínio **sem delegação → expirado/suspenso no registrador**. `.br`: `curl -s https://rdap.registro.br/domain/<dominio>` → `status: ["inactive"]` + evento `expiration` com a data. **Reiniciar a VM ou redeployar NÃO conserta domínio** — a correção é renovar no registrador (ação de owner/faturamento, fora do Neetru).
2. **O app responde contornando o DNS?** `curl -k -H "Host: <dominio>" https://<IP-ou-origem>/`. **200 = VM+app sãos** → o problema está ACIMA (DNS/domínio/mapping), NÃO no teu código nem no deploy. Timeout/connection-refused = aí sim é VM/app/porta parados.
3. **502/503 mas o app está vivo?** = proxy/vhost/cert, não o app. Produto Neetru: mapping `--domain` errado ou não propagado (`neetru-deploy`). Em VM lacrada, o estado REAL do proxy só aparece via SSH (`sudo apache2ctl -S`) — o exec sandbox/smoke mente sobre qual vhost está vencendo.

**Domínio custom ≠ responsabilidade do Neetru:** um domínio próprio mapeado (`hosting create-mapping`) tem ciclo de vida no registrador/DNS FORA do Neetru. Expirou ou o DNS quebrou → **nenhum comando `neetru` conserta**; é renovação/registro. O Neetru só garante do mapping pra baixo (Cloud Run/VM + app).

## Catálogo cross-layer (sintoma → veredito → fix)
| Sintoma | Veredito | Vai pra |
|---|---|---|
| `missing_api_key`/`unauthorized` só em prod | `--env-file` dropou `*SECRET*`/OIDC | `neetru-deploy` |
| Login não faz nada (sem popup/redirect) só em prod, sem erro no deploy | `.env.local` venceu `.env.production` — bundle compilou `NEXT_PUBLIC_NEETRU_ENV=dev`, MockAuth ativo (incidente pdv-agiliza 2026-07-22) | `neetru-sdk-troubleshooting` / `neetru-deploy` Armadilha #3 |
| `--domain` 403 em VM | usou caminho Cloud Run em VM | `neetru-deploy` |
| migração `type already exists` | hash redundante (ME1) — motor do Core | `neetru-migrations` (DDL idempotente; não reescrever schema) |
| backup nunca `completed` | gated por release do agente | `neetru-release-gates` |
| `Unknown command: agent.*` / versão "subiu" mas comportamento velho | self-update cosmético (`bug_b4d009f6`) | `neetru-release-gates` |
| artifact download 500 (~300 MiB) | `bug_db02a2ce` (fix LIVE Core≥00233-xus, CLI≥2.12.20) | confirmar versões |
| `ECONNREFUSED <vm>:5433` no `db.sql` | sem Direct VPC Egress (owner-gated) — **não é teu código** | cobrar gate via `neetru-chat` |
| VM/DB `offline` súbito | possível purge-cron delete-por-nome (`bug_d11f051f`) | reportar — **não reusar nome de instância** |
| erro de `@neetru/sdk` (build/`list()`/code) | SDK | `neetru-sdk-troubleshooting` |
| Site "não conecta" / NXDOMAIN no NS do TLD | domínio **expirado/sem delegação** no registrador (`.br`: RDAP `status: inactive`) — **não é a VM** | renovar no registrador (owner); `curl` direto no IP confirma que VM+app estão sãos |
| Domínio custom fora, mas app responde direto no IP/origem | camada DNS/domínio/mapping ACIMA do app — restart/redeploy não muda nada | conferir resolução + `hosting create-mapping` (`neetru-deploy`); registrador se expirou |

## VM: nome ≠ identidade
Um doc `servers/` `offline`/stale pode coexistir com VM viva; e nome de instância é REUSADO entre tentativas. Nunca trate **nome** como prova de posse — confira `externalId` (id GCE) + GCP real. (Foi a causa-raiz do incidente que deletou a VM de prod.)

## Bundle pra escalar (anexar no `neetru-chat`)
command-result · `requestId` · versões (CLI/Core/agente) · `NeetruError.code` · `neetru doctor --json` · deployment id · timestamp+TZ. **Nunca** cole segredo/token/`.env`/OIDC secret no chat. Escopo de bug Neetru = só Core/SDK/CLI/libs (`neetru-regras`); regra-de-negócio do produto resolve local.

## Confirmar que o fix é REAL
Resolved só após **deploy LIVE + smoke** / command-result passar — nunca após smoke manual.
