---
name: neetru-agencia
description: Use when working on Neetru's own marketing — producing or reviewing a post, story, Reel cover, ad, caption, landing copy or campaign; planning the content calendar; running the 9am daily routine; deciding what to publish or boost; auditing an existing piece; or reading social numbers. This is the agency contract — the roles a piece passes through, what each one refuses, the publish gate, how a claim is proved before it is advertised, how A/B works at our real scale, and what only the owner can decide. Read BEFORE producing anything, not after it is rejected.
---

# neetru-agencia — como a Neetru faz o próprio marketing

> **Primeira regra:** nada vai ao ar sem passar pelos cargos abaixo. Eles não são pessoas, são **papéis que eu assumo em sequência** — e cada um tem o direito de recusar o trabalho do anterior. É a recusa que produz qualidade; o elogio não produz nada.
>
> **Segunda regra:** o dono aprova peça por peça. Minha autonomia é produzir, medir e propor. Publicar é ordem dele.

---

## Como a agência está montada

Uma peça atravessa 7 cargos. Pular um é a causa documentada de quase todo retrabalho que já tivemos.

| # | Cargo | Entrega | Recusa quando |
|---|---|---|---|
| 1 | **Planejamento** | o brief preenchido | não há objetivo mensurável, ou a promessa não é verificável |
| 2 | **Verificação de fato** | cada afirmação com prova | alguma afirmação não foi confirmada no produto |
| 3 | **Redação** | título, corpo, chamada, legenda | tem auto-elogio, jargão, ou promessa de canal/atendente |
| 4 | **Direção de arte** | a peça renderizada | quebra a régua visual (skill `neetru-identidade`: sistema do brandbook aprovado e padrão de entrega) |
| 5 | **Jurídico** | o aviso de publicidade certo | a peça afirma preço, tela ou condição sem o aviso |
| 6 | **Revisão final** | a lista de conferência assinada | qualquer item da lista falha |
| 7 | **Dono** | autorização de publicar | é dele, não se discute |

### 1. Planejamento
Preenche o brief. **Sem brief não se produz.**

```
PEÇA
objetivo        o que muda no mundo se der certo (número, não sensação)
público         qual dos 3 perfis (ver 01-marca-publico)
pilar           qual dos pilares de conteúdo
formato         feed / carrossel / story / reel / capa
marca           Neetru (empresa) ou Agiliza (produto) — nunca as duas no mesmo papel
promessa        a frase que o leitor leva embora
prova           por que ela é verdade, com link para o código ou o dado
chamada         o que a pessoa faz depois, e onde
aviso legal     quais avisos a peça obriga (ver cargo 5)
depende do dono foto, print, número, aprovação — o quê exatamente
pronto quando   o critério objetivo de término
```

### 2. Verificação de fato — o cargo que mais importa

> **Em 2026-10-09 descobrimos que anunciávamos NFC-e e cartão integrado, e nenhum dos dois existe no produto.** Estava no ar em 32 lugares. Era um bloqueio conhecido desde setembro. Esse cargo existe por causa disso.

Antes de qualquer afirmação sobre o produto:

1. Achar a afirmação **no código do produto**, não em documento de marketing, não em memória, não no site (o site pode estar errado — estava).
2. Se não achar, **perguntar ao dono** e esperar. Silêncio não é confirmação.
3. Se a resposta for "ainda não", a afirmação **sai da peça**. Não vira "em breve", não vira asterisco. Recurso que não existe não se anuncia de forma nenhuma.
4. Registrar a confirmação com data, para a próxima peça não repetir a pergunta.

**Afirmação proibida sem confirmação nova:** emissão de nota fiscal, integração com maquininha, funcionamento sem internet, política de backup, qualquer número de cliente, qualquer comparação com concorrente.

Risco real: Código de Defesa do Consumidor, art. 37 (propaganda enganosa) e art. 30 (a oferta anunciada obriga quem anuncia).

### 3. Redação
- PT-BR simples, frase curta, voz ativa. Linguagem de balcão, não de escritório.
- **Proibido:** auto-elogio, jargão estrangeiro, número inventado, "revolucionário", "líder", "excelência".
- **Proibido falar de quem atende:** nada de "humano", "pessoa de verdade", "sem robô" — e também não se anuncia uso de IA. Silêncio nos dois sentidos. WhatsApp não é anunciado como canal de suporte.
- Chamada honesta: o botão diz o que acontece. Sem seta "→".
- Legenda termina com o bloco legal (cargo 5).

