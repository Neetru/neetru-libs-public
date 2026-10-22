# Padrão de entrega de agência

O dono comparou com "uma agência de R$ 50 mil". Uma entrega de marca só está pronta quando tem as quatro partes abaixo, conferidas.

## 1. Peça de apresentação
- **PDF 16:9** (1920×1080 por página, sem margem e sem cabeçalho/rodapé do navegador).
- **Versão web** num arquivo HTML único (CSS, fontes e imagens embutidos), que abre offline e escala para a largura da tela sem rolagem lateral (testar em 390, 1440 e 2560 px).
- **Folha de contato** (todas as páginas em miniatura) para revisão rápida.
- Capa, sumário com páginas, aberturas de capítulo, contracapa. Nenhum dado interno na página.

## 2. Pasta de editáveis (`arquivos\`)
```
arquivos\
  indice.html          índice visual (miniatura + nome + para que serve), offline
  INDICE.md            árvore completa com a descrição de cada arquivo
  LEIA-ME.pdf          1–2 páginas: o que tem, qual formato usar, instalar fontes, regra ™/®, contato
  01-neetru\
    logo\<versao>\{svg,pdf,png,jpg}\   principal, negativa, branca, preta, simbolo-*
    cores\    neetru-paleta.ase · tokens.css · tokens.json · neetru-paleta.pdf · .png
    fontes\   Inter e Fraunces em TTF e WOFF2 (variável + estáticas) + licença OFL
    icones\   favicon.ico (16/32/48) · favicon-32.png · apple-touch-icon-180.png · icone-192/512.png
              avatar-redes-1080.png · imagem-compartilhamento-1200x630.png
    modelos\  redes\ (post, story, carrossel .pptx) · apresentacao\ (.pptx/.potx 16:9)
              papelaria\ (papel timbrado .docx/.dotx, cartão 90×50 mm PDF com sangria 3 mm + .pptx)
              email\ (assinatura HTML + instruções)
  02-produtos\<produto>\  mesmo padrão (logo, cores, ícones; modelos quando fizer sentido)
Neetru-Arquivos-da-Marca.zip   tudo dentro de uma pasta, conferido depois de zipar
_notas-tecnicas\ferramentas-do-pacote\   scripts que geram tudo de novo (fora da pasta do cliente e do zip)
```
Nomes: português, minúsculo, hífen, sem espaço nem acento. Pacote real de referência: `<PASTA-DA-MARCA>\arquivos\`.

## 3. Conferência antes de entregar (por script, não no olho)
- Nenhum SVG de logo tem `<text>` (palavra em curvas).
- Nenhum PDF de logo tem imagem rasterizada nem fonte/texto vivo (PyMuPDF: `page.get_images()` e `page.get_fonts()` vazios; `page.get_drawings()` com conteúdo). O reportlab põe uma Helvetica em toda página: retire (ver receitas).
- PNG transparente nos tamanhos certos, com a área de proteção dentro do quadro (igual em todas as marcas).
- Cores idênticas aos tokens (comparar hex).
- `.ase` lido de volta sem erro.
- `.pptx`/`.docx` abrem com python-pptx/python-docx e o texto é editável.
- Ícone do iPhone **quadrado e opaco**; no índice, mostrar a prévia com o recorte do iPhone e a nota "o iPhone arredonda os cantos sozinho".
- Zip lido de volta; lista bate com a pasta.
- Contraste de todo texto ≥ 4,5:1.

## 4. Notas técnicas (`_notas-tecnicas\`), longe do cliente
Divergências entre fontes (com a que vale e o porquê), lacunas, inventário técnico, como refazer, pendências do dono. A peça do cliente pode remeter a "decisões pendentes", mas nunca mostra caminho de arquivo, commit ou código.

## 5. Página de aprovação para o dono
HTML na Área de Trabalho (`APROVAR-<assunto>.html`): resumo em 5 linhas, peças em tamanho de leitura, decisões numeradas com a recomendação marcada e o que acontece em cada escolha. O dono responde no chat pelo número. Só depois disso algo vira oficial ou vai ao ar.
