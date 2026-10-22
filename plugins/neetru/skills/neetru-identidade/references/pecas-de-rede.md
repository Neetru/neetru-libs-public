# Peça de rede social: a régua visual

Resumo de seis arquivos de `<PASTA-DA-MARCA>\01-neetru\`: `tipografia.md`, `zonas-seguras.md`,
`imagem.md`, `avisos-legais.md`, `faca-nao-faca.md` e `paleta.md`. Cada um traz a origem de cada valor;
na dúvida, abra o arquivo. Se a pasta não estiver na máquina, peça ao dono. Não reconstrua de memória.

O processo da peça (brief, verificação de fato, aviso legal, aprovação do dono) é da `neetru-agencia`.
Esta página cobre só a aparência.

**Comece pelos modelos prontos**, que já trazem grade, rodapé e linha legal:
- Neetru: `<PASTA-DA-MARCA>\arquivos\01-neetru\modelos\redes\` (post, story e carrossel `.pptx`).
- PDV Agiliza: `<PASTA-DA-MARCA>\arquivos\02-produtos\pdv-agiliza\modelos\redes\` (post com 4 fundos, story com 3).

## O que mudou depois desses seis arquivos

Fontes: `_notas-tecnicas\revisao-22-10-tarde.md`, `brandbook\_sistema.md` §1 e o LEIA-ME do PDV no pacote.
- O `avisos-legais.md` ainda manda **®**. Vale **™** ("Neetru™ · CNPJ …") até o INPI conceder o registro.
- O fundo `carvao` (`#121316`) se chama **Grafite escuro** no livro. Não confunda com o Preto Carvão
  `#07090D` do logo.
- Os fundos `indigo` (`#3E569D`) e `indigoClaro` (`#EDF1FA`) do módulo de artes **não** são a identidade do
  PDV Agiliza. A identidade é `#3B5DB4`, com fundo suave `#F0F4F8`. O próprio `paleta.md` registra a
  divergência (D8). Para peça do PDV, parta dos modelos do pacote.

## Formatos e grade (`zonas-seguras.md`)

- **Grade comum:** margem 84 · 12 colunas de 54 · calha 24 · módulo 78 · largura útil 912 · base 6. A
  margem é 84 porque a grade do perfil recorta o feed em 3:4 e come 34 px de cada lado.
- **Feed 1080 × 1350:**
  - caixa de conteúdo de 912 × 1080 (y 84 a 1164);
  - embaixo, o rodapé com logo Neetru e endereço, e a linha legal (até 640 px de largura).
- **Story 1080 × 1920:**
  - o app cobre cerca de 250 px em cima e embaixo;
  - o conteúdo vai de y 252 a 1404;
  - a zona da figurinha nativa (cerca de y 1150 a 1400) fica livre quando a peça pede resposta;
  - logo de 44 px em y 1424 a 1468;
  - linha legal em y 1558 a 1587, até 740 px.
- **Capa de Reel 1080 × 1920** (a mais apertada):
  - janela útil de y 420 a 1248;
  - o texto termina em x 650, porque os 430 px da direita são dos botões do app;
  - o objeto vai entre x 650 e 870;
  - na grade do perfil, a capa aparece recortada em 1:1 (y 420 a 1500);
  - a escala de letra desce um grau.
  - **Confira no PNG:** a caixa de tinta precisa de `420 ≤ y0` e `y1 ≤ 1250`.
- **Imagem de link 1200 × 630:** margem 80, logo no topo, título e apoio embaixo, rodapé com fio de 1 px.
- **Topo de modelo do WhatsApp 1200 × 628:**
  - margem 72;
  - logo a 64 do topo, com 56 de altura;
  - título a 176 do topo, em 74 px;
  - apoio ancorado a 72 da base, em 32 px.

## Letra (`tipografia.md`)

"A Fraunces fala. A Inter mede." A manchete é Fraunces; apoio, preço, dado e letra miúda são Inter.

Medidas em corpo / entrelinha, em px:

| Papel | Face | Feed | Story | Capa de Reel |
|---|---|---|---|---|
| Manchete grau 1 (até 18 / 15 / 15 caracteres) | Fraunces 700 · `opsz 32` · −0,02em | 104 / 106 | 128 / 123 | 80 / 80 |
| Manchete grau 2 (até 34 / 28 / 27) | idem | 88 / 92 | 108 / 112 | 72 / 72 |
| Manchete grau 3 (até 49 / 41 / 38) | idem | 76 / 80 | 92 / 96 | 64 / 64 |
| Apoio | Inter 340 · `opsz 22–24` | 40 / 56 | 46 / 64 | 36 / 48 |
| Dado / preço | Inter 800 tabular · `opsz 32` · −0,03em | 68 / 72 | 80 / 88 | 56 / 64 |
| Rótulo de dado | Inter 650 · caixa-alta · +0,16em | 18 / 24 | 20 / 24 | 17 / 24 |
| Letra miúda | Inter 360 · `opsz 14` · +0,005em | 17 / 24 | 20 / 28 | 19 / 28 |

- O grau da manchete sai do **número de caracteres**. Passou do grau 3: **reescreva a frase**, não encolha
  a letra.
