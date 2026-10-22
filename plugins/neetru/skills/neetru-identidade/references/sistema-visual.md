# Sistema visual — brandbook "Suíço preciso" (edição 1, out/2026)

Fontes: `<PASTA-DA-MARCA>\brandbook\_sistema.md` e `brandbook.css`. A fonte mais nova do livro é
`<PASTA-DA-MARCA>\_notas-tecnicas\revisao-22-10-tarde.md`; onde ela contradiz o `_sistema.md` ou
uma nota de capítulo, vale ela. Este resumo vale para peça de apresentação da Neetru (livro de marca,
caderno de produto, proposta comercial, relatório para o dono). Peça de rede social tem régua própria:
`pecas-de-rede.md`. Se a pasta não estiver na máquina, peça ao dono; não reconstrua.

## 1. Página e grade
- Página **1920 × 1080 px**, uma ideia por página.
- Margem **120 px**, **12 colunas de 118 px**, calha **24 px**. Início das colunas: 120 · 262 · 404 · 546 · 688 · 830 · 972 · 1114 · 1256 · 1398 · 1540 · 1682.
- Conteúdo de y 216 a y 984; cabeçalho corrido em y 96 (marca · capítulo · seção · página).
- Divisão padrão: **texto nas colunas 1–4, palco nas 5–12**. Quem foge disso precisa de motivo (página de frase, lista ou abertura).
- Título com no máximo duas linhas nas colunas 1–4 (80 px; se não couber, 64 px).
- Número e unidade não se separam: `24&nbsp;px`, `14&nbsp;mm`.
- O texto não repete o que o desenho mostra: numa página de desenho técnico, as medidas ficam nas cotas e o texto diz a regra.

## 2. Escala tipográfica do livro (Inter)
Fraunces só no espécime dela e dentro de peça de rede social reproduzida; a escala das peças está em `pecas-de-rede.md`.

| Uso | Corpo / entrelinha | Peso |
|---|---|---|
| Título da capa | 268 / 240 | 800 |
| Número do capítulo (abertura) | 600 / 600 | 800 |
| Nome do capítulo (abertura) | 160 / 160 | 800 |
| Palavras enormes (personalidade) | 140 / 136 | 800 |
| Título da página | 80 / 80 (ou 64 / 66) | 800 |
| Frase de destaque | 72 / 82 · 60 / 70 | 800 |
| Dado grande (HEX, medida) | 60 / 60 | 800 |
| Frase de abertura | 32 / 44 | 300 |
| Citação | 36 / 50 | 300 |
| Texto corrido | 24 / 36 | 300 |
| Regra (uma frase, fio em cima) | 24 / 34 | 650 |
| Número da seção ("2.3") | 24 / 32 | 700 |
| Explicação curta | 20 / 30 | 300 |
| Rótulo (frase normal, nunca caixa-alta) | 20 / 28 | 700 |
| Legenda, nota | 18 / 26 | 400 |
| Cabeçalho corrido | 16 / 24 | 500 |

## 3. Contextos de cor da página
A classe da página define o fundo e todas as cores de texto. Não escreva cor de texto à mão.

| Página | Fundo | Título | Corpo | Apoio | Destaque | Uso |
|---|---|---|---|---|---|---|
| padrão | Branco | `#0A0A0A` 19,80:1 | `#3C3C3C` 11,03:1 | `#6B6B6B` 5,33:1 | `#0066FF` 4,83:1 | conteúdo |
| suave | `#FAFAFA` | idem | 10,57:1 | 5,11:1 | 4,63:1 | página de pausa |
| fria | `#F5F7FA` | idem | idem | 4,97:1 | 4,50:1 | palco das aplicações |
| azul | `#0066FF` | branco 4,83:1 | branco | branco | branco | aberturas de capítulo; só branco chapado, sem transparência |
| carvão | `#07090D` | branco 19,93:1 | `#C9CBD0` | `#A3A7AE` | `#1E90FF` 6,16:1 | capa (com imagem-chave: a chama grande cortada pela borda), contracapa, abertura "A Neetru" |

## 4. Paleta canônica (tokens em `arquivos\01-neetru\cores\tokens.json`)
- **Marca:** Azul Neetru `#1E90FF` (elemento gráfico, chama) · Azul Profundo `#0066FF` (texto/botão/link sobre claro) · Preto Carvão `#07090D`.
- **Só em degradê:** `#168BFF` (início do degradê da chama) e `#0B1220` (fim do degradê da imagem de link, `#07090D → #0B1220`). O nome "Ink 900" saiu do livro.
- **Neutros:** Tinta `#0A0A0A` · Corpo `#3C3C3C` · Apoio `#6B6B6B` · Fio `#E6E6E6` (não é cor de texto) · Fundo suave `#FAFAFA` · Branco · Slate 100 `#F5F7FA` · Slate 200 `#E5EAF0`.
- **Semânticas (calibradas para AA):** Sucesso `#0A7153` · Atenção `#A14C02` · Erro `#C21E1E` · Informação `#0B5CE0`.
- **Letra miúda das peças:** `#5F5F5F` no claro · branco a 62% no escuro · branco chapado no azul.
- **Impressão:** CMYK sempre "aproximado, validar com a gráfica (prova)"; nada de Pantone inventado. Preto Carvão em texto pequeno impresso: **só K** (0 · 0 · 0 · 100); o composto é para área grande (`_sistema.md` §6.7).
- **Degradês que existem** (fora deles, degradê é proibido): a chama; o fundo da imagem de link da Neetru (`#07090D → #0B1220`); o fundo da imagem de link do PDV Agiliza (`#0F1729 → #3B5DB4`, 135°, só nela).

