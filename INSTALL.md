# Instalação das skills Neetru no Claude Code

Este diretório é publicado como o repositório **público** `Neetru/neetru-libs-public` —
a **loja** de onde as máquinas baixam. Lá, o conteúdo deste diretório fica na **raiz**:
`plugins/`, `INSTALL.md`, `README.md`, `.claude-plugin/marketplace.json`.

> Os caminhos abaixo são os da **loja**. Nenhum deles tem prefixo `claude-skills/`:
> esse prefixo só existe no repo privado `Neetru/neetru-libs`, onde estes arquivos
> são editados. Clonar o repo privado não é necessário — nem possível, pra quem não
> tem acesso.

---

## Opção A — `neetru archive skills install` (recomendada)

Quem já tem a CLI Neetru não precisa de marketplace nenhum:

```bash
npm install -g @neetru/cli     # versão: npm view @neetru/cli version
neetru archive skills install  # instala/atualiza as skills em ~/.claude/skills/
```

Roda de novo pra atualizar. É o caminho que as skills `neetru-onboarding` e
`neetru-produto-md` mandam seguir. (O comando é `neetru archive skills install` —
`neetru skills install` não existe.)

---

## Opção B — Marketplace do Claude Code

A loja é um repo **público**: o clone é anônimo, sem SSH nem token.

```bash
# 1. Adiciona a loja como marketplace
claude plugin marketplace add Neetru/neetru-libs-public --scope user

# 2. Instala o plugin `neetru` vindo do marketplace `neetru`
claude plugin install neetru@neetru --scope user

# 3. Reinicia o Claude Code
```

**Notas:**
- `--scope user` vale pra todos os projetos. `--scope project` grava no
  `.claude/settings.json` do projeto; `--scope local`, no `settings.local.json`.
- Não precisa de `--sparse`: a loja não tem `node_modules` versionado e o
  manifesto está na raiz.
- O nome do marketplace (`neetru`) vem do campo `name` de
  `.claude-plugin/marketplace.json`; o nome do plugin (`neetru`), do `plugins[].name`.
  Daí o `neetru@neetru`.

**Atualizar depois:**
```bash
claude plugin marketplace update neetru
claude plugin update neetru@neetru
```

---

## Opção C — Diretório local (testar antes de instalar)

Com um clone da loja em disco:

```bash
git clone https://github.com/Neetru/neetru-libs-public.git ~/neetru-libs-public

# carrega só nesta sessão, sem instalar nada
claude --plugin-dir ~/neetru-libs-public/plugins/neetru
```

Ou registra o clone como marketplace:

```bash
claude plugin marketplace add ~/neetru-libs-public --scope user
claude plugin install neetru@neetru --scope user
```

---

## Opção D — Cópia manual (sem marketplace)

As skills são `plugins/neetru/skills/<nome>/SKILL.md`. Pra copiar todas:

```bash
git clone https://github.com/Neetru/neetru-libs-public.git ~/neetru-libs-public
mkdir -p ~/.claude/skills
cp -r ~/neetru-libs-public/plugins/neetru/skills/. ~/.claude/skills/
```

**Atualizar depois:**
```bash
git -C ~/neetru-libs-public pull
cp -r ~/neetru-libs-public/plugins/neetru/skills/. ~/.claude/skills/
```

No Windows (PowerShell):
```powershell
git -C "$env:USERPROFILE\neetru-libs-public" pull
Copy-Item -Recurse -Force "$env:USERPROFILE\neetru-libs-public\plugins\neetru\skills\*" "$env:USERPROFILE\.claude\skills\"
```

---

## Verificar instalação

Reinicie o Claude Code e, num projeto Neetru:

```
/neetru
```

Se não responder:

```bash
claude plugin list               # deve mostrar "neetru"
claude plugin marketplace list   # deve mostrar o marketplace "neetru"
```

Na cópia manual (Opção D) não há plugin nem marketplace — confira os arquivos:

```bash
ls ~/.claude/skills/neetru/SKILL.md
```

---

## Desinstalar

```bash
claude plugin uninstall neetru@neetru
claude plugin marketplace remove neetru
```

Se instalou por cópia manual, apague os diretórios de skill que copiou de
`plugins/neetru/skills/` pra `~/.claude/skills/`.

---

## Pré-requisitos

- Claude Code instalado (`npm install -g @anthropic-ai/claude-code`).
- Pras Opções A e B, nada além disso: `Neetru/neetru-libs-public` é público.
- Pros comandos `neetru …`: `npm install -g @neetru/cli`. **Não fixe versão** —
  confira com `npm view @neetru/cli version`.

---

## Pra quem edita estas skills

A fonte é o repo privado `Neetru/neetru-libs`, em `claude-skills/`. A loja é
espelho — **não edite direto lá**, a próxima sincronização sobrescreve.

```bash
# no repo privado, depois de editar claude-skills/
npm run sync:mirror -- <caminho-do-clone-da-loja>
```

O gate de pré-push recusa o push quando `claude-skills/` mudou e o espelhamento
não foi registrado. Nunca houve sincronização automática: o workflow que
prometia isso falhou em 14/14 execuções (Actions da org sem cobrança). Detalhe
em `scripts/store-sync.mjs` do repo privado.