- No feed e no story vale o corpo publicado (D25). Na capa de Reel vale o `tipografia.mjs`.
- Use `opsz 32` na Fraunces: com `opsz 144`, a haste fina cai para 1 px e quebra na recompressão.
- Use os pesos 340 e 360 porque Inter 300 a 17 px some na recompressão do Instagram.
- **Proibido:**
  - manchete em caixa-alta;
  - rótulo em caixa-alta **acima** da manchete;
  - Fraunces abaixo de 52 px, em número, letra miúda, botão ou rótulo;
  - mais de um grau de manchete na peça;
  - letra miúda abaixo de 17 px no feed ou 19 px no story;
  - `text-wrap: balance` fora da manchete;
  - medir texto antes de `document.fonts.ready`.

## Cor e fundo (`paleta.md`)

- **Família de fundos:**
  - `neve` `#FFFFFF`, `linho` `#F7F8FA`, `papel` `#F4F1EA`, `cal` `#E7EAEF` e `argila` `#E7E0D6`, para
    qualquer série;
  - `grafite` `#2A2C30`, `carvao` `#121316` (Grafite escuro) e `tinta` `#0A0A0A`, para qualquer série;
  - `azul` `#0066FF` e `azulClaro` `#EAF3FF`, **só em peça da empresa**.

  Cada série tem **um** fundo fixo; o arquétipo varia.
- **Texto nos fundos claros:** título `#0A0A0A`, apoio `#3C3C3C` e linha legal `#5F5F5F` (de 4,87:1 no
  `argila` a 6,39:1 no branco).
- **Texto nos fundos escuros:** título branco e linha legal em branco a 62%.
- **No azul `#0066FF`:** só branco chapado, que dá 4,83:1, ou 4,72:1 depois do acabamento. Qualquer
  transparência reprova.
- **Contraste:** 4,5:1 em todo texto, medido **no PNG final, depois do acabamento**. Não escolha a cor por
  hex fixo nem a olho. O `#6F6F6F` antigo reprova em papel, cal e argila.
- **Degradê:** nunca no fundo de peça de rede social, porque o Instagram listra. Para dar matéria, use
  **degrau tonal**: dois chapados com 3 a 5% de diferença, encontrando-se numa linha da grade.
- Superfície pública é sempre clara. Bloco de cor escuro é permitido; modo escuro, não.

## Imagem (`imagem.md`)

- **Direção aprovada:** layout limpo (v1) e **um** objeto real recortado. A v2 foi rejeitada: tinha foto em
  meia peça, texto sobre degradê, cartões arredondados e "um produto Neetru" no rodapé.
- **Sem sombra nenhuma:** nem projetada, nem de contato, nem halo. O volume vem da luz. O `semSombra()` do
  módulo lança erro.
- **O objeto nunca cobre** texto, botão nem a zona da figurinha. Texto nunca vai sobre foto.
- **Objeto que some no fundo é defeito:** no máximo 35% do objeto abaixo de 1,6:1 (`objetoLegivel()`).
- **Recorte:**
  - foto de licença livre (Unsplash+ não);
  - fundo removido com `rembg`;
  - marca de terceiro apagada.
- **O canto superior esquerdo é sempre o fundo-mãe.** Nenhum campo começa em (0,0).
- **Preço sem tabela:** um número, um fundo e uma linha legal.
- **Figurinha:** é nativa do Instagram. Deixe o espaço livre e nunca desenhe uma falsa.
- **Setas:** sem "→" no botão.
- **Aviso `tela`:** só quando a peça mostra tela, e tela de recurso vetado não entra.

## Rodapé e linha legal (`avisos-legais.md`)

- **Rodapé:** um campo só, na cor-mãe da peça. Em cima, `[logo Neetru ™] ···· [endereço]`; embaixo, a
  linha legal.
- **Endereço:** sai da identidade da peça. Com o lockup do produto, `pdvagiliza.neetru.com`; sem lockup,
  `neetru.com`.
- **Segunda marca:** nenhuma no rodapé. "Um produto Neetru" no rodapé foi rejeitado.
- **Avisos:** toda peça leva o `base`. Os outros entram conforme o que a peça **mostra ou afirma**:
  `preco`, `pago`, `tela`, `pix`, `cartao`, `fiado`, `medida` e `futuro`. Aviso que sobra também é
  afirmação. Os textos estão na tabela do arquivo.
- **Fecho:** a linha termina com a identificação curta (`Neetru™ · CNPJ 68.891.011/0001-42`) ou longa.

## Produto e marca mãe (`faca-nao-faca.md`)

- O lockup do produto vai só em peça do produto, no topo; o logo Neetru fica no rodapé. Nunca os dois lado a
  lado nem na mesma hierarquia.
- O fundo do produto aparece só com o lockup do produto. O lockup do produto nunca vai sobre o azul da
  Neetru.
- Produto sem identidade definida usa a moldura neutra da Neetru. Não invente cor nem logo.
- **Texto:**
  - nada de `core.neetru.com`;
  - nada de "atendimento humano" nem IA anunciada;
  - nada de NFC-e, TEF nem plano Pro ou Rede como disponível;
  - "grátis" de plano pago só com o cartão dito.
