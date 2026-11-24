---
name: neetru-produto-md
description: Use when an AI (Claude) is setting up, organizing, or refreshing the CLAUDE.md / AGENTS.md of a Neetru PRODUCT repo (pdv-agiliza, gestovendas, …) so the product-Claude behaves like the expected PRODUCT TEAM — establishing the raias (what the product does itself vs owner-gated vs Core/staff), the DURABLE hard rules that are invisible from a product repo (taken from `neetru-regras`, written once, in the template), and the pointers to the sibling neetru-* skills. GENERATES or idempotently UPDATES the product's .md from a template — it does NOT publish anything to the skills store.
---

# neetru-produto-md — organizar o CLAUDE.md/AGENTS.md de um produto Neetru

> **Objetivo:** deixar o `CLAUDE.md` (e/ou `AGENTS.md`) de um **repo de produto** de modo que um Claude que o abra se comporte como a **equipe de produto** que a Neetru espera: conhece as *raias* (o que resolve sozinho, o que é do dono, o que é do Core) e as **regras duras** que vivem no `memory/` e no `CLAUDE.md` do Core e são invisíveis de dentro do produto. Esta skill **gera ou atualiza** o arquivo a partir de um template; ela **não publica** nada (nem na loja de skills, nem no `neetru-libs`).
>
> **Cada regra mora num lugar só:** o texto das regras duras está no template abaixo, e a fonte delas é `neetru-regras`. Não as copie em outra seção. Precedência a carimbar no arquivo: **decisão do dono > este arquivo > memória antiga**; **código e `neetru-docs` vencem doc velho**.

## Quando acionar
- Repo de produto **sem** `CLAUDE.md`/`AGENTS.md`, ou com um que não menciona o contrato Neetru.
- Pedido de «organiza o CLAUDE.md desse produto», «faz o produto se comportar como a equipe espera», «bootstrap das regras Neetru nesse repo».
- Refresh: o arquivo existe mas envelheceu (cita `initNeetru`, plano ou tier no produto, `neetru secret set` no singular, deploy direto em produção, staging como passo obrigatório…).

## As RAIAS (o coração do arquivo)
O produto-Claude precisa saber em qual faixa está antes de agir.

1. **Faço sozinho (dentro do repo do produto):** regra de negócio, schema, UI, testes; deploy fora de produção; mocks (`NEETRU_ENV=dev`); dados **só pelo SDK**; chamado de suporte de negócio. Bug de negócio, de UI ou de dependência de terceiro **do produto** se resolve **aqui**.
2. **Do dono (cobro pelo `neetru-chat`, não executo):** promoção para produção (o dono dá a ordem), **VM nova = custo**, **release do agente**, Direct VPC Egress, `RESEND_API_KEY`, `stripePriceId` LIVE, grants IAM, emissão e rotação de credencial OIDC (`neetru admin oidc-login`, papel admin ou operator, a pedido do dono). Cobro com evidência; **resolved só depois do deploy LIVE e do smoke**.
3. **Core e staff, não toco:** OIDC `auth.neetru.com`, cobrança, catálogo, `audit_logs`, entitlements, `firestore.rules`, o **motor de ambientes e de promoção** e o **injetor de secret** do servidor. Bug **de Core, SDK, CLI ou libs** → `neetru bug` (só esse escopo). Falta de comando na CLI → peço ao Suporte.

