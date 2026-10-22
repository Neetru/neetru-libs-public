---
name: neetru-identidade
description: Use ao criar, produzir ou revisar material de MARCA da Neetru ou de um produto dela (PDV Agiliza, GestoVendas, Zelo, VendaFlow, PayView) — manual da marca/brandbook, kit ou pasta de arquivos da marca, logo (SVG/PDF/PNG), paleta e .ase, tipografia, identidade visual de produto novo, apresentação, papelaria, cartão de visita, modelos editáveis (PowerPoint/Word), imagem de link, avatar, ícones, ou a régua visual de uma peça de rede social. Traz o sistema do manual edição 1 (aprovado pelo dono em 22/10/2026) e o padrão de entrega de agência. Leia ANTES de desenhar. NÃO use para tela, componente, CSS ou PR de interface de produto (isso é neetru-ui-guidelines + DESIGN.md do produto). O processo de cada peça (brief, verificação de fato, aviso legal, aprovação do dono) é a neetru-agencia.
---

# neetru-identidade — o padrão visual e de entrega que o dono aprovou

> **A pergunta antes de mostrar qualquer coisa ao dono:** *"eu teria orgulho de apresentar isto a quem pagou R$ 50 mil por uma agência?"* Se a resposta for "quase", não mostre ainda.

Régua visual da `neetru-agencia` (cargo 4, Direção de arte): a agência diz **por onde** a peça passa; esta, **como ela se parece** e **o que se entrega**.

## O que o dono reprovou e o que ele aprovou (22/10/2026)

| Reprovado | Aprovado |
|---|---|
| "Kit da marca" que era **inventário técnico**: caminho de arquivo, commit, "origem:", "divergência", cartões iguais em grade, sem capa, sem narrativa, sem aplicações. ("É assim que uma agência de R$ 50 mil entrega?") | **Brandbook** de 86 páginas 16:9, conceito "Suíço preciso": capa, sumário, essência, logo com construção desenhada, cores e tipografia grandes, voz, imagem, aplicações em maquete, produtos, legal. ("Ficou maravilhoso. É disso que eu tô falando.") |
| Kit **sem pasta de editáveis**. ("Eu teria vergonha de apresentar... sem uma pasta com os editáveis, SVG.") | **Pasta de editáveis** com índice visual: logo em curvas em SVG, PDF vetorial, PNG e JPG; .ase; tokens; fontes; ícones; modelos PowerPoint/Word/PDF; zip. |
| Vídeo com voz sintética. | Vídeo **não** é entrega da agência. |

## Fontes da verdade

Tudo mora na `<PASTA-DA-MARCA>`, na máquina do dono. Os nomes entre `<…>` são pastas da máquina; o mapa real fica em `~/.claude/neetru-caminhos-locais.md`, fora da loja. **Se não achar um arquivo, peça ao dono; não reconstrua de memória.**

