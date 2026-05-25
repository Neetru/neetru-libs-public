# Instalação do plugin `neetru` no Claude Code

Três opções. A **Opção A** (marketplace) é a mais prática para devs com acesso ao repo. A **Opção B** (diretório local) funciona sem publicar nada. A **Opção C** (symlink) é para quem já tem o repo clonado e quer atualizações automáticas.

---

## Opção A — Via marketplace (recomendada, se `Neetru/neetru-libs` for público)

O Claude Code suporta adicionar qualquer repo GitHub como marketplace, incluindo monorepos com `--sparse`.

```bash
# 1. Adiciona o repo neetru-libs como marketplace (monorepo com sparse checkout)
claude plugin marketplace add Neetru/neetru-libs \
  --sparse .claude-plugin plugins \
  --scope user

# 2. Instala a skill
claude plugin install neetru@neetru-libs --scope user

# 3. Reinicia o Claude Code para carregar
```

**Notas:**
- `--sparse .claude-plugin plugins` limita o checkout ao manifesto e à pasta `plugins/` dentro do repo. Sem isso, clona o repo inteiro (inclui `node_modules` dos pacotes npm — pesado).
- `--scope user` instala para todos os projetos do usuário. Use `--scope project` para instalar só no projeto atual (grava em `.claude/settings.json` local).
- O repo `Neetru/neetru-libs` precisa estar **público** para que outros devs consigam clonar sem autenticação extra. Se for privado, o dev precisa ter SSH ou token configurado no git.
- Após `marketplace add`, o marketplace fica disponível permanentemente. Não é preciso rodar de novo.

**Atualizar depois:**
```bash
claude plugin update neetru@neetru-libs
```

---

## Opção B — Diretório local (sem publicar no GitHub)

Se você já tem o repo clonado em disco, o Claude Code aceita um path local como marketplace.

```bash
# Substitua o path pelo caminho real do clone
claude plugin marketplace add /caminho/para/neetru-libs/claude-skills \
  --scope user

# Depois instala
claude plugin install neetru --scope user
```

Ou, mais direto, aponte o `--plugin-dir` na linha de comando do claude:

```bash
claude --plugin-dir /caminho/para/neetru-libs/claude-skills
```

`--plugin-dir` carrega o plugin para aquela sessão somente (não persiste). Útil para testar antes de instalar permanentemente.

---

## Opção C — Cópia manual (sem marketplace)

```bash
# Clone o repo (ou use o que você já tem)
git clone https://github.com/Neetru/neetru-libs.git ~/neetru-libs

# Copia a skill pro diretório de skills do Claude Code
mkdir -p ~/.claude/skills
cp -r ~/neetru-libs/claude-skills/skills/neetru ~/.claude/skills/neetru

# Reinicia o Claude Code
```

**Atualizar depois:**
```bash
git -C ~/neetru-libs pull
cp -r ~/neetru-libs/claude-skills/skills/neetru ~/.claude/skills/neetru
```

No Windows (PowerShell):
```powershell
git -C "$env:USERPROFILE\neetru-libs" pull
Copy-Item -Recurse -Force "$env:USERPROFILE\neetru-libs\claude-skills\skills\neetru" "$env:USERPROFILE\.claude\skills\neetru"
```

---

## Verificar instalação

Após instalar e reiniciar o Claude Code, execute num projeto Neetru:

```
/neetru
```

O Claude deve responder com o contexto da skill. Se não responder, verifique:

```bash
claude plugin list
# deve mostrar "neetru" na lista
```

---

## Desinstalar

```bash
claude plugin uninstall neetru
```

Ou, se instalou por cópia manual:
```bash
rm -rf ~/.claude/skills/neetru
```

---

## Pré-requisitos

- Claude Code instalado (`npm install -g @anthropic-ai/claude-code` ou equivalente)
- Acesso ao repo `Neetru/neetru-libs` (se usar Opção A — precisa ser público ou ter credenciais git)
- `@neetru/cli@2.8.0` instalado globalmente para usar comandos `neetru …` no terminal: `npm install -g @neetru/cli`

---

## Notas para o owner (pendências)

- **Repo precisa ser público** para que a Opção A funcione para devs externos sem configuração extra de git. Se ficar privado, a Opção B/C é a via.
- **Estrutura de marketplace**: o `claude plugin marketplace add` espera um repo com estrutura de marketplace (diretório `plugins/` com subpastas de plugins, cada uma com `.claude-plugin/plugin.json`). A estrutura atual em `claude-skills/` usa `skills/neetru/` diretamente como plugin. Para usar como marketplace formal, seria necessário criar `plugins/neetru/.claude-plugin/plugin.json` e mover os arquivos. Por ora, a Opção B (`--plugin-dir`) e a Opção C (cópia manual) funcionam sem ajuste.
- O manifesto `.claude-plugin/plugin.json` está na raiz de `claude-skills/`, o que é o formato correto para instalar via `--plugin-dir`.
