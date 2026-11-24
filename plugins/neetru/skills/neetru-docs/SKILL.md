---
name: neetru-docs
description: Use when an AI (Claude) needs to FIND an answer in the Neetru docs, WRITE a new doc, or read the canonical docs through the CLI. Method, in this order — the chapter summary first (the chapter's SINTESE.md), then the right doc through its front-matter metadata (id, etiquetas, palavras_chave, estado, found with grep), then the code. Covers the metadata fields and how to write a new Core doc with them, the product's own docs/ (`neetru docs init/new/check/sync`), and the zero-to-production reading order (which doc and which skill for each step). Read the real doc instead of guessing commands, endpoints or schemas that do not exist.
---

# neetru-docs — achar a resposta, escrever doc novo, roteiro zero→produção

> Ordem de verdade: decisão do dono e `CLAUDE.md` > memória antiga; **código > doc**. Doc velho traz aviso no topo, e a síntese do capítulo lista o que está vencido. Versão se confere no campo: `npm view @neetru/cli version`, `npm view @neetru/sdk version`, `/api/health` (`.sha`, `.revision`). Número de versão escrito em doc envelhece: não o copie.

## 1. Achar a resposta, nesta ordem

1. **A síntese do capítulo.** Cada capítulo de `docs/sistema/` tem um `SINTESE.md`: decisões fixas, uma tabela «pergunta → resposta curta → onde está o detalhe» e a seção «Vencido ou em disputa». Leia antes de abrir o doc grande. `find docs -name SINTESE.md` lista os capítulos que já têm (ex.: `docs/sistema/manuais/infra/SINTESE.md`, `docs/sistema/runbooks/SINTESE.md`). Capítulo sem síntese: o `INDEX.md` da pasta e, por último, `docs/INDEX_MESTRE.md`.
2. **O doc certo, pelos metadados.** Todo doc do Core abre com front matter em português (seção 2). Procure por ele, não pelo nome do arquivo, que muda de lugar:
   ```bash
   grep -rlE '^etiquetas:.*tema:login' docs --include='*.md'            # por tema
   grep -rlE '^etiquetas:.*produto:pdv-agiliza' docs --include='*.md'   # por produto
   grep -rlE '^etiquetas:.*superficie:cli' docs --include='*.md'        # por onde a pessoa encosta
   grep -rlE '^palavras_chave:.*checkout' docs --include='*.md'         # por palavra-chave
   grep -rn  '^id: core\.deploy' docs --include='*.md'                  # por id
   grep -rlE '^etiquetas:.*tema:deploy' docs | xargs grep -lE '^estado: vigente'   # dois filtros: tema e estado
   grep -h '^resumo:' $(grep -rlE '^etiquetas:.*tema:backup' docs)      # os resumos de um tema
   ```
   O padrão `etiquetas:.*tema:login` não depende das aspas nem de a lista ser em linha ou em bloco (em bloco, use só `tema:login` e confira que o acerto está no front matter). `estado: vigente` separa o que vale de `rascunho` e `arquivado`.
3. **O código.** O doc diz, o código prova. Para CLI: `neetru <comando> --help` (traz exemplos) e o `docs/COMANDOS.md` do repo `neetru-cli`. Para SDK: o campo `exports` do `package.json` e os tipos do pacote instalado.

**Sem o repo do Core** (repo de produto): `neetru docs list --json | jq -r '.docs[] | select(.title|test("login";"i")) | .slug'` acha o slug, e `neetru docs get <slug>` traz o doc.

## 2. Os metadados de um doc do Core

| Campo | O que é | Regra |
|---|---|---|
| `id` | identificador estável: `core.<assunto-em-kebab>` | não muda quando o arquivo muda de lugar; até 100 caracteres; único |
| `titulo` | o título do doc | o mesmo do `# ` do corpo |
| `grupo`, `categoria` | onde o doc mora na taxonomia | listas fechadas em `src/lib/docs-taxonomy.json`: `grupo` é a categoria sem acento, em kebab; `categoria` é a subcategoria |
| `palavras_chave` | o que alguém digitaria para achar o doc | de 3 a 8, do tesauro |
| `etiquetas` | `chave:valor`, no máximo 8 | `tipo:` (exatamente uma), `tema:`, `produto:`, `superficie:`, `repo:`; os valores saem de `scripts/docs/vocabulario-docs.json` (temas como `login`, `checkout`, `assinatura`, `deploy`, `seguranca`, `backup`, `lgpd`) |
| `publico` | `equipe`, `dev-saas` ou `cliente` | `cliente` é texto-fonte de superfície pública: segue as regras de conteúdo público do `CLAUDE.md` e não cita o domínio do painel staff |
| `estado` | `vigente`, `rascunho` ou `arquivado` | doc vivo `vigente` com mais de 180 dias sem revisão reprova no lint |
| `atualizado_em` | `AAAA-MM-DD` | a última vez que alguém conferiu o texto com o código |
| `resumo` | a resposta em uma frase | de 40 a 220 caracteres; é o que o `grep` mostra |

Os campos antigos (`title`, `description`, `category`, `subcategory`, `type`, `status`, `date`, `updated`, `owner`, `audience`) seguem exigidos pelo `docs-lint` até o validador migrar, e não podem divergir dos novos.

## 3. Escrever um doc novo no Core

1. **Pasta e nome** pela norma `docs/sistema/contrib/PROTOCOLO_WIKI_INTERNA.md` (nome em `MAIÚSCULO_COM_UNDERLINE`, título, ciclo de vida). Escolha o capítulo pelo assunto, não pelo autor.
2. **Front matter completo**, os campos da seção 2 mais os antigos. Exemplo:
   ```yaml
   id: core.runbook-heartbeat-da-vm-parou
   titulo: "Heartbeat da VM parou"
   grupo: infraestrutura
   categoria: vm-e-frota
   palavras_chave: [vm, agente, incidente]
   etiquetas: ["tipo:runbook", "tema:incidente", "superficie:painel"]
   publico: equipe
   estado: vigente
   atualizado_em: 2026-11-23
   resumo: "O que conferir, em ordem, quando o heartbeat de uma VM para, e quando acionar o dono."
   ```
3. **Valide** antes do PR: `npm run lint:docs-meta` (só o que mudou: `node scripts/docs/validar-metadados.mjs --changed`) e `node scripts/docs-lint.mjs --changed`.
4. **Atualize a síntese** do capítulo (a tabela de perguntas e, se o doc nasceu já vencido, a seção «Vencido ou em disputa») e o `INDEX.md` da pasta. Doc que ninguém acha por pergunta ou por etiqueta não existe.

## 4. Ler a doc pela CLI

```bash
neetru docs list                      # registry: { ok, count, docs: [{ slug, title, category }] }
neetru docs get <slug>                # { ok, doc: { slug, title, category, version, … }, content, sha256 }
neetru docs get <slug> --meta-only    # só os metadados, sem baixar o markdown
neetru docs open [topic]              # atalho por tópico (sdk, cli, db, webhooks, auth)
```

O markdown vem em **`content`, no topo da resposta**, e não dentro de `doc`: em `--json`, leia `.content`. O conteúdo é público; a chave `nrt_…` só carimba a auditoria.

## 5. Os docs do SEU produto (protocolo v1)

Os comandos da seção 4 leem a doc **do Core**. O `docs/` do **seu produto** segue `docs/sistema/contrib/PROTOCOLO_DOCS_PRODUTOS_SAAS.md` do Core (título, nome e ciclo de vida vêm de `PROTOCOLO_WIKI_INTERNA.md`). Sem `neetru docs init` na sua CLI, ela é anterior à 2.31.0: `npm i -g @neetru/cli`.

```bash
neetru docs init                 # mínimo do 1º dia: README, CHANGELOG, docs/index.md, visão, arquitetura, runbook de deploy
neetru docs init --com-api       # + docs/api/API_V1.md (o produto expõe /api/v1)
neetru docs init --migrar        # repo que JÁ tem docs: só acrescenta front matter inferido + relatório em docs/_audit/
neetru docs new adr "Usar Postgres para vendas"   # doc novo, na pasta e com o nome e o front matter do protocolo
neetru docs check --changed      # antes do PR: FM/TI/NM/LK/PB/LC (os códigos do Core) + PR001–PR004
neetru docs sync --dry-run       # o que subiria para o Core
```

- **Dois eixos:** `category` + `subcategory` dizem o **assunto** (lista fechada; em produto não se usa `Produtos SaaS`, `CLI`, `SDK` nem `Bibliotecas`, PR003); `type` diz a **forma** (`guia`, `referencia`, `arquitetura`, `adr`, `runbook`, `norma`, `plano`, `relatorio`, `incidente`, `ata`, `changelog`). O front matter de produto exige `product: <slug>`, igual ao do `neetru.config.json` (PR001). O `README.md` e o `CHANGELOG.md` da raiz não têm front matter.
- **`init` é idempotente.** `--migrar` não move, não renomeia e não muda o texto: só põe front matter e escreve o relatório, com cada inferência e a confiança dela. Mover é decisão humana, num PR à parte; depois, `neetru docs init` cria o que falta do mínimo.
- **O deploy só AVISA** (decisão do dono, 03/10/2026): `neetru deploy` roda o check e segue mesmo com erro. Rode `neetru docs check` antes de declarar pronto.
- **Publicar no Core é opcional:** `"docs": { "publishOnDeploy": true }` no `neetru.config.json` publica no fim do deploy de **produção** (falha na publicação não derruba o deploy), ou à mão com `neetru docs sync`. Só sobe doc sem erro; `audience: publico` com `status: active` vira público, o resto fica interno; nada é apagado no Core.
- `audience: publico` (ex.: `docs/usuario/`) é texto de superfície pública: sem o domínio do painel staff nem e-mail pessoal (PB001), sem auto-elogio, sem métrica inventada.

## 6. Roteiro zero→produção: a ordem, e onde está o conteúdo de cada passo

1. **Máquina e conta:** `bootstrap`, `login`, `whoami`, `doctor` verde antes de escrever código → `neetru-onboarding`.
2. **Chat com a equipe** → `neetru-chat`.
3. **SDK como único conduíte de dados** (nenhum produto o contorna: `neetru-regras`). O login OIDC usa `config.oidcClientId` (o client_id do login-client; é a audience do `verifyToken`) e o fluxo `authorization_code` com PKCE. Erro do SDK → `neetru-sdk-troubleshooting`.
4. **Deploy na VM** → `neetru-deploy`. Use VM que já existe (`neetru servers list`); VM nova custa dinheiro e é do dono.
5. **Ambiente e tenant.** Produto deployado direto, sem workspace antes, pode ficar sem tenant de produção e com `serverId` apontando para VM apagada. É do motor de ambientes do Core, não do produto → `neetru-troubleshooting` (§ «app roda mas fora do ambiente»).
6. **Credencial e OIDC pelo injetor do servidor.** O produto não vê o valor nem o põe no `--env-file`: o `--env-file` descarta `*SECRET*`, `*KEY*`, `*TOKEN*`, `*PASSWORD*` e `DATABASE_URL`, e o app sobe sem credencial (`missing_api_key` só em produção). Quem emite a credencial é o dono → `neetru-deploy` e `neetru-regras`. As três credenciais, por que o produto nunca vê o valor e o que só o dono emite: `docs/_review/GUIA_CREDENCIAL_SECRET_PRODUTOS_2026-07-01.md`; as dez perguntas da jornada real do PDV: `docs/_review/FAQ_MATERIAL_PDV_2026-07-01.md` (ambos de 01/07/2026: confira o que mudou).
7. **Migração de schema:** `neetru db apply --dry-run`; a destrutiva pausa e pede `neetru db migrations confirm` com MFA → `neetru-migrations`.
8. **Prova de ponta a ponta:** só declare no ar com login e venda provados e o `/api/health` 200. Merge não é live → `neetru-release-gates`.

## Disciplina

- Doc vence memória; código vence doc. Em conflito de superfície do SDK ou da CLI, a skill de domínio (`neetru-sdk-troubleshooting`, `neetru-deploy`) e o `--help` vencem a doc datada.
- Achou doc errada (promete comando que não existe, versão velha)? Conserte o doc ou avise no `neetru-chat` (core-team), em vez de repetir o erro.
- Nunca cole segredo, token, `.env` ou secret OIDC no chat. O escopo de `neetru bug` é só Core, SDK, CLI e libs (`neetru-regras`).