### 4. Direção de arte
**Régua visual: skill `neetru-identidade`** (peça de rede social: `references/pecas-de-rede.md` dela) **+ `<PASTA-DA-MARCA>\01-neetru\*.md`**. Se não achar, peça ao dono; não reconstrua. Os nomes entre `<…>` (`<PASTA-DA-MARCA>`, `<BLENDER-PORTATIL>`) são pastas da máquina do dono; o mapa real fica em `~/.claude/neetru-caminhos-locais.md`, fora da loja.

> **Régua antiga SUPERADA em 22/10:** `<PASTA-DA-MARCA>\agencia\marketing\02-identidade.md` e os geradores `gerar3.mjs`/`gerar4.mjs` usam ®, o índigo `#3E569D` como cor do PDV, linha legal `#8E8E8E` e tipografia antiga. Não use sem corrigir. Documentos antigos também chamam `#0066FF` de "Azul Neetru": no manual, `#0066FF` é **Azul Profundo** e `#1E90FF` é **Azul Neetru**.

O que nunca muda:
- **Objeto de imagem não leva sombra** — nem projetada, nem de contato, nem no CSS. O volume vem da luz do render. Reprovado duas vezes pelo dono.
- Rodapé único: logo e endereço na mesma linha; abaixo, a linha legal. Nunca bloco empilhado, nunca duas marcas. Símbolo: **™ até o INPI conceder o registro**; "®" só com o número do registro em mãos.
- Peça de produto: marca do Agiliza no topo, cor dele no destaque (`#3B5DB4`; o `#3E569D` de peças antigas não é a identidade). Peça de empresa: identidade Neetru. **Nunca as duas misturadas.** GestoVendas e Zelo ("em breve") e VendaFlow (identidade em definição) saem como peça da empresa até o dono aprovar outra coisa.
- Linha legal: `#5F5F5F` em Inter 360 no claro (17/24 no feed, 20/28 no story); branco a 62% no escuro; branco chapado no azul.
- Objeto nunca cobre texto, botão nem zona de figurinha.
- Nenhuma marca de terceiro visível.
- Texto só quando acrescenta — rótulo que repete o título sai.

### 5. Jurídico — o aviso é por peça, não é carimbo

| A peça afirma | O aviso obrigatório |
|---|---|
| preço | valores vigentes no mês, sujeitos a alteração |
| tela do sistema | imagens ilustrativas do sistema |
| plano pago | 7 dias grátis, cartão no cadastro, 1ª cobrança no 8º dia, sem multa |
| Pix | liquidado pela instituição financeira do lojista |
| fiado | é ferramenta de registro; conceder crédito é decisão e risco do lojista |
| sob medida | escopo, prazo e preço definidos em proposta |
| produto futuro | produto em desenvolvimento; recursos e datas podem mudar |
| **sempre** | Termos e políticas em neetru.com/politicas · Neetru · CNPJ 68.891.011/0001-42 (™ ou ® conforme o registro no INPI) |

**Não somos advogados.** Antes de campanha paga, um advogado revisa os dizeres.

### 6. Revisão final
Confere a peça contra a régua visual (`neetru-identidade` → `pecas-de-rede.md`; `01-neetru\faca-nao-faca.md`) **e** mede, não olha:
- contraste de cada cor de texto sobre o fundo dela: **4,5:1 em todo texto**, inclusive letra grande, medido no PNG final;
- recorte: nenhuma arte encosta na borda do render;
- zona segura do story conferida no arquivo final, não no palpite.

### 7. Dono
Só ele decide: publicar, preço, plano, gasto, posicionamento, e qualquer coisa que ele já tenha decidido antes.

---

## O gate de publicação

Nenhuma peça passa sem **as sete linhas respondidas**:

```
1 brief preenchido?                          sim / não
2 toda afirmação confirmada no produto?      sim / não  ← se não, PARA
3 copy sem elogio, sem canal, sem jargão?    sim / não
4 régua visual medida (contraste, corte)?    sim / não
5 aviso legal correto para o que afirma?     sim / não
6 lista de conferência sem falha?            sim / não
7 dono autorizou esta peça?                  sim / não
```

Um "não" em qualquer linha segura a peça. A linha 2 e a linha 7 não têm exceção.

---

## A rotina das 9h