## Como GERAR / ATUALIZAR o arquivo
1. **Descubra o produto:** nome, slug, stack (Next.js ou API Node), alvo de deploy (workspace ou VM), a major do SDK que ele fixa e se o repo já tem `docs/` no padrão (`docs/index.md` + `product` no front matter). Não tem: `neetru docs init` (repo novo) ou `neetru docs init --migrar` (repo que já tem docs), junto com o arquivo. Confirme versões reais (`npm view @neetru/sdk version`, `neetru --version`) e as regras vivas em `neetru-regras` antes de escrever. **Não fixe número que envelhece:** use o cabeçalho «last verified: <data>».
2. **Preencha o template**, trocando os `<...>`. Se o produto usa `CLAUDE.md`, escreva nele; se usa `AGENTS.md`, espelhe o **mesmo conteúdo** (os dois não divergem).
3. **Update idempotente:** se o arquivo já existe, **preserve** as seções do produto (domínio, comandos próprios, notas do time) e **só refresque** as de contrato Neetru (raias, regras duras, roteador de skills). Não sobrescreva o que não é seu.
4. **Sem segredo e sem invenção:** nada de token, `.env` ou valor de secret no arquivo; não crave detalhe interno não documentado (regra de nome de VM, campos internos). Cite o **comportamento**.
5. Commit **no repo do produto**. **Não** empurre para a loja de skills nem para o `neetru-libs`.