1. **Regras, texto e arquivos:** o brandbook edição 1 (`Neetru-Brandbook-2026.pdf`, `brandbook\_sistema.md`), a pasta de editáveis (`arquivos\`) e as réguas de `01-neetru\*.md`. A fonte **mais nova** é `_notas-tecnicas\revisao-22-10-tarde.md`; onde ela contradiz `_sistema.md` ou nota de capítulo, vale ela.
2. **Hex e forma de cada produto:** o código do Core, `src/lib/catalog/product-brand.ts`. O arquivo não está na árvore local do Core (branch antiga); leia com `git -C <repo-do-core> show origin/main:src/lib/catalog/product-brand.ts`. `origin/main` é o mesclado, não necessariamente o que está no ar.
   - **O código vence** em valores de identidade (hex, canto, desenho do símbolo).
   - **O código não vence** em texto de produto. A cópia de `product-brand.ts` lida em 22/10 (num worktree; confira em `origin/main`) trazia "Pix integrado, sem maquininha separada." e "Pix na conta". Essas frases são **afirmação vetada pelo dono**: o PDV gera o QR do Pix com o valor da venda, na chave do lojista. Não é integrado.
   - **O código não vence** em arquivo de logo. O `logo.tsx` desenha a palavra maior (≈ 4,0X), e `public/brand/*.svg` traz a palavra em texto vivo. Use `arquivos\01-neetru\logo\`.
3. **Manual original:** `docs/sistema/marca/_brand/NEETRU_BRAND_SYSTEM.pdf` no Core (cópia em `01-neetru\referencia\`) e `BRAND.md`. Serve só de referência. Os rótulos "2,37X/3,37X" do PDF não batem com o próprio desenho; vale 3,14X.

**Nunca invente identidade.** Produto sem identidade aprovada usa a moldura Neetru; criar uma exige propostas, júri e aprovação do dono.

## O sistema visual em uma página

Detalhe em `references/sistema-visual.md` (livro e apresentação) e `references/pecas-de-rede.md` (feed, story, capa de Reel, imagem de link).

- **Grade do livro** (página 1920×1080): margem 120, 12 colunas de 118, calha 24. Texto nas colunas 1–4, palco nas 5–12. **Uma ideia por página.**
- **Letra:**
  - no livro e em documentos, Inter 800 no título e 300 no corpo;
  - em peça de rede social, manchete em Fraunces 700 com `opsz 32`; apoio, preço e letra miúda em Inter (ver `pecas-de-rede.md`).
- **Cores canônicas:**
  - Azul Neetru `#1E90FF`: elemento gráfico. **Nunca é texto sobre claro** (3,24:1).
  - Azul Profundo `#0066FF`: texto, botão e link sobre claro; fundo das aberturas.
  - Preto Carvão `#07090D`: palavra do logo, capa, contracapa.
  - Tinta `#0A0A0A` · Corpo `#3C3C3C` · Apoio `#6B6B6B` · Fio `#E6E6E6` · Branco.
  - Linha legal `#5F5F5F` no claro.
- **Logo:** chama de altura X; assinatura com **3,14X** de largura; vão 0,24X; área de proteção **0,25X**. Mínimo de **24 px** de altura em tela e **14 mm** impresso; chama sozinha ≥ 8 mm. Sobre `#0066FF`, logo todo branco. Na tela, use a chama do site (PNG).
- **Produtos** (tabela completa em `sistema-visual.md` §6):
  - PDV Agiliza `#3B5DB4`. O índigo `#3E569D` de peças antigas **não** é a identidade.
  - GestoVendas `#3C71DD`, com destaque `#7055F6`.
  - Zelo `#0F766E`. A assinatura é o escudo com pulso em **traço `#0D9488`**, sem quadrado, com canto reto.
  - **VendaFlow:** em definição. Até o dono aprovar, peça de VendaFlow é peça da empresa (moldura Neetru).
  - **PayView:** usa a marca Neetru.
  - Rodapé de peça de produto: logo Neetru, endereço do produto e linha legal. "Um produto Neetru" só entra na imagem de link.
- **Proibido no livro e nas peças da Neetru:**
  - sombra;
  - degradê fora da chama e das imagens de link;
  - cartão com borda e sombra;
  - rótulo em caixa-alta;
  - emoji;
  - canto arredondado fora de ícone e aparelho;
  - texto abaixo de 4,5:1, inclusive letra grande.

  **Exceções do site:** rótulo e botão em caixa-alta, e o canto do produto (PDV 1rem, GestoVendas 0,75rem) só dentro do bloco do produto.
- **Símbolo legal:** **™** até o registro no INPI ser **concedido**; ® só com o número do registro em mãos.

## O padrão de entrega de agência

Detalhe e árvore de pastas em `references/padrao-de-entrega.md`. Toda entrega de marca tem quatro partes:

1. **Peça de apresentação:** brandbook ou caderno em **PDF 16:9**, mais a versão web num HTML só, que abre offline.
2. **Pasta de editáveis** com **índice visual**: logo **em curvas** (SVG, PDF vetorial, PNG, JPG), `.ase`, tokens, paleta em PDF, fontes com licença, ícones (o do iPhone **quadrado e opaco**), modelos Office e zip.
3. **Notas técnicas separadas**, que nunca aparecem na peça do cliente.
4. **Página de aprovação** para o dono: decisões numeradas, com a recomendação marcada. Nada vira oficial sem o OK dele.

## Reaproveite antes de escrever

As ferramentas que fizeram o livro e o pacote já existem (cada script listado em `references/receitas-tecnicas.md`):
- `brandbook\brandbook.css` e `brandbook\_ferramentas\` (página, logo com cotas, render, conferência, montagem, HTML único);
- a vitrine `brandbook\capitulos\_tipos-de-pagina.html`;
- `_notas-tecnicas\ferramentas-do-pacote\` (logo em curvas e PDF vetorial, cores e `.ase`, modelos Office);
- modelos de rede prontos em `arquivos\01-neetru\modelos\redes\` e `arquivos\02-produtos\pdv-agiliza\modelos\redes\`.

## O processo que produziu o livro aprovado

Detalhe em `references/processo-de-equipes.md`. Equipes que **discordam** e um júri: conceito (3 diretores, 3 direções) → júri → base (sistema e roteiro, só das fontes) → capítulos (produzir → crítico exigente → corrigir) → montagem → revisão final (fidelidade e "cliente que pagou R$ 50 mil") → ajuste final → **o seu crivo** (abra as páginas em tamanho de leitura). Com várias equipes autorizadas pelo dono, rode como Workflow; se bater no limite de uso, anote o reset e retome.

## Pendências do dono: não tratar como decidido

Fonte: `_notas-tecnicas\revisao-22-10-tarde.md` §4.

1. Missão e visão sem auto-elogio (o livro mostra o literal, com "excelência", que não vai para peça pública).
2. Um conjunto de valores ou dois (cinco valores e quatro pilares).
3. VendaFlow "sob medida" × "a Neetru não vende horas".
4. Assinatura nova do PDV Agiliza (a publicada fala de Pix).
5. Aprovação formal do que a edição 1 cobre (logo preto, avatar, carrossel, cartão horizontal, chama de fundo, versões de uma cor, ícones dos produtos). O dono elogiou o livro; a revisão ainda lista isto como pendente.
6. Zelo e versão vertical do logo.
7. Contato responsável pela marca na contracapa.
8. Frases citadas literais (p. 12 e p. 36).
9. Sentido do valor 4 ("processos industriais").

## Erros que já cometemos — não repetir

1. **Entregar inventário em vez de livro**, com caminho de arquivo e "divergência" na peça do cliente. → Notas técnicas ficam à parte.
2. **Logo com palavra em texto vivo** no SVG: sem a Inter instalada, vira outra letra. → Sempre em curvas.
3. **Pasta de arquivos esquecida.** → Brandbook e editáveis saem juntos.
4. **"®" sem registro concedido.** → ™ até o INPI conceder.
5. **Tirar um produto da entrega** sem o dono pedir: o Zelo saiu "em validação" e o dono cobrou. → Se existe identidade no Core, ele entra.
6. **Afirmar recurso que o produto não tem:** nota fiscal, maquininha, "Pix integrado". → Verificação de fato da `neetru-agencia`, sempre.
7. **Seguir a régua antiga** (`agencia\marketing\02-identidade.md` e geradores: ®, `#3E569D`, linha legal reprovada; marcados SUPERADOS). → Esta skill e `01-neetru\*.md`.

Cuidados com a máquina (`convert`, configuração global, Chrome, disco): `references/receitas-tecnicas.md`.
