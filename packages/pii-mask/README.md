# @neetru/pii-mask

Mascaramento de PII (dados pessoais) do Neetru Core DB. Mascara um result set,
**no servidor**, antes de ele chegar à UI staff do visualizador de banco em
produção. É uma salvaguarda crítica de **LGPD** (Lei Geral de Proteção de Dados).

## O que faz

Recebe as linhas vindas do banco e um mapa coluna → política, e devolve as
linhas com cada coluna mascarada segundo a sua política. Função pura,
isomórfica, **zero dependências de runtime**.

## Princípio fail-closed

A decisão de segurança cravada deste pacote: **uma coluna que NÃO está
explicitamente classificada é mascarada genericamente.** O staff marca uma
coluna como `'safe'` explicitamente para desmascará-la — nunca o contrário.

O fail-closed atua em duas camadas:

1. **Coluna não classificada** — uma coluna ausente do mapa `columns` é tratada
   como `'generic'`. Uma coluna nova que ninguém classificou ainda **nunca
   vaza**: ela já chega mascarada.
2. **Valor que não parseia** — dentro de uma política tipada
   (`email`/`cpf`/`phone`/`card`), um valor que não é string, ou é uma string
   que não casa com a forma esperada, **cai para o mascaramento `'generic'`**.
   Nunca se deixa passar um valor que não parseou como o esperado.

Um `null`/`undefined` permanece `null`/`undefined` sob qualquer política — um
nulo não é PII.

## API

```ts
import { maskResultSet, type MaskOptions } from '@neetru/pii-mask';

const opts: MaskOptions = {
  columns: {
    id: 'safe',
    email: 'email',
    cpf: 'cpf',
    // coluna `endereco` AUSENTE → tratada como 'generic' (fail-closed)
  },
};

const out = maskResultSet(
  [{ id: 1, email: 'joao.silva@gmail.com', cpf: '123.456.789-09', endereco: 'Rua X, 42' }],
  opts,
);

out.rows;
// [{ id: 1, email: 'jo********@g****.com', cpf: '***.***.***-09', endereco: '●●●●' }]
out.maskedColumns;
// ['cpf', 'email', 'endereco']  — colunas com política não-'safe', ordenadas
```

### Políticas (`MaskPolicy`)

| Política    | Comportamento |
|-------------|---------------|
| `'safe'`    | Passa o valor sem alteração. Não entra em `maskedColumns`. |
| `'generic'` | Substitui o valor inteiro por `●●●●` (U+25CF × 4). Zero vazamento. |
| `'email'`   | Mantém 2 chars do local + 1 char do domínio + o TLD. `joao.silva@gmail.com` → `jo********@g****.com`. |
| `'cpf'`     | CPF brasileiro: mantém só os 2 últimos dígitos → `***.***.***-NN`. |
| `'phone'`   | Telefone: mantém só os 4 últimos dígitos, preserva separadores. |
| `'card'`    | Cartão de pagamento (padrão PCI): mantém só os 4 últimos → `**** **** **** NNNN`. |

### `maskResultSet(rows, opts)`

Função **pura** — não muta o array de entrada nem os objetos linha; devolve
linhas novas. Determinística: mesma entrada → mesma saída.

- `rows` — `Record<string, unknown>[]`, as linhas do banco.
- `opts.columns` — mapa coluna → `MaskPolicy`. Coluna ausente = `'generic'`.
- Retorna `{ rows, maskedColumns }`. `maskedColumns` lista, ordenada e sem
  duplicatas, as colunas cuja política não é `'safe'` (a política de
  mascaramento foi aplicada, independentemente de os valores serem `null`).
- `rows` vazio → `{ rows: [], maskedColumns: [] }`.

## Estado

Implementado (M0). Suíte vitest cobrindo fail-closed por coluna não
classificada, fallback genérico de política tipada, todas as políticas,
pureza e correção de `maskedColumns`.