## 5. Logo
- Cotas do livro, com **X = altura da chama**: chama **0,69X** de largura · vão **0,24X** · palavra **2,21X** · largura total **3,14X** · maiúsculas **0,51X**. Na vertical: **0,19X** do topo da chama ao topo das maiúsculas e **0,30X** da linha de base à base da chama.
- **Aviso:** o PDF original rotula "2,37X" e "3,37X". Esses rótulos não batem com o próprio desenho do PDF. Não "corrija" para 3,37: vale 3,14.
- Área de proteção **0,25X** em volta (já vem dentro de todos os arquivos do pacote).
- Mínimo: logo horizontal **24 px** de altura em tela (32–40 px em barra), chama sozinha 12 px (16 px no escuro); impresso, logo **14 mm** e chama **8 mm**. Abaixo disso, só a chama.
- **Na tela de site e app, use a chama do site** (`arquivos\01-neetru\logo\simbolo-site\`, PNG). O SVG em degradê é para vetor grande e impresso.
- Fundo claro → versão colorida. Fundo azul `#0066FF` → toda branca. Fundo escuro → branca ou chama azul com palavra branca. Foto/textura → evitar; se não houver saída, placa de cor chapada atrás.
- Não faça: esticar, girar, trocar o azul, reescrever "Neetru" em outra letra, brilho/sombra/desfoque/contorno, colar na borda.
- Arquivo de logo: sempre o do pacote (`arquivos\01-neetru\logo\`, palavra em curvas). O `logo.tsx` do site desenha a palavra maior (≈ 4,0X) para caber em barra de navegação, e os SVG de `public/brand/` têm a palavra em texto vivo (no Windows sai em Segoe UI). **A proporção da marca é 3,14X.**

## 6. Produtos ("Um produto Neetru")
Valores de `src/lib/catalog/product-brand.ts` (código vence em hex e forma) conferidos com o pacote `arquivos\02-produtos\<produto>\`.

| Produto | Primária | Destaque | No escuro | Escuro | Fundo suave | Canto | Construção |
|---|---|---|---|---|---|---|---|
| PDV Agiliza | `#3B5DB4` | `#3B5DB4` | `#46C4DD` | `#0F1729` | `#F0F4F8` | 1rem | símbolo: quadro com carrinho; palavra **AGILIZA** em caixa-alta, Inter 800, −0,05em, na primária |
| GestoVendas | `#3C71DD` | `#7055F6` | `#0DA2E7` | `#0F1624` | `#F6F7F8` | 0,75rem | símbolo: quadrado `#3C71DD` com canto arredondado e raio branco; "Gesto" no escuro + "Vendas" na primária, Inter 700, −0,025em |
| Zelo | `#0F766E` | `#0F766E` | `#2DD4BF` | `#0A0A0A` | `#F0FDFA` | 0 (reto) | **escudo com pulso em traço `#0D9488`**, sem quadrado, ao lado de "Zelo" em `#0A0A0A`, Inter Bold. O traço `#0D9488` nunca é texto. O quadrado verde-azulado com escudo branco é só o ícone de app |
| VendaFlow | em definição | | | | | | até o dono aprovar, peça de VendaFlow é **peça da empresa** (moldura Neetru) |
| PayView | sem identidade | | | | | | usa a marca Neetru até ganhar identidade |

- O índigo `#3E569D` e o `#EDF1FA` aparecem em peças antigas, mas **não** são a identidade do PDV.
- O canto do produto vale só dentro do bloco do produto (botão, selo). Fora dele, canto reto da Neetru.
- GestoVendas e Zelo estão "em breve": peça de rede social deles é peça da empresa (fundo e logo Neetru) e leva o aviso de produto em desenvolvimento.
- **Convivência:** a marca do produto fica no topo e o logo Neetru no rodapé, nunca lado a lado nem no mesmo tamanho. O rodapé tem uma marca só, a Neetru: logo Neetru, endereço do produto e linha legal. **"Um produto Neetru" só entra na imagem de link.** No site, topo e rodapé são sempre da Neetru; a cor e o canto do produto ficam só dentro do bloco do produto.
- Produto novo não pode lembrar nenhuma cor ocupada nem o azul da Neetru.

## 7. Tipos de página que o livro usa
Abertura em Preto Carvão · Abertura azul (título de uma ou duas linhas) · Sumário com páginas · Lista numerada · Colunas com fio · Palavras grandes · Desenho técnico (construção com cotas) · Escala real (tamanho mínimo) · Amostra de cor (faixas que sangram) · Espécime tipográfico · Faça / ressalva / não faça · Frase · Pares Não/Sim · Aplicação em maquete (palco frio) · Contracapa.

- **O "Não" sai riscado:** risco vermelho de 2 px, de canto a canto, em SVG (revisão de 22/10 à tarde). O `_sistema.md` §6.11 ainda diz "nada atravessa o desenho": está superado.
- Vitrine com todos os tipos montados: `brandbook\capitulos\_tipos-de-pagina.html`.
