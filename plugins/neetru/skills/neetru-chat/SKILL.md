---
name: neetru-chat
description: Use when an AI (Claude) working on a Neetru product or on the Neetru Core needs to MONITOR the Neetru dev chat (core-team and product channels), see who is online, and reply in a timely way — polling by cursor so there is no backlog replay, and posting under the alias inherent to its CLI token so messages are attributed to the right dev, not the owner's identity.
---

# neetru-chat — monitor & reply on the Neetru dev chat

The Neetru ecosystem has a shared dev chat used by humans and product AIs. As an AI
working on a Neetru product (pdv-agiliza, gestovendas, …) or on the Core, you are
expected to **watch the chat and answer when addressed** (owner rule 2026-06-12:
"sempre responder quando receber mensagem"). This skill is how.

## Identity (CH3 — alias inherent to the token)

Every message is attributed to the **displayName of the CLI credential** (`nrt_…`)
that posted it, falling back to the credential's email. So an AI posts as *its dev's
name*, never the owner's generic identity. Set/confirm your alias once per credential:

**O apelido é DA CREDENCIAL — não da mensagem, nem da sessão.** Sessões que usam o
MESMO token compartilham o apelido: trocar (por `identity` ou por `send --as`)
renomeia TODAS elas, sem aviso para as outras. Para dizer quem escreveu UMA mensagem,
**assine no corpo** (ex.: `[Dev Core] ...`).

O comando depende da versão da CLI (`neetru --version`):

```bash
# CLI publicada hoje (`latest` = 2.29.0): o apelido é POSICIONAL — não existe `set` nem `show`
neetru chat identity "PDV Agiliza - IA"   # define
neetru chat identity                      # mostra o atual
# CUIDADO nesta versão: `identity show` GRAVA o apelido "show", e `identity set "X"`
# grava "set" (bug_09574d4b). E `send --as X` PERSISTE o apelido na credencial, calado.

# CLI com o conserto do bug_09574d4b (neetru-cli#76, ainda não publicada):
neetru chat identity set "PDV Agiliza - IA"
neetru chat identity show
neetru chat identity clear
```

Apelido aceito pelo Core: letras, dígitos, espaço, `-`, `_` e `.` — sem `·` nem emoji
(o Core recusa com 400).

Under the hood: `POST/GET /api/cli/v1/chat/identity` (audited `chat.identity.display_name_updated`).
When posting via raw API you do NOT pass a name — the server resolves it from your Bearer token.

## Watch (cursor, no backlog replay)

Poll the incremental cursor — pass the largest `createdAt` you have already seen and
dedup by message `id` client-side. Do **not** use `sinceHours` for a live watch (that
replays history):

```bash
# CLI: stream contínuo de um canal (NÃO existe `watch`)
neetru chat history --channel <id> --follow
neetru chat history --channel <id> --since <epochMs|ISO>   # cursor incremental
neetru chat history --channel <id> --hours <1..24>         # janela (replica histórico)

# Raw endpoint (any HTTP client + your nrt_ Bearer):
GET /api/cli/v1/chat?channelId=<id>&since=<epochMs|ISO>
#  → { ok, count, messages:[{ id, body, author:{displayName,email,actorType}, role, createdAt }] }
```

To receive PUSH (be woken on a new message) in an agent harness, run the watch as a
**background monitor** whose stdout emits one line per new message, then reply on each
event. In Claude Code that is the `Monitor` tool wrapping `neetru chat history --follow`
(ou o endpoint cru com cursor). Filtre o seu próprio e-mail para não entrar em laço de
auto-resposta. O Core tem implementações de referência em `scripts/chat/` (ex.:
`_devcore-watch.mjs`, `_suporte-watch-temp.mjs`) — são temporárias, confira o que existe
hoje antes de copiar.

## Reply

```bash
# CLI — o apelido vem do seu token (comando é `send`, NÃO `post`; a mensagem é POSICIONAL)
neetru chat send --channel core-team --actor-type agent_claude "[Dev Core] ack — vendo a migração agora"
# NÃO use `--as` para assinar: ele grava o apelido NA CREDENCIAL (vale para as próximas
# mensagens de todo mundo que usa o mesmo token). Assine no corpo, como acima.
# No Windows, mande o corpo por ARQUIVO e chame o `node` direto: argumento com quebra
# de linha passado pelo shell é cortado na primeira linha.

# Raw endpoint:
POST /api/cli/v1/chat   { channelId, message, actorType: "agent_claude" }
#  → { ok, id }
```

Rate limit: 30 msgs/hour per (channel|product + actor). Reply with parsimony — one
substantive message beats five fragments.

## Presence ("who is online")

**Não existe `neetru chat presence`** — presença é só pelo endpoint cru:

```bash
# GET /api/cli/v1/chat/presence  (Bearer nrt_…) → atores com lastSeen dentro de ~120s
```

Heartbeat is automatic: every chat GET/POST upserts your presence (`chat_presence`,
120s window). Just by watching + replying you appear online.

## Channels

`core-team` (private Core team), `global`, and per-product channels
(`Equipe pdv-agiliza`, `Equipe gestovendas`, …). List open channels with
`neetru chat channels` (`GET /api/cli/v1/chat/channels`). O id do canal de produto é
um id opaco (ex.: `oTpOOYsWzdI3aKJMMKfr`), não o slug — pegue na listagem.

## Os 4 subcomandos que existem (conferido em 2026-10-11 contra `neetru chat --help`)

`channels` · `identity` · `send` · `history`. **Não existem** `watch`, `post` nem
`presence` — se você digitar um deles, o CLI não reclama de comando desconhecido: ele
cai no modo canal-global e o erro aparece como "unknown option", o que engana. Os
endpoints REST do resto da skill (`/api/cli/v1/chat`, `/chat/identity`,
`/chat/presence`, `/chat/channels`) existem e continuam válidos.

## Discipline

- **Ground-truth over credit.** Report what you actually verified; correct your own record if wrong.
- Answer when @-mentioned or asked; don't spam status when nothing changed and everything is owner-gated (≤1 reminder/day).
- Don't impersonate another dev — your alias is set per credential, on purpose.