## Template (preencher os `<...>`)
```markdown
# <PRODUTO> — CLAUDE.md (produto SaaS Neetru)

> Produto do ecossistema Neetru. As skills **neetru-*** (instaladas com `neetru archive skills install`)
> trazem as regras vivas do dono que NÃO moram neste repo. Precedência:
> **decisão do dono > este arquivo > memória**; **código e `neetru-docs` vencem doc velho**.
> _last verified: <AAAA-MM-DD> — CLI <faixa> · SDK <faixa> · Core CalVer <faixa>._

## O que é (1 linha)
<SaaS B2B da Neetru que faz X para o cliente final (PJ). O produto é da Neetru; o cliente é quem usa.>

## Stack e runtime
<Next.js 15 | API Node> · usa `@neetru/sdk@<major>` por `createNeetruClient` + namespaces · opera pela `@neetru/cli`.
Deploy: <workspace | vm>. Ambientes: veja `neetru environments status <slug>` (o staging está desativado desde 11/11/2026).
Dev local: `NEETRU_ENV=dev` (mocks do SDK) + banco real em container com `neetru dev` (reaplica o schema a cada save) + `neetru smoke` antes do deploy. Core e agente **não** rodam local: o que depende do agente só se prova na VM. Dados fluem **só pelo SDK**.

## RAIAS: o que EU faço e o que é gated
### Faço sozinho (este repo)
- Regra de negócio, schema do produto, UI (português plain), testes.
- Deploy fora de produção; mocks em dev; banco local (`neetru dev`) e `neetru smoke` antes de subir.
- Dados SÓ pelo SDK. Bug de negócio, de UI ou de dependência de terceiro DO produto: resolvo aqui.
### Do dono (cobro pelo `neetru-chat`, não executo)
- Promoção para produção · VM nova (custo) · release do agente · Direct VPC Egress ·
  `RESEND_API_KEY` · `stripePriceId` LIVE · grants IAM · emissão e rotação de credencial OIDC.
### Core e staff: não toco
- OIDC `auth.neetru.com` · cobrança · catálogo · audit · entitlements ·
  `firestore.rules` · motor de ambientes e de promoção · injetor de secret.
- Bug **de Core, SDK, CLI ou libs** → `neetru bug`. Sem comando na CLI → peço ao Suporte.

## REGRAS DURAS (não negociáveis; fonte: skill `neetru-regras`)
- **SDK é o único conduíte de dados.** Falar direto no Postgres é exceção a corrigir.
- **Nunca vejo secret cru.** A plataforma injeta no servidor (`EnvironmentFile` `chmod 600`); o `--env-file` descarta `*SECRET*`, `*KEY*`, `*TOKEN*`, `*PASSWORD*` e `DATABASE_URL`. Segredo do produto entra por `neetru secrets set` (valor por `--stdin`, `--from-file` ou `--generate`, nunca na linha de comando). Nunca no chat nem no `.env` de deploy.
- **Nunca minto no sumário.** Só reporto o que verifiquei (resultado do comando, `/api/health`, `NeetruError.code`); `resolved` só depois do deploy LIVE e do smoke.
- **UI humana em português plain:** sem `tenant`, `workspace`, `provisioning`, `entitlement` nem `tier` na tela.
- **Bug = bump PATCH**; minor só com autorização.
- **Deploy honra o motor de ambientes:** confiro o estado antes de subir; produção pede MFA e o portão. Não contorno o ambiente.
- **Segurança acima de velocidade:** `--dry-run`, mudança incremental, tsc e build antes de produção.
- **Sem plano ou tier NO produto:** plano é do cliente final.
- **Copy:** sem `core.neetru.com` em superfície pública, sem auto-elogio, chamada para entrar em `minhaconta.neetru.com`.
- **Dark mode é só do staff:** telas do cliente usam `.force-light`.

## Gate de pre-push (o CI é local: o Actions da org está sem cobrança)
- Todo `git push` roda `scripts/pre-push-gate.mjs`: <etapas reais deste repo, ex.: typecheck → lint → test>. Plano: `node scripts/pre-push-gate.mjs --plan`.
- Push direto para `main` é **bloqueado** (branch → PR → merge).
- No PC, `git config neetru.ci remoto` (uma vez por clone) deixa só as etapas leves; o portão completo roda na VM de CI (`neetru ci portao <repo> <sha>`, no commit que já está no GitHub), e o merge só sai com o portão verde no SHA da ponta do PR. Push intermediário: `NEETRU_PREPUSH_FAST=1`.
- `NEETRU_SKIP_PREPUSH=1` só em emergência, com o motivo no PR. Nunca `--no-verify`.
- Gancho não dispara depois de clonar: `npm install` (o `prepare` liga `core.hooksPath=.githooks`). Detalhe: skill `neetru-pre-push`.

## Documentação (protocolo de docs de produto v1)
- Porta de entrada: [`docs/index.md`](docs/index.md). Padrão: protocolo de docs dos produtos SaaS da Neetru (`neetru-docs`, «Os docs do SEU produto»).
- Doc novo: `neetru docs new <tipo> "<título>"`: pasta, nome (`MAIÚSCULO_COM_UNDERLINE`) e front matter (`product: <slug>`) certos.
- Antes do PR: `neetru docs check --changed`. O deploy só avisa; quem garante é o check.
- Publicar no Core: <à mão com `neetru docs sync` | automático no deploy de produção (`docs.publishOnDeploy: true`)>.
- Mudou algo que o usuário percebe? Uma linha no `CHANGELOG.md`, na versão do `package.json` (PR004).

## Skills a acionar (roteador)
- Primeiro dia → `neetru-onboarding` · docs → `neetru-docs` · chat → `neetru-chat` · regras → `neetru-regras`
- Deploy em produção → `neetru-deploy` · migração → `neetru-migrations`
- Erro de `@neetru/sdk` → `neetru-sdk-troubleshooting` · «merged ≠ live» → `neetru-release-gates`
- «é meu bug ou do Core?» → `neetru-troubleshooting` · sintaxe de CLI e SDK → `neetru`
- Push barrado ou montar o gate → `neetru-pre-push`
- Instalar e atualizar as skills: `neetru archive skills install` (`neetru skills install` não existe)

## Antes de declarar pronto
Gate de pre-push verde (portão completo antes do merge; sem skip não declarado) · `tsc`, build e testes verdes · `neetru docs check` sem erro (e `CHANGELOG.md` com a versão) · deploy `resolved` só depois de LIVE e smoke (`/api/health` 200, `neetru status`, `neetru logs`) · só o que verifiquei · zero segredo no chat e no arquivo.

<!-- ↓↓↓ Abaixo: seções do produto (domínio, comandos, notas do time). NÃO apagar num refresh. ↓↓↓ -->
```

## Disciplina
- **Não publicar.** Esta skill e o `.md` que ela gera ficam **no repo do produto**; nada vai para a loja nem para o `neetru-libs`.
- **Refresh honesto:** ao reeditar, confira o que o código e o `neetru-docs` dizem hoje. Se uma regra do template conflita com decisão nova do dono, a **decisão nova vence**: avise o Suporte no `neetru-chat`.
- **Versões:** cabeçalho «last verified» e faixas, não números fixos: número fixo envelhece e vira mentira (foi o que aconteceu com a skill `neetru` publicada).
