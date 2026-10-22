# Receitas técnicas (Windows, sem GPU)

Ferramentas que funcionaram: Python com PIL, PyMuPDF (`fitz`), python-pptx, python-docx, reportlab, fontTools; Chrome; `pdftoppm`. Não há Illustrator, Inkscape nem ImageMagick, e o PDF vetorial é o "editável para Illustrator".

**Cuidados que não se negociam:**
- **Nunca rode `convert`**: no Windows é a ferramenta que converte o sistema de arquivos do disco, não o ImageMagick.
- **Nunca mude configuração global** (variável de ambiente de usuário, `~/.npmrc`, pip.ini, git global) para servir a um projeto. Em 22/10 isso desviou o cache do npm do PC inteiro. Use variável só no processo.
- **Chrome:** sempre `--headless=new` e `--user-data-dir` numa pasta temporária sua no disco de trabalho (ex.: `<PASTA-TEMP>\chrome-<tarefa>`), apagada no fim; um Chrome pesado por vez; feche entre renders. Não deixe perfil esquecido dentro da pasta de trabalho.
- **Disco:** tudo no disco de trabalho (veja o mapa de caminhos). O disco do sistema vive com pouco espaço. No Git Bash, `$TEMP` vale `/tmp`, que fica no disco do sistema: não use.

## Reaproveite antes de escrever

Tudo em `<PASTA-DA-MARCA>\` (conferido em 22/10). Se não estiver na máquina, peça ao dono.

| Para | Use |
|---|---|
| CSS do livro (grade, contextos de cor, impressão) | `brandbook\brandbook.css` |
| Página de livro, desenho do logo com cotas, render e conferência | `brandbook\_ferramentas\`: `livro.py`, `marca.py`, `gerar_tipos.py`, `renderizar.py` (PNG por página + conferência; `--pdf`), `conferir_livro.py`, `montar_livro.py`, `folha_de_contato.py`, `livro_unico.py` (HTML único com fontes e imagens embutidas) |
| Ver todos os tipos de página prontos | `brandbook\capitulos\_tipos-de-pagina.html` |
| Comando do PDF do livro | `_notas-tecnicas\montagem-do-livro.md` |
| Palavra do logo em curvas, PDF vetorial do logo, comparação | `_notas-tecnicas\ferramentas-do-pacote\logo\`: `geo.py`, `construir.py`, `comparar.py` |
| Paleta, `.ase`, folha de cores | `_notas-tecnicas\ferramentas-do-pacote\cores\gerar_cores.py` |
| Modelos Office (apresentação, timbrado, cartão) | `_notas-tecnicas\ferramentas-do-pacote\modelos-corporativos\` |
| Logo de produto em vetor (`pdf_vetorial` com reportlab) | `_notas-tecnicas\ferramentas-do-pacote\zelo\build_logo.py` |
| Render de pacote de produto | `_notas-tecnicas\ferramentas-do-pacote\pdv-agiliza\render.py` |

## Render de páginas e recorte
```bash
CH="<CHROME>"   # o executável do Google Chrome (veja o mapa de caminhos)
MSYS_NO_PATHCONV=1 "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1920,$((1080*N)) --virtual-time-budget=8000 \
  --user-data-dir="<PASTA-TEMP>\\chrome-minha-tarefa" --screenshot="<PASTA-DE-SAIDA>\\cap.png" "file:///<PASTA-DA-PAGINA>/cap.html"
```
A captura tem limite perto de **16.384 px**: no máximo **15 páginas** por print (`_sistema.md` §9). Acima disso o corte é silencioso.
```python
from PIL import Image
im = Image.open('cap.png')
for i in range(im.height // 1080):
    im.crop((0, i*1080, 1920, (i+1)*1080)).save(f'p{i+1:02d}.png')
```
No Git Bash, use `MSYS_NO_PATHCONV=1` quando passar caminho com `/` para programa do Windows. Em heredoc Python, use string bruta (`r'...'`) para caminho com `\`.

## PDF 16:9 a partir do HTML
CSS obrigatório (o `brandbook.css` real tem tudo isto):
```css
@page { size: 1920px 1080px; margin: 0 }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } /* sem isto, aberturas azuis e capa saem brancas */
.pagina { break-after: page; page-break-after: always; break-inside: avoid; }
.pagina:last-of-type { break-after: auto; page-break-after: auto; }       /* sem página em branco no fim */
@media print { html, body { zoom: 1 !important; } }                        /* se a versão web usa script de zoom */
```
```bash
MSYS_NO_PATHCONV=1 "$CH" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --user-data-dir="<PASTA-TEMP>\\chrome-pdf" --print-to-pdf="<PASTA-DE-SAIDA>\\livro.pdf" "file:///<PASTA-DA-MARCA>/brandbook/index.html"
```
O `--virtual-time-budget` dá tempo de a Inter carregar antes de imprimir (o livro usou 20000; o render do pacote do PDV, 10000). Para conferir: `pdftoppm -r 40 -png saida.pdf pg` e abra algumas páginas.

## Palavra do logo em curvas (fontTools)
Use a Inter estática `arquivos\01-neetru\fontes\inter\estatica\ttf\inter-extrabold.ttf` (não a "display"), ou instancie a variável em **`wght 800, opsz 14`**, como o `geo.py`.
```python
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
f = TTFont('inter-extrabold.ttf'); gs = f.getGlyphSet(); cmap = f.getBestCmap()
upm = f['head'].unitsPerEm; size = 100; esc = size / upm; track = -0.03 * size  # entreletra -0,03em
x = 0; paths = []
for ch in 'Neetru':
    g = cmap[ord(ch)]; pen = SVGPathPen(gs)
    gs[g].draw(TransformPen(pen, (esc, 0, 0, -esc, x, size)))   # inverte o eixo y
    paths.append(pen.getCommands()); x += gs[g].width * esc + track
