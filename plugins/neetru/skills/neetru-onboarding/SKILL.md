---
name: neetru-onboarding
description: Use when an AI (Claude) is STARTING work on a Neetru product (pdv-agiliza, gestovendas, …) or on the Core and needs the first-day runbook — what to do first, in order — before writing code: bootstrap/login/doctor, find answers in the docs (chapter summary first, then the doc by its metadata — via `neetru-docs`) and join the dev chat (`neetru-chat`), the Core↔product mental model, the responsibility boundary (what you fix yourself vs what is owner-gated vs staff-assisted), and the first-day pitfall catalog drawn from real incidents so you do not repeat them.
---

# neetru-onboarding — primeiro dia num produto Neetru

> Camada orquestradora: dá a **ordem** e a **fronteira**; o conteúdo está nas outras skills. Comandos → `neetru`; docs → `neetru-docs`; chat → `neetru-chat`; consertos → `neetru-deploy`/`neetru-migrations`/`neetru-sdk-troubleshooting`/`neetru-release-gates`; triagem → `neetru-troubleshooting`; regras → `neetru-regras`.

## 1. Primeiro dia, em ordem (antes de tocar código)
```bash
npm install -g @neetru/cli
neetru bootstrap                 # Node/gcloud/Docker/Firebase + ADC (idempotente; --check só lista)
neetru login                     # OAuth Device Code (RFC 8628); CI: --token nrt_<keyId>_<secret>
neetru whoami                    # confirma a identidade da chave
neetru doctor                    # 5/5 verde: token CLI, Core acessível, schema do neetru.config.json, NEETRU_ENV, versão da CLI
neetru archive skills install    # instala/atualiza as skills Neetru em ~/.claude/skills/
neetru docs init                 # docs/ do produto no padrão (repo que já tem docs: neetru docs init --migrar)
```
Não escreva código antes do `doctor` verde. O `docs init` é idempotente (nunca sobrescreve); no repo que já tem docs, `--migrar` só põe front matter e escreve o relatório em `docs/_audit/`, **sem mover nada**: leia o relatório, mova num PR à parte e rode `neetru docs init` de novo para completar o mínimo (`neetru-docs`, «Os docs do SEU produto»). `neetru init` e `neetru new` já criam o `docs/` sozinhos. (**Node 22 LTS** é pré-requisito do ambiente, não um check do `doctor`.)

**Gate de pre-push ligado?** O GitHub Actions da org não roda: o pre-push local é o CI. No repo: `node scripts/pre-push-gate.mjs --plan` (Core: `node scripts/pre-push-check.mjs --plan`). Não existe: adote antes do 1º push (`neetru-pre-push`, 5 minutos). Clonou e o gancho não dispara: `npm install` (o `prepare` liga `core.hooksPath`).

## 2. Antes de afirmar qualquer coisa
- **Ache a resposta nos docs, nesta ordem** (`neetru-docs`): o `SINTESE.md` do capítulo, depois o doc certo pelos metadados (`grep` por `etiquetas:` com `tema:…`, `produto:…` ou `superficie:…`), depois o código. Doc vence memória; código vence doc.
- **Leia os docs DO PRODUTO:** comece por `docs/index.md` do repo. Antes de abrir PR, `neetru docs check --changed`.
- **Entre no chat** (`neetru-chat`): apelido inerente ao token, leitura por cursor, responde quando mencionado. É o canal com o Suporte e o Dev Core.
- **Comando que você não conhece:** `neetru <comando> --help` traz descrição, opções e exemplos; todos os comandos estão em `docs/COMANDOS.md` do repo `neetru-cli`.

## 3. Modelo mental Core↔produto (6 linhas)
- **Core** = infra interna (OIDC `auth.neetru.com`, cobrança em BRL, catálogo, audit, entitlements), **nunca tocada direto**.
- **Produto** consome `@neetru/sdk` via `createNeetruClient` + namespaces; opera pela `@neetru/cli`.
- Roda em **workspace** (Cloud Run) ou **VM** (agente Linux, por um barramento no Firestore).
- Multi-tenant: o SDK injeta o `tenantId`. Dados fluem **pelo SDK** (`neetru-regras`).
- **O ambiente é a unidade de provisionamento.** Banco, app, domínio e deploy nascem **dentro de um ambiente** do seu produto (`products/{id}/environments/{envId}`), não soltos. Ambiente errado, ou com alvo errado, faz o recurso certo não aparecer, sem erro nenhum.

## 4. Fronteira de responsabilidade

**Primeiro o teste, depois a lista.** A lista não cobre o caso novo, e o caso novo é o que aparece. Antes de pedir qualquer coisa ao Core, responda nesta ordem; a primeira que responder decide:

