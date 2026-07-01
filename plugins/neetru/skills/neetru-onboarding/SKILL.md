---
name: neetru-onboarding
description: Use when an AI (Claude) is STARTING work on a Neetru product (pdv-agiliza, gestovendas, …) or on the Core and needs the first-day runbook — what to do first, in order — before writing code: bootstrap/login/doctor, read the canonical docs and join the dev chat (delegating to `neetru-docs` and `neetru-chat`), the Core↔product mental model, the responsibility boundary (what you fix yourself vs what is owner-gated vs staff-assisted), and the first-day pitfall catalog drawn from real incidents so you do not repeat them.
---

# neetru-onboarding — primeiro dia num produto Neetru

> Camada orquestradora: dá a **ordem** e a **fronteira**; delega o conteúdo às outras skills. Comandos → `neetru`; docs → `neetru-docs`; chat → `neetru-chat`; fixes → `neetru-deploy`/`neetru-migrations`/`neetru-sdk-troubleshooting`/`neetru-release-gates`; triagem → `neetru-troubleshooting`; regras → `neetru-regras`.

## 1. Primeiro dia, em ordem (antes de tocar código)
```bash
npm install -g @neetru/cli
neetru bootstrap                 # Node/gcloud/Docker/Firebase + ADC (idempotente; --check só lista)
neetru login                     # OAuth Device Code (RFC 8628); CI: --token nrt_<keyId>_<secret>
neetru whoami                    # confirma identidade da chave
neetru doctor                    # 5/5 verde: token CLI, core acessível, schema neetru.config.json, NEETRU_ENV, CLI version
neetru marketplace skills install  # instala/atualiza as skills Neetru em ~/.claude/skills/
```
Não escreva código antes do `doctor` verde. (**Node 22 LTS** é pré-requisito do ambiente — `HANDOFF.md` —, não um check do `doctor`.)

## 2. Antes de afirmar qualquer coisa
- **Leia os docs** (aciona `neetru-docs`): `saas-do-zero/*`, `devex/cli-reference`, `devex/sdk-reference`, `ARCHITECTURE`. Doc vence memória; código vence doc.
- **Entre no chat** (aciona `neetru-chat`): apelido inerente ao token, watch por cursor, responde quando @-mencionado. É o canal com o Suporte/Dev Core.

## 3. Modelo mental Core↔produto (6 linhas)
- **Core** = infra interna (OIDC `auth.neetru.com`, Stripe BRL, catálogo, audit, entitlements) — **nunca tocada direto**.
- **Produto** consome `@neetru/sdk` via `createNeetruClient` + namespaces; opera via `@neetru/cli`.
- Roda em **workspace** (Cloud Run) ou **VM** (agente Linux via message bus Firestore).
- Multi-tenant: o SDK injeta `tenantId`. Dados fluem **pelo SDK** (`neetru-regras`).

## 4. Fronteira de responsabilidade
- **Você resolve sozinho:** código/regra-de-negócio/schema do produto, deploy em workspace, mocks (`NEETRU_ENV=dev`).
- **Owner-gated** (cobre via `neetru-chat`, não execute): prod-promote (owner digita "promove"), **VM nova = custo**, Direct VPC Egress, Resend/`RESEND_API_KEY`, `stripePriceId` LIVE, grants IAM, **release do agente**.
- **Staff-assisted:** coisas sem comando CLI (ex.: `neetru domain` não existe → peça).
- **Escopo de bug:** `neetru bug` só Core/SDK/CLI/libs (`neetru-regras`).

## 5. Armadilhas de primeiro dia (não repita — vieram de incidentes reais)
- Var com cara de segredo **dropada no deploy VM** (`--env-file`) → o OIDC/SDK secret não sobe → `neetru-deploy`.
- `--domain` inline (VM) vs `hosting create-mapping` (Cloud Run) → `neetru-deploy`.
- Migração redundante `type already exists` (ME1) — **não reescreva o schema** → `neetru-migrations`.
- Backup gated por release do agente → `neetru-release-gates`.
- DB `degraded`/503 logo após deploy = **cold-start falso** → `neetru-troubleshooting`.
- Self-update do agente cosmético (versão mente) → `neetru-release-gates`.
- Nome de VM **não é identidade** (colisão de nome levou um cron a deletar a VM de prod) → `neetru-troubleshooting`.

## 6. Ticket: quando NÃO abrir, e o que anexar
Não abra se o erro já está documentado ou se o `doctor` aponta o fix. Ao abrir: `neetru doctor --json` + deployment id + command-result + timestamp+TZ + `NeetruError.code`. **Nunca** segredo no chat.