svg_d = ' '.join(paths)   # <path d="..."/> no lugar do <text>
```
O laço **ignora kerning (GPOS)**. Para "Neetru" não muda nada (conferido com HarfBuzz no `geo.py`); para outras palavras ("VendaFlow", "Agiliza"…), use uharfbuzz ou compare com `comparar.py`. Compare o render do SVG novo com o original lado a lado antes de aceitar.

## PDF vetorial do logo (reportlab)
Desenhe o caminho com reportlab numa página do tamanho do desenho (com a área de proteção). O reportlab abre toda página com `BT /F1 12 Tf 14.4 TL ET` (Helvetica): retire essa sequência do stream depois de gravar, como fazem `logo\construir.py` e `zelo\build_logo.py`.

## Paleta `.ase` (Adobe Swatch Exchange)
```python
import struct
def ase(cores, grupo='Neetru'):   # cores = [('Azul Neetru', '#1E90FF'), ...]
    def nome(s): s += '\0'; return struct.pack('>H', len(s)) + s.encode('utf-16-be')
    blocos = [(0xC001, nome(grupo))]
    for n, h in cores:
        r, g, b = (int(h[i:i+2], 16) / 255 for i in (1, 3, 5))
        blocos.append((0x0001, nome(n) + b'RGB ' + struct.pack('>fffH', r, g, b, 2)))
    blocos.append((0xC002, b''))
    out = b'ASEF' + struct.pack('>HHI', 1, 0, len(blocos))
    for t, d in blocos: out += struct.pack('>HI', t, len(d)) + d
    return out

def ler_ase(dados):   # leitura de volta, obrigatória antes de entregar
    assert dados[:4] == b'ASEF'; n = struct.unpack('>I', dados[8:12])[0]; p = 12; cores = []
    for _ in range(n):
        t, tam = struct.unpack('>HI', dados[p:p+6]); d = dados[p+6:p+6+tam]; p += 6 + tam
        if t == 0x0001:
            k = struct.unpack('>H', d[:2])[0]; nm = d[2:2+2*k].decode('utf-16-be').rstrip('\0'); q = 2 + 2*k
            assert d[q:q+4] == b'RGB '; r, g, b = struct.unpack('>fff', d[q+4:q+16])
            cores.append((nm, '#%02X%02X%02X' % tuple(round(v*255) for v in (r, g, b))))
    return cores   # compare com a lista de entrada
```

## Conferir PDF vetorial
```python
import fitz
doc = fitz.open('logo.pdf')
for p in doc:
    assert not p.get_images(), 'tem imagem raster'
    assert not p.get_fonts(), 'tem fonte/texto vivo (a Helvetica do reportlab?)'
    assert p.get_drawings(), 'página sem desenho'
```

## Contraste (WCAG)
```python
def lum(h):
    c = [int(h[i:i+2], 16)/255 for i in (1, 3, 5)]
    c = [x/12.92 if x <= 0.03928 else ((x+0.055)/1.055)**2.4 for x in c]   # 0,03928 (WCAG 2.0); diferença p/ 0,04045 é desprezível
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]
def contraste(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la+0.05)/(lb+0.05)
```
Texto ≥ 4,5:1, inclusive letra grande. O Azul Neetru `#1E90FF` sobre branco dá 3,24:1, por isso não é cor de texto. Em peça com acabamento, meça no PNG final.

## Ícones
- Parta de um PNG quadrado de **256 px ou mais**.
- `favicon.ico` com 16/32/48: `img.save('favicon.ico', sizes=[(16,16),(32,32),(48,48)])`. Se o traço sumir em 16 px, redesenhe esse tamanho.
- `apple-touch-icon-180.png`: **quadrado, opaco, sem cantos arredondados**. O iPhone aplica a máscara; se vier arredondado, aparecem cantos escuros.
- `icone-192/512.png` (Android/PWA): com os cantos do ícone.

## Modelos Office
- Fontes: Inter **estática** (`arquivos\01-neetru\fontes\inter\estatica\ttf\`: Light, Regular, SemiBold, ExtraBold, e Bold quando o modelo pede) e, nos modelos de rede, `fraunces-32pt-bold.ttf`. Os pesos 340 e 360 só existem na fonte variável: no Office, o apoio vira **Inter Light** e a letra miúda vira **Inter Regular**. Avise no LEIA-ME que a fonte precisa estar instalada.
- python-pptx: defina `prs.slide_width/height` no tamanho exato da peça (post 1080×1350 = 9525 EMU por px). Deixe o texto em caixas editáveis e o logo em PNG de alta resolução. Peça nova: duplicar slide, não "Novo slide".
- python-docx: papel timbrado A4 com o logo no cabeçalho e a linha legal no rodapé; salve também `.dotx`.
- Cartão de visita: reportlab, 90×50 mm com 3 mm de sangria e marcas de corte; campos de exemplo ("Nome Sobrenome"), nunca dado de pessoa real.
