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
| Etapas | typecheck → lint → **docs** (repo de produto, se `docs/**` mudou) → testes (→ build só em FULL). **Aborta na 1ª falha, nada é enviado** |
| Não deu pra calcular o que mudou | **Roda tudo** (fail-closed). Nunca pular etapa em silêncio |
| Push só de remoção de ref (`--delete`) | Não valida nada |
| `NEETRU_SKIP_PREPUSH=1` | Pula tudo — **emergência**, e o motivo vai escrito no corpo do PR |
| `NEETRU_PREPUSH_FULL=1` | Inclui build (o `next build` pega export ilegal em `route.ts`, `'use server'` exportando não-função — coisas que tsc/vitest não pegam) |
| `NEETRU_PREPUSH_FAST=1` | Pula testes (só tipos/lint). Para iteração; **não** no push que vira PR |
| `--plan` | Mostra as etapas e sai, sem executar |
| `NEETRU_PREPUSH_NO_DOCS=1` | Pula só a etapa **docs** (declare no PR, como o skip) |

**Duas camadas:** o pre-push é o gate **barato** de todo push. Antes de **mergear na main** roda o gate **completo** do repo (no Core: `node scripts/pre-deploy-check.mjs` = tsc + vitest + `next build`; nos demais: `NEETRU_PREPUSH_FULL=1`). Cite a evidência (saída verde) no PR.

## Estado por repo (confira no repo, não decore)
- **Core** (`Neetru/neetru-core`): `.husky/pre-push` → `scripts/pre-push-check.mjs` — variante **estendida e escopada ao diff** (base = merge-base com `origin/main`): `tsc` root sempre; `tsc` de `functions/` se `functions/**` mudou (sem `functions/node_modules` = erro, não skip); `eslint` só nos arquivos alterados de `src/**` (>30 → `src` inteiro); frontmatter + manifest se `docs/**` mudou; `vitest --changed <merge-base>` por padrão, **full** se mudou `package*.json`/`tsconfig*`/`vitest.*`/`.npmrc`/`functions/**`. Mesmos flags.
- **Demais repos** (CLI, SDK, agente, libs, produtos): `scripts/pre-push-gate.mjs` (o template desta skill). Se o repo ainda não tem → adote (abaixo).

## Etapa **docs** (repos de produto — template ≥ v3)
Protocolo de docs de produto §8.3. Num repo **de produto** (tem `neetru.config.json`), quando o push muda algo em `docs/**` (ou na pasta de `docs.root`), o gate roda **`neetru docs check --changed --offline`** — a catraca: só os docs alterados contra a branch principal, com a taxonomia embutida na CLI (sem rede).
- **Erro** (FM/TI001/TI002/NM001/LK001/PB001/PR001/PR003…) **barra o push**; aviso e sugestão não.
- **Sem a CLI `neetru` ≥ 2.31.0** instalada, a etapa é **pulada com aviso** — nunca falha por falta de ferramenta. Atualize: `npm i -g @neetru/cli`.
- Não deu pra calcular o que mudou → roda a etapa (fail-closed, como o resto do gate).
- Repo sem `neetru.config.json` (CLI, SDK, agente, libs) não tem a etapa. O **Core** tem a própria checagem de docs (frontmatter + manifest) no `pre-push-check.mjs`.
- Doc quebrado que não é seu (legado)? A catraca só cobra o que você alterou: corrija o que tocou. Erro em doc alheio que você não mexeu não aparece.