1. **Existe comando na CLI ou card no painel que faça isso, e a sua credencial tem o papel que ele pede?** Se sim, é **seu**, mesmo que pareça infra. Se o comando existe mas responde 403 pelo papel, o pedido ao staff é o certo: diga o comando e o papel que você tem (pedido que já informa o papel não volta como pergunta). CLI e painel nem sempre pedem o mesmo papel. *Caso real:* um produto novo ficou sem cliente OIDC e pediu ao Core que criasse; pela CLI (`neetru admin oidc-login create`) basta papel admin **ou operator**, e o card do painel exige **admin**. Quem era operator conseguia pela CLI, levou negativa no painel e concluiu, errado, que era do Core.
2. **O recurso nasce dentro de um ambiente do seu produto?** Então o pedido certo não é *«cria meu domínio»*, é *«meu ambiente está com `target: <X>` e `serverId: <Y>`»*. Medir o ambiente (`neetru environments status <slug>`) troca um pedido vago por um diagnóstico. *Caso real:* dois ambientes em `target: workspace` (runtime que nunca foi provisionado) faziam o `domains reconcile` pular os dois em silêncio.
3. **Custa dinheiro, exige MFA, ou escreve em recurso compartilhado?** (VM nova, secret, grant IAM, release do agente, `firestore.rules`, deploy em produção.) É do dono. Peça **nominal**: o comando exato que ele vai colar, não *«pode subir isso?»*.

Nenhuma das três respondeu: é ticket, com a medição das três anexada (§6). **Medir antes de pedir:** pedido sem medição volta como pergunta, e o ciclo dobra.

- **Você resolve sozinho:** código, regra de negócio e schema do produto, deploy em workspace, mocks (`NEETRU_ENV=dev`), banco local (`neetru dev`) e `neetru smoke`. O que existe na máquina está na skill `neetru`, «Dev local na máquina».
- **Do dono** (cobre pelo `neetru-chat`, não execute): promoção para produção (o dono dá a ordem), **VM nova = custo**, Direct VPC Egress, Resend/`RESEND_API_KEY`, `stripePriceId` LIVE, grants IAM, **release do agente**.
- **Com ajuda do staff:** o que não tem comando na CLI.
- **Escopo de bug:** `neetru bug` só Core, SDK, CLI e libs (`neetru-regras`).

## 5. Armadilhas de primeiro dia (vieram de incidentes reais)
- Variável com cara de segredo **descartada no deploy em VM** (`--env-file`): o OIDC/SDK secret não sobe → `neetru-deploy`.
- `--domain` inline (VM) vs `hosting create-mapping` (Cloud Run) → `neetru-deploy`.
- Migração redundante `type already exists` (ME1): **não reescreva o schema** → `neetru-migrations`.
- Backup gated por release do agente; self-update do agente cosmético (a versão mente) → `neetru-release-gates`.
- Banco `degraded`/503 logo após o deploy é cold-start falso; nome de VM não é identidade (colisão de nome fez um cron apagar a VM de produção) → `neetru-troubleshooting`.
- `NEETRU_SKIP_PREPUSH=1` ou `--no-verify` «porque demorou»: subiu sem CI nenhum, já que o Actions não roda → `neetru-pre-push`.
- Achar que o `neetru deploy` barra doc errado: ele **só avisa**. Rode `neetru docs check` antes → `neetru-docs`.
- **«Deu ok e não fez nada.»** Confira o **efeito**, não a saída. O `domains reconcile` devolve `ok: true` e *«todos os domínios obrigatórios já existem»* tendo criado zero, sem existir nenhum (`created=0, existing=0, skipped=2`); o `domains list` do mesmo produto responde *«nenhum subdomínio registrado»*. Feche o ciclo com o comando de leitura e com o DNS.
- **«O conserto existe, e não na sua versão.»** `npm i -g @neetru/cli` entrega o que a dist-tag `latest` aponta, não o que está na `main`. Antes de abrir ticket de comando que não funciona, rode `neetru --version` e pergunte no chat em que versão o conserto entrou. Vale para o agente também: release publicada ≠ código mesclado.
- `.env.local` esquecido vence `.env.production` no build e desativa o login real em produção em silêncio (`neetru build` já protege; envolva o `next.config.mjs` com `withNeetruBuildGuard`) → `neetru-deploy`, armadilha 3.

## 6. Ticket: quando NÃO abrir, e o que anexar
Não abra se o erro já está documentado ou se o `doctor` aponta o conserto. Ao abrir: `neetru doctor --json`, o id do deploy, o resultado do comando, hora com fuso e o `NeetruError.code`. **Nunca** segredo no chat.