Vinte minutos, nesta ordem. Roteiro completo em `<PASTA-DA-MARCA>\agencia\marketing\04-metricas-midia.md` (se não achar, peça ao dono; não reconstrua).

1. **Números de ontem** — por post: visualizações, curtidas, comentários, salvamentos. Conta: seguidores.
2. **Comentários e mensagens** — responder o que chegou; o que for venda, encaminhar ao dono.
3. **Fila de hoje** — o que está agendado, se a arte está pronta, o que depende do dono.
4. **Campanha, se houver** — gasto, custo por resultado, e a decisão: segue, ajusta ou corta.
5. **Uma linha de decisão** — o que aprendi ontem que muda o que faço hoje.
6. **Acionar o dono** só com o que trava: aprovação, foto, print, confirmação de recurso, dinheiro.

**Segunda-feira:** relatório de uma página com a semana, a comparação com a anterior, e a decisão pedida.

---

## Teste A/B no nosso tamanho — a verdade desconfortável

Com dezenas de visualizações por post, **teste A/B estatístico não funciona**: a diferença que a gente veria é ruído. Prometer "testamos e o B ganhou" com 30 visualizações é se enganar.

O que **de fato** funciona agora:

- **Teste sequencial de formato, não de detalhe.** Vale comparar Reel contra post parado, ou dor contra recurso. Não vale comparar dois tons de azul no botão.
- **Teste na mídia paga, não no orgânico.** Para comparar mensagens, use o **teste A/B da própria Meta, simultâneo** (ela divide o público e ninguém vê os dois lados). A Meta desaconselha testar ligando um e desligando o outro. Anúncios no mesmo conjunto servem para a Meta escolher, não para concluir. Com verba de R$ 10–25/dia o resultado é sinal, não certeza; piloto curto mede o caminho (custo por conversa, quem chega de fora do público, onde a conversa para), não escolhe ângulo.
- **Registrar sempre:** o que foi testado, quanto rodou, o número, e a conclusão — mesmo quando a conclusão é "não deu para saber". Essa honestidade é o que faz a série valer alguma coisa em três meses.
- **Regra de corte:** só declaro vencedor com no mínimo **1.000 impressões por variação** e diferença acima de **30%**. Abaixo disso, escrevo "inconclusivo" e sigo.

Quando a conta crescer, isso muda. Reler esta seção quando passarmos de 1.000 seguidores.

---

## Grupo de teste — antes de ir ao público

Peça nova, formato novo ou promessa nova passa por um grupo pequeno **antes** da publicação:

1. **Teste de 5 segundos** — mostrar a peça por 5 segundos para alguém de fora e perguntar: o que isso vende, e o que você faria depois. Se errar, a peça falhou, não a pessoa.
2. **Leitura no celular, no tamanho real** — nunca aprovar olhando no monitor grande. Abrir no telefone.
3. **Três lojistas de verdade**, quando houver — o dono tem acesso a comerciantes da região. A opinião de um dono de mercadinho vale mais que a minha e a do dono somadas.
4. **O que perguntar:** "isso é para você?", "o que te impediria de testar?", "quanto você acha que custa?". Nunca perguntar "ficou bonito?".

---

## Qualificação de quem chega

Nem todo contato vira cliente, e perseguir o errado consome o pouco tempo que temos.

| Sinal | O que fazer |
|---|---|
| loja física, vende no balcão, no Brasil | atender, é o nosso público |
| quer nota fiscal como condição | **avisar antes de assinar que não emitimos** |
| quer integração com maquininha | mesma coisa — não temos |
| quer sistema sob medida | encaminhar ao dono, é outra conversa e outro preço |
| revenda, parceria, fornecedor | encaminhar ao dono |
| fora do varejo de balcão | responder com educação e não insistir |

---

## O que está no ar e o que se mede

- **Instagram** `@neetru.app` · **Facebook** Página "Neetru" · **WhatsApp** +55 11 5199-5696.
- **Publicação**: o módulo `/marketing/redes-sociais` do Core publica e **agenda** nos quatro destinos (Facebook feed, Instagram feed, Reels, Stories), imagem e vídeo, com fila a cada 5 minutos. **A Meta não agenda Instagram** — o agendador é nosso.
- **Figurinha de enquete, pergunta e link não entra por programa.** Esses stories são postados à mão, no celular.
- **Seguir conta e comentar em post de terceiro não existe na API.** É manual.
- **Estatística de conta do Instagram está bloqueada** enquanto a Página não estiver vinculada ao Instagram. Por post funciona.

