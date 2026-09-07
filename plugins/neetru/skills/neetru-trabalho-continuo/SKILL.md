---
name: neetru-trabalho-continuo
description: Use SEMPRE — não é opcional. Governa como qualquer AI (Claude) trabalhando num produto Neetru ou no Core opera entre o início e o fim de uma sessão/tarefa: ser PROATIVO por padrão (ao terminar algo, já checar o que mais falta, sem esperar o humano perguntar), sobreviver a interrupções ("incêndio"/incidente) sem esquecer o que estava fazendo, e reportar em UM relatório consolidado no final — nunca em pingos fragmentados de "fiz X, e agora?". Owner (2026-09-07): política dura, sem exceção.
---

# neetru-trabalho-continuo — proativo, não reativo. Contínuo, não picado.

> Regra dura do owner (2026-09-07), nasceu de frustração real: agente para no meio,
> espera o humano perguntar "o que falta", ou esquece a tarefa original quando um
> incêndio aparece. **Isso acaba aqui.** Vale pra qualquer AI rodando em qualquer
> repo Neetru (Core, PDV Agiliza, gestovendas, o que vier depois).

## O padrão errado (proibido)

```
> termina tarefa A
> "Pronto! Fiz A. Quer que eu continue com B?"
> [espera humano responder]
> termina B
> "Feito B também! E agora, faço C?"
> [espera de novo]
```

Isso é **reativo**: o agente vira um funcionário que só faz uma coisa de cada vez e
precisa ser cutucado pra continuar. Irrita porque o humano queria ligar o "piloto
automático" e voltar quando tudo estivesse pronto — não ficar de babá aprovando
micro-passo por micro-passo.

## O padrão certo (obrigatório)

Ao terminar QUALQUER tarefa, antes de considerar a sessão "parada" ou de gerar
qualquer relatório pro humano, **sempre**, na hora, sem perguntar:

1. Checa a lista de tarefas em andamento (TodoWrite / task list da sessão) —
   tem algo `pending`? Continua nele.
2. Checa `neetru bug list --status open` filtrado pro teu escopo (Core: Core/SDK/
   CLI/libs; produto: o próprio produto) por HIGH/CRIT — tem algo que é teu e
   ninguém está tocando? Ataca.
3. Checa saúde da infra que te compete (health endpoints, `neetru servers list`,
   VM/DB do teu produto) — alguma coisa degradada silenciosa?
4. Checa o dev chat (`neetru-chat`) por qualquer coisa endereçada a você que
   ainda não respondeu.
5. **Só se as 4 acima vierem vazias** é que a sessão de trabalho contínuo
   realmente não tem mais nada — aí sim reporta.

Isso não é uma sugestão de boa prática — é o **loop padrão** entre uma tarefa e a
próxima. Nenhuma tarefa termina "sozinha" sem esse check.

## Sobrevivendo ao incêndio (não esquecer o que você estava fazendo)

Vai acontecer: você está no meio da tarefa A, um incidente P0 aparece no chat ou no
bug tracker, você larga A pra apagar o incêndio — **até aqui certo, incidente ativo
sempre fura fila** (`feedback_nunca_espere_resolva`). O erro é o que vem depois:
apagar o incêndio e **esquecer que A existia**.

- **Antes de largar A pelo incêndio**, registra o estado de A no lugar que
  sobrevive à troca de contexto: `TodoWrite` (marca A como pendente com o que já
  foi feito) — não confia só na sua própria memória de curto prazo da conversa,
  porque a sessão pode ser resumida/compactada no meio do incêndio.
- **Ao fechar o incêndio**, antes de reportar "incêndio resolvido", olha de novo
  a lista de tarefas — A ainda está lá, pendente. Retoma. Não espera o humano
  lembrar "ah, e aquilo que você tava fazendo antes?".
- Se o incêndio for longo (h+) e A ficar realmente irrecuperável na mesma sessão,
  **documenta explicitamente** (bug report ou nota no próprio TodoWrite) o que
  ficou pra trás e por quê — nunca um sumiço silencioso.

## As ferramentas certas pra cada coisa (não usa uma pra tudo)

- **`neetru bug report` / `neetru bug list`** — bug real (algo quebrado no
  Core/SDK/CLI/libs, ou no teu produto). Escopo errado = `wont_fix` educado, não
  ignora.
- **TodoWrite / task list da sessão** — trabalho EM ANDAMENTO nesta sessão
  (passos de uma tarefa maior, o que falta, o que já foi feito). É a memória que
  sobrevive a um incêndio no meio.
- **Dev chat (`neetru-chat`)** — coordenação com outros agentes/devs (evitar
  colisão, pedir autorização, avisar owner de algo gated). **Não é** onde o
  trabalho "mora" — é onde ele é comunicado. Não confunda "mandei mensagem no
  chat" com "resolvi o problema".
- Infra/health checks — pra saber se tem fogo silencioso que ninguém reportou
  ainda (a pior categoria: ninguém sabe que está quebrado).

## O relatório final é UM só, completo, com evidência — não picado

Quando o humano voltar/checar a sessão, ele quer ver **tudo**, de uma vez, no
estado real — não uma sequência de "ah, e também fiz isso, e isso outro". Formato
mínimo aceitável:

- **O que está 100% feito** — com a evidência de que está (teste passou, health
  200, log confirmando), não "acho que deu certo".
- **O que ficou pendente** — e POR QUÊ (esperando autorização de X, bloqueado por
  Y, precisa de decisão do owner sobre Z). Nunca "esqueci" ou silêncio.
- **O que ainda não está funcionando** — nomeado explicitamente, sem suavizar.
  Se algo quebrou de novo ou nunca foi verificado de verdade, diz isso.

Reportar ANTES de chegar nesse estado só é aceitável quando o PRÓXIMO passo
depende de uma decisão que literalmente só o humano pode tomar (destrutivo,
deploy, custo, MFA/step-up — ver `neetru-regras`). Mesmo aí: não para tudo — o
que **não** depende dessa decisão continua andando em paralelo enquanto espera.

## Testes automatizados não são opcionais

Nenhuma tarefa de código é "feita" sem rodar a suíte de teste relevante e ela
passar — não é uma etapa separada que se faz "depois", é parte da definição de
"pronto". Se você mudou comportamento sem cobertura de teste existente, adiciona
teste ANTES de reportar como concluído. "Funcionou quando eu testei na mão uma
vez" não é evidência suficiente pro relatório final — teste automatizado que
outra pessoa (ou você, semana que vem) pode rodar de novo é.

## Checklist rápido (relê antes de qualquer "terminei")

- [ ] Testei de verdade (suíte automatizada), não só "parece que funciona"?
- [ ] Chequei bug tracker + saúde de infra + chat antes de considerar parado?
- [ ] Alguma tarefa anterior ficou pra trás de um incêndio? Retomei?
- [ ] Meu relatório é completo (feito+evidência / pendente+motivo / quebrado),
      não fragmentado?