## ⚠️ Worktree novo em repo com husky: NENHUM hook roda até você gerar `.husky/_`
O husky aponta `core.hooksPath` para `.husky/_` — pasta **gerada** (gitignored) pelo `npm install`. Um `git worktree add` (inclusive os worktrees de agentes em `.claude/worktrees/`) **não tem essa pasta** e ninguém roda `npm install` nele (node_modules costuma vir por junction) → git não acha hook nenhum → **pre-commit e pre-push somem em silêncio** e o push sobe sem gate (achado 2026-09-30, Core PR #518).
- **Ao criar o worktree:** `npx husky` na raiz dele (só gera `.husky/_`; não instala nada). Confira: `ls .husky/_/pre-push`.
- **Esqueceu e já empurrou:** rode o gate na mão sobre o que subiu e cite a saída no PR:
  `echo "refs/heads/<branch> $(git rev-parse HEAD) refs/heads/<branch> 0000000000000000000000000000000000000000" | node scripts/pre-push-check.mjs`
- **NÃO** aponte `core.hooksPath` pro `.husky/_` da árvore principal: o `h` do husky resolve o hook relativo à própria pasta → todo worktree rodaria o gate da árvore principal (código errado).
- Repos com o template desta skill (`.githooks/` versionado + `core.hooksPath=.githooks` relativo) **não** têm o problema: a pasta existe em todo worktree.

## Adotar num repo que não tem (5 min)
1. Copie `pre-push-gate.mjs` **desta pasta da skill** pra `scripts/pre-push-gate.mjs` do repo. Sem dependências (Node ≥ 18 + git). Detecta a stack:
   - **Node:** script `typecheck`; senão `lint` se for `tsc --noEmit`; senão `npx tsc --noEmit` se houver `tsconfig.json` → `lint` → `docs` (só repo de produto com `docs/**` alterado) → `test` → (`build` em FULL).
   - **Go** (`go.mod` sem `package.json`): `go vet ./...` → `go test ./...` → (`go build ./...` em FULL).
   - Override: `package.json` → `"neetru": { "prePush": ["typecheck", "test"] }`.
2. Ligue o hook **sem dependência nova** (não mexe em lockfile):
   ```sh
   mkdir -p .githooks
   printf '#!/usr/bin/env sh\nexec node "$(dirname "$0")/../scripts/pre-push-gate.mjs" "$@"\n' > .githooks/pre-push
   git update-index --add --chmod=+x .githooks/pre-push   # Windows não guarda +x sozinho
   printf '.githooks/* text eol=lf\n' >> .gitattributes     # hook sempre com LF
   git config core.hooksPath .githooks
   ```
   - **`.gitattributes` com `.githooks/* text eol=lf` é obrigatório:** em máquina com `core.autocrlf=true` (padrão do Git no Windows) o checkout grava o hook com CRLF, o shebang vira `sh\r` e o hook quebra.
   - No `package.json`, o `prepare` liga o gate pra quem clona e roda `npm install`. Use a forma **portátil** — só age se existir `.git` (arquivo ou pasta, então funciona em worktree) e nunca falha:
     ```json
     "prepare": "node -e \"try{if(require('fs').existsSync('.git'))require('child_process').execFileSync('git',['config','core.hooksPath','.githooks'],{stdio:'ignore'})}catch{}\""
     ```
     **Não** use `git config core.hooksPath .githooks || true`: no Windows o npm roda o script no `cmd.exe`, onde `true` não existe — se o `git config` falhar (ex.: pasta sem `.git`), o `|| true` vira erro e quebra o `npm install`.
   - Repo que já usa **husky**: ponha a linha `exec node …` no `.husky/pre-push`; não troque o mecanismo.
3. Teste: `node scripts/pre-push-gate.mjs --plan < /dev/null` (o gate lê o stdin antes de olhar a flag; sem o redirecionamento, num shell não interativo ele fica esperando) e um push de branch real. Pra validar o gate sem empurrar, use **`git hook run pre-push --to-stdin=<arquivo> -- origin <url>`** — ele monta o env que o git entrega no push (num worktree, `GIT_DIR=<repo>/.git/worktrees/<nome>`). `sh .githooks/pre-push` direto **não** reproduz esse env e esconde o problema abaixo.
   - **Etapas rodam sem `GIT_DIR` & cia** (template ≥ v2, `sanitizeGitEnv`): o git exporta pro hook as variáveis de repositório (`GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`…), e qualquer `git` disparado por um teste herdava isso e operava no **repo do push**, não na pasta temporária (incidente 2026-10-01 na CLI: `git init --bare` de teste deixou o clone real com `core.bare=true`, `user.name` de teste e um commit "init"). Se a suíte do repo chama `git`, faça também nos testes: env saneado explícito em todo `git`, `cwd` no tmpdir e um `setupFiles` do vitest que remove essas variáveis do `process.env`.
4. Documente no `CLAUDE.md`/`AGENTS.md` do repo (seção "Gate de pre-push" — modelo na skill `neetru-produto-md`).

## Gate vermelho — diagnosticar antes de pular
- **Rode de novo a etapa isolada** (`npm test -- <arquivo>`, `npx vitest run <arquivo>`). Passou isolada e falha na suíte = flaky/recurso, não bug.
- **Core, vitest com centenas de falhas de timeout em jsdom:** rebuild do graphify em background disputando CPU. Espere terminar e rode de novo (`reference_core_prepush_gate_flaky`).
- **`Failed to load url @neetru/<lib>`:** primeiro cheque BOM — `head -c3 node_modules/@neetru/<lib>/package.json | od -An -tx1` dando `ef bb bf` = versão publicada com BOM (Node tolera, Vite não). Aconteceu com `sql-guard 0.1.7`, `pii-mask 0.1.1` e mais 3 (`bug_bf5a98a0`) — atualize pra versão corrigida; reparo local só enquanto não sai: tirar os 3 bytes do arquivo em `node_modules` (não commita nada). Sem BOM e sem `dist` = install parcial → `npm ci`, **nunca com outra sessão mexendo no mesmo repo** (se não pode agora, é skip legítimo — declare no PR).
- **Testes que passam isolados falham no gate logo depois de um push, e o repo fica "estranho"** (`fatal: this operation must be run in a work tree`, commits que você não fez, `user.name` de teste): teste chamando `git` herdou o `GIT_DIR` do hook. Cheque `git config --local --list` (`core.bare`, `user.*`, `commit.gpgsign`) e `git reflog`; repare (`core.bare false`, `--unset` das chaves de teste, `reset --mixed` pro último commit legítimo — backup da config antes) e atualize o template pro v2.
- **Falha real no seu diff:** conserte. É pra isso que o gate existe.

## Quando pular é aceitável (e como)
Só quando a falha é **comprovadamente não-relacionada ao seu diff** (ambiente local quebrado, flaky conhecido) **e** você não pode consertar agora. Aí: `NEETRU_SKIP_PREPUSH=1 git push …` **+** no corpo do PR: o que falhou, por que não é do diff, a evidência (qual etapa passou isolada). "Tava demorando" **não** é motivo — use `NEETRU_PREPUSH_FAST=1` nos pushes intermediários.

## Nunca
- `git push --no-verify` escondido (é o mesmo skip, sem rastro).
- Desligar/editar o hook pra passar.
- Declarar "CI verde" olhando o GitHub — lá não roda nada; a evidência é a saída local do gate.
