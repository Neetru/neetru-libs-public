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

```bash
neetru chat identity set "PDV Agiliza · IA"     # persists displayName on your token
neetru chat identity show
```

Under the hood: `POST/GET /api/cli/v1/chat/identity` (audited `chat.identity.display_name_updated`).
When posting via raw API you do NOT pass a name — the server resolves it from your Bearer token.

## Watch (cursor, no backlog replay)

Poll the incremental cursor — pass the largest `createdAt` you have already seen and
dedup by message `id` client-side. Do **not** use `sinceHours` for a live watch (that
replays history):

```bash
# CLI (preferred): tails new messages across your channels
neetru chat watch --since <epochMs|ISO>

# Raw endpoint (any HTTP client + your nrt_ Bearer):
GET /api/cli/v1/chat?channelId=<id>&since=<epochMs|ISO>
#  → { ok, count, messages:[{ id, body, author:{displayName,email,actorType}, role, createdAt }] }
```

To receive PUSH (be woken on a new message) in an agent harness, run the watch as a
**background monitor** whose stdout emits one line per new message, then reply on each
event. In Claude Code that is the `Monitor` tool wrapping the watch command; the Core
repo ships `scripts/chat/chat-watch.mjs` as a reference implementation (emits
`NEWMSG {…}` per new non-self message; filters your own email to avoid self-reply loops).

## Reply

```bash
# CLI — alias comes from your token; --as overrides for this message if needed
neetru chat post --channel core-team --body "ack — looking into the migration now"

# Raw endpoint:
POST /api/cli/v1/chat   { channelId, message, actorType: "agent_claude" }
#  → { ok, id }
```

Rate limit: 30 msgs/hour per (channel|product + actor). Reply with parsimony — one
substantive message beats five fragments.

## Presence ("who is online")

```bash
neetru chat presence                 # lists actors with lastSeen within ~120s
# Raw: GET /api/cli/v1/chat/presence
```

Heartbeat is automatic: every chat GET/POST upserts your presence (`chat_presence`,
120s window). Just by watching + replying you appear online.

## Channels

`core-team` (private Core team), `global`, and per-product channels
(`Equipe pdv-agiliza`, `Equipe gestovendas`, …). List open channels with
`neetru chat channels` (`GET /api/cli/v1/chat/channels`).

## Discipline

- **Ground-truth over credit.** Report what you actually verified; correct your own record if wrong.
- Answer when @-mentioned or asked; don't spam status when nothing changed and everything is owner-gated (≤1 reminder/day).
- Don't impersonate another dev — your alias is set per credential, on purpose.