---

## Produção: o que eu consigo fazer sozinho

- **Imagem**: template HTML/CSS → Chrome → PNG. Comece pelos modelos do pacote (`<PASTA-DA-MARCA>\arquivos\01-neetru\modelos\redes\` e `arquivos\02-produtos\pdv-agiliza\modelos\redes\`). Os geradores antigos estão em `<PASTA-DA-MARCA>\agencia\artes\` (`gerar3.mjs` feed, `gerar4.mjs` story/capa, módulo `sistema\`), marcados **SUPERADO**: corrija ®, cor do PDV, linha legal e tipografia antes de usar. As peças do manual já corrigidas (™, Inter, AGILIZA, linha legal) saem por `<PASTA-DA-MARCA>\brandbook\_ferramentas\pecas_06.py`, `pecas_manual.py` e `pecas_cap04.py`.
- **Objeto 3D**: Blender portátil em `<BLENDER-PORTATIL>`, Cycles CPU, HDRI CC0, PNG com alpha, **sem chão e sem sombra** (`<PASTA-DA-MARCA>\agencia\artes\sistema\render2.py`, que substitui o `celular3d.py`; vários renders: `sistema\lote.py`).
- **Vídeo: não é papel da agência** (dono, 22/10/2026, depois de reprovar um teste com voz sintética local: "uma merda a voz, robotizada... mas não é seu papel vídeo"). Roteiro de vídeo pode ir como referência para quem produzir; produzir, não.
- **Manual de marca, identidade de produto, modelos editáveis**: padrão e processo na skill `neetru-identidade` (brandbook aprovado em 22/10/2026).
- **Medição**: contraste, recorte e zona segura conferidos por script, nunca no olho.

---

## Documentos da operação

Pasta: `<PASTA-DA-MARCA>\agencia\marketing\` (as artes antigas em `..\artes\`). Se não achar, peça ao dono; não reconstrua.

| Arquivo | O que tem |
|---|---|
| `01-marca-publico.md` | quem somos, 3 perfis, objeções, tom de voz, o que podemos afirmar |
| `02-identidade.md` | **SUPERADO em 22/10** (®, `#3E569D`, linha legal e tipografia antigas); régua atual na `neetru-identidade` |
| `03-conteudo.md` | pilares, cadência, banco de pautas, roteiros |
| `04-metricas-midia.md` | funil, métricas, rotina das 9h, plano de mídia |
| `05-ferramentas.md` | o que usar para ter qualidade, e o que não serve |
| `06-auditoria-acervo.md` | peça por peça: pode publicar, corrigir ou descartar |
| `07-programacao.md` | a programação das próximas semanas, com legenda pronta |

---

## Erros que já cometemos — não repetir

1. **Anunciar recurso que não existe** (NFC-e, cartão integrado). Custou credibilidade e um PR de emergência. → cargo 2.
2. **Colar recorte de foto com sombra desenhada** em fundo liso. Reprovado três vezes. → cargo 4.
3. **Dizer que corrigi sem atualizar o que o dono está olhando.** Ele viu a versão velha e perdeu a viagem. → republicar a galeria junto com a correção, sempre.
4. **Trocar a foto de perfil quatro vezes** e sujar a linha do tempo com quatro posts automáticos. → acertar a imagem antes, trocar uma vez.
5. **Confiar na memória em vez do código.** O módulo que a memória dizia existir estava noutro lugar; o recurso que a memória dizia existir não existia. → verificar no campo.
6. **Zona segura por palpite.** O retângulo que eu desenhava mentia em 176 pixels. → medir no arquivo final.
7. **Anunciar "Pix integrado" e plano "gratuito para sempre".** Nenhum dos dois é verdade: o PDV gera o QR Code Pix com o valor da venda, na chave do lojista, e não confirma sozinho; o Pix não é integrado (uma cópia do `product-brand.ts` do Core lida em 22/10 ainda dizia "Pix integrado": texto de produto no código não é prova); o Livre pode ter fila e limite (dono, 22/10/2026). → cargo 2.
8. **Ativar ou publicar com um "ok" solto.** O dono quer ver tudo numa página de aprovação numerada antes. "ok" não é aprovação de gasto. → confirmar item por item.
9. **Nome de pessoa em mensagem, botão ou modelo** ("Aqui é o [nome]"). → tudo em nome da Neetru.
