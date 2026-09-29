---
name: neetru-pre-push
description: Use when an AI (Claude) is about to `git push` in ANY Neetru repo (Core, CLI, SDK, agente, libs, produtos como pdv-agiliza/gestovendas/zelo), when a push is blocked by the pre-push hook, when setting up a NEW Neetru repo, or when tempted to use NEETRU_SKIP_PREPUSH. The GitHub Actions of the Neetru org have no billing, so the local pre-push gate IS the CI — this skill is the standard contract (steps, env flags, main-push block, fail-closed), how to adopt it in a repo that lacks it (ships a dependency-free `pre-push-gate.mjs` that detects Node/Go), how to diagnose a red gate (flaky vs real), and when skipping is acceptable and how to declare it.
---

# neetru-pre-push — o gate local É o CI

> O GitHub Actions da org Neetru está **sem billing** (decisão de custo do owner — `bug_ec959e65`). O `ci.yml` pode existir mas **não roda**, e nenhum check server-side barra merge. **O único gate automático é o pre-push na máquina de quem sobe.** Pular o gate = subir sem CI. Vale pra todo repo Neetru: Core, CLI, SDK, agente, libs e **todos os produtos**.

## O contrato (igual em todo repo)
| Regra | Comportamento |
|---|---|
| Push direto pra `main`/`master` | **Bloqueado.** Fluxo é branch → PR → merge. Fuga consciente: `NEETRU_ALLOW_MAIN_PUSH=1` |
| Etapas | typecheck → lint → testes (→ build só em FULL). **Aborta na 1ª falha, nada é enviado** |
| Não deu pra calcular o que mudou | **Roda tudo** (fail-closed). Nunca pular etapa em silêncio |
| Push só de remoção de ref (`--delete`) | Não valida nada |
| `NEETRU_SKIP_PREPUSH=1` | Pula tudo — **emergência**, e o motivo vai escrito no corpo do PR |
| `NEETRU_PREPUSH_FULL=1` | Inclui build (o `next build` pega export ilegal em `route.ts`, `'use server'` exportando não-função — coisas que tsc/vitest não pegam) |
| `NEETRU_PREPUSH_FAST=1` | Pula testes (só tipos/lint). Para iteração; **não** no push que vira PR |
| `--plan` | Mostra as etapas e sai, sem executar |

**Duas camadas:** o pre-push é o gate **barato** de todo push. Antes de **mergear na main** roda o gate **completo** do repo (no Core: `node scripts/pre-deploy-check.mjs` = tsc + vitest + `next build`; nos demais: `NEETRU_PREPUSH_FULL=1`). Cite a evidência (saída verde) no PR.

## Estado por repo (confira no repo, não decore)
- **Core** (`Neetru/neetru-core`): `.husky/pre-push` → `scripts/pre-push-check.mjs` — variante **estendida e escopada ao diff** (base = merge-base com `origin/main`): `tsc` root sempre; `tsc` de `functions/` se `functions/**` mudou (sem `functions/node_modules` = erro, não skip); `eslint` só nos arquivos alterados de `src/**` (>30 → `src` inteiro); frontmatter + manifest se `docs/**` mudou; `vitest --changed <merge-base>` por padrão, **full** se mudou `package*.json`/`tsconfig*`/`vitest.*`/`.npmrc`/`functions/**`. Mesmos flags.
- **Demais repos** (CLI, SDK, agente, libs, produtos): `scripts/pre-push-gate.mjs` (o template desta skill). Se o repo ainda não tem → adote (abaixo).

## Adotar num repo que não tem (5 min)
1. Copie `pre-push-gate.mjs` **desta pasta da skill** pra `scripts/pre-push-gate.mjs` do repo. Sem dependências (Node ≥ 18 + git). Detecta a stack:
   - **Node:** script `typecheck`; senão `lint` se for `tsc --noEmit`; senão `npx tsc --noEmit` se houver `tsconfig.json` → `lint` → `test` → (`build` em FULL).
   - **Go** (`go.mod` sem `package.json`): `go vet ./...` → `go test ./...` → (`go build ./...` em FULL).
   - Override: `package.json` → `"neetru": { "prePush": ["typecheck", "test"] }`.
2. Ligue o hook **sem dependência nova** (não mexe em lockfile):
   ```sh
   mkdir -p .githooks
   printf '#!/usr/bin/env sh\nexec node "$(dirname "$0")/../scripts/pre-push-gate.mjs" "$@"\n' > .githooks/pre-push
   git update-index --add --chmod=+x .githooks/pre-push   # Windows não guarda +x sozinho
   git config core.hooksPath .githooks
   ```
   E no `package.json`: `"prepare": "git config core.hooksPath .githooks || true"` — quem clona e roda `npm install` já sai com o gate ligado. (Repo que já usa **husky**: ponha a linha `exec node …` no `.husky/pre-push`; não troque o mecanismo.)
3. Teste: `node scripts/pre-push-gate.mjs --plan` e um push de branch real.
4. Documente no `CLAUDE.md`/`AGENTS.md` do repo (seção "Gate de pre-push" — modelo na skill `neetru-produto-md`).

## Gate vermelho — diagnosticar antes de pular
- **Rode de novo a etapa isolada** (`npm test -- <arquivo>`, `npx vitest run <arquivo>`). Passou isolada e falha na suíte = flaky/recurso, não bug.
- **Core, vitest com centenas de falhas de timeout em jsdom:** rebuild do graphify em background disputando CPU. Espere terminar e rode de novo (`reference_core_prepush_gate_flaky`).
- **`Failed to load url @neetru/<lib>` / módulo sem `dist`:** install parcial em `node_modules` — `npm ci` resolve, **mas nunca rode npm com outra sessão mexendo no mesmo repo**. Se não pode reinstalar agora, é caso legítimo de skip (declare no PR).
- **Falha real no seu diff:** conserte. É pra isso que o gate existe.

## Quando pular é aceitável (e como)
Só quando a falha é **comprovadamente não-relacionada ao seu diff** (ambiente local quebrado, flaky conhecido) **e** você não pode consertar agora. Aí: `NEETRU_SKIP_PREPUSH=1 git push …` **+** no corpo do PR: o que falhou, por que não é do diff, a evidência (qual etapa passou isolada). "Tava demorando" **não** é motivo — use `NEETRU_PREPUSH_FAST=1` nos pushes intermediários.

## Nunca
- `git push --no-verify` escondido (é o mesmo skip, sem rastro).
- Desligar/editar o hook pra passar.
- Declarar "CI verde" olhando o GitHub — lá não roda nada; a evidência é a saída local do gate.
