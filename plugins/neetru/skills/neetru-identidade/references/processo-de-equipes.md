# Processo de equipes — como o livro aprovado foi feito

O que deu a qualidade não foi um agente bom; foi **gente que discorda e um júri**. Cada etapa tem o direito de recusar a anterior. Use este processo para qualquer entrega de marca grande (brandbook, identidade de produto novo, caderno de campanha). Para peça única de rede social, basta a `neetru-agencia`.

## Etapas
| # | Etapa | Quem | Entrega | Recusa quando |
|---|---|---|---|---|
| 1 | Conceito | 3 diretores de arte, direções diferentes (ex.: Suíço preciso · Editorial de revista · Técnico premium) | 4 páginas renderizadas cada (capa, abertura, logo com construção, cores) + defesa de 6 linhas | — |
| 2 | Júri | diretores de criação | vencedor, nota de cada um, enxertos dos outros, correções no vencedor | parece documentação, template ou "feito por IA"; infiel à marca |
| 3 | Base | diretor de arte do vencedor + redator-chefe, em paralelo | CSS e guia do sistema (`_sistema.md`) · roteiro de conteúdo (`_conteudo.md`), só das fontes | — |
| 4 | Capítulos | uma equipe por capítulo, em pipeline | páginas renderizadas → **crítico exigente** → correções | texto estourando, contraste, dado interno vazando, cara de genérico |
| 5 | Montagem | produtor gráfico | PDF 16:9, web, folha de contato, notas técnicas à parte | numeração, sumário e remissões erradas |
| 6 | Revisão final | **revisor de fidelidade** + **cliente que pagou R$ 50 mil** | nota 0–10 e problemas | qualquer hex, medida ou texto sem fonte; o que pareça amador |
| 7 | Ajuste final | diretor da agência | correções + nota de saída + pendências do dono | — |
| 8 | Seu crivo | você | abrir 4+ páginas em tamanho de leitura | "eu não teria orgulho de mostrar" |
| 9 | Dono | — | aprovação | é dele |

Nota do caso real: as duas críticas de agência deram 7 e 6 antes do ajuste (`_notas-tecnicas\revisao-22-10-tarde.md`); depois do ajuste, o dono aprovou com entusiasmo. **O ajuste depois da revisão dura é onde a qualidade sobe.**

## Bloco de regras que vai em TODO prompt de agente
Copie e adapte:
```
FONTES DA VERDADE: hex e forma de produto = código do Core (git show origin/main:src/lib/catalog/product-brand.ts);
regras, texto e arquivos = brandbook edição 1 (<PASTA-DA-MARCA>\) + _notas-tecnicas\revisao-22-10-tarde.md;
PDF original só como referência. Texto de produto do código NÃO vale ("Pix integrado" é vetado). Não invente
identidade; o que faltar vira lacuna nas notas técnicas. Se um arquivo não estiver na máquina, pare e peça.
PEÇA DO CLIENTE: sem caminho de arquivo, commit, "origem", "divergência", "lacuna", JSON ou termo de dev.
MARCA: no livro, Inter (800 título / 300 corpo); em peça de rede social, manchete Fraunces 700 opsz 32 e o resto
em Inter; cores canônicas; sem sombra, sem degradê decorativo, sem rótulo em caixa-alta, sem emoji;
contraste ≥ 4,5:1 em todo texto; ™ até o INPI conceder o ®; PT-BR impecável, sem auto-elogio.
PRODUTO: só recurso confirmado pelo dono (PDV não emite nota fiscal; o Pix não é integrado: o PDV gera o QR com o
valor da venda na chave do lojista; plano Livre não é "para sempre").
MÁQUINA: nunca altere variável de ambiente permanente nem configuração global (.npmrc do usuário, pip.ini,
git global); nunca rode "convert" (no Windows formata disco); Chrome sempre com --headless=new e
--user-data-dir numa pasta temporária sua; um Chrome pesado por vez; tudo no disco de trabalho.
CONFERÊNCIA: abra (Read) os PNGs que gerar antes de entregar.
```

## Esqueleto de Workflow (quando o dono autorizou várias equipes)
**Pseudocódigo.** `DIRECOES`, `REGRAS`, `CAPITULOS`, `VOTO` e `CRITICA` não estão definidos aqui, e a API
(`parallel`, `pipeline`, `agent`, opções, retomada) deve ser conferida na skill `workflow-authoring` antes de
escrever o script de verdade.
```js
// PSEUDOCÓDIGO: mostra a forma do processo, não roda como está
export const meta = { name: 'brandbook-x', description: '...', phases: [
  {title:'Conceito'},{title:'Júri'},{title:'Base'},{title:'Capítulos'},
  {title:'Montagem'},{title:'Revisão final'},{title:'Ajuste final'}] }
const conceitos = await parallel(DIRECOES.map(d => () => agent(`...${d}...${REGRAS}`, {phase:'Conceito'})))
const juri = await agent(`abra as pranchas, escolha...`, {phase:'Júri', schema: VOTO})
const [sistema, conteudo] = await parallel([() => agent('sistema visual...'), () => agent('roteiro...')])
const caps = await pipeline(CAPITULOS,
  c => agent(`produza o capítulo ${c.n}...`, {phase:'Capítulos'}),
  (r, c) => agent(`crítico exigente do capítulo ${c.n}...`, {phase:'Capítulos', schema: CRITICA}),
  (crit, c) => agent(`aplique as correções ${JSON.stringify(crit.problemas)}...`, {phase:'Capítulos'}))
const montagem = await agent('monte PDF, web, folha de contato...', {phase:'Montagem'})
const revisoes = await parallel([() => agent('revisor de fidelidade...', {schema: CRITICA}),
                                 () => agent('cliente que pagou R$ 50 mil...', {schema: CRITICA})])
const ajuste = await agent(`aplique ${JSON.stringify(revisoes)}...`, {phase:'Ajuste final'})
```
Use `pipeline` nos capítulos (sem barreira). Um processo desse tamanho consome muito de subagentes e pode bater no limite de uso da sessão. Se bater, anote a hora do reset, retome pelo mecanismo de retomada do Workflow (`resumeFromRunId`; confira o nome na skill `workflow-authoring`) e avise o dono do atraso.

## Identidade de produto novo (modelo; caso VendaFlow em andamento em 22/10)
O VendaFlow está **em definição**: há uma rodada de 3 propostas em produção e nada foi aprovado. Até o dono
aprovar, peça de VendaFlow é peça da empresa (moldura Neetru). O roteiro abaixo é o modelo do processo:
- 3 designers, 3 direções de símbolo, cada um com uma prancha 1920×1080: assinatura no claro e no escuro, ícone de app, paleta com contraste, e duas aplicações reais (topo de WhatsApp 1200×628 e um post 1080×1350 com texto do produto).
- Júri com critérios: diferente de verdade das outras marcas, símbolo que diz o que o produto faz sem clichê, legível em 16 px, convive com a Neetru.
- Produção do pacote completo da recomendada, marcada "aguardando aprovação do dono", e página `APROVAR-<produto>.html` com as 3 lado a lado. O dono escolhe.
- Entregar ao Dev Core o objeto pronto para `PRODUCT_BRANDS` (sem mexer no repositório) para o site passar a usar.
