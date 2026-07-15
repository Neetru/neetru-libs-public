# @neetru/br-validation

Validacao BR pura para consumers do ecossistema Neetru (gestovendas, pdv-agiliza).

Funcoes puras extraidas de `neetru_core/src/lib/crypto/pii.ts`. Zero dependencias.
Compativel com Node >=20, edge runtimes e bundlers.

## API

### `isValidCPF(cpf: string): boolean`

Valida CPF via Modulo-11 oficial (Receita Federal). Aceita formatado (`123.456.789-09`) ou so digitos (`12345678909`). Rejeita CPFs todos-iguais.

### `isValidCNPJ(cnpj: string): boolean`

Valida CNPJ via Modulo-11 com pesos canonicos. Aceita formatado ou cru. Rejeita CNPJs todos-iguais.

### `normalizeCpf(cpf: string): string`

Remove tudo que nao for digito do CPF.

### `normalizeCnpj(cnpj: string): string`

Remove tudo que nao for digito do CNPJ.

### `redactPII(value: string, kind: 'cpf' | 'cnpj' | 'email' | 'phone'): string`

Redaction para audit logs — nunca expoe cleartext. Preserva apenas os ultimos 2 digitos em CPF/CNPJ, primeiro char do local em email, ultimos 4 digitos em phone.

### `anonymizeAddress(address: AddressStruct): AddressStruct`

Anonimizacao parcial LGPD: mantém city, state, country (relevancia fiscal NF-e); redact street, number, complement, neighborhood, zipCode.

## Uso

```ts
import { isValidCPF, isValidCNPJ, redactPII, anonymizeAddress } from '@neetru/br-validation';

isValidCPF('529.982.247-25'); // true
isValidCNPJ('11.222.333/0001-81'); // true

redactPII('529.982.247-25', 'cpf'); // '***.***.***-25'
redactPII('joao@empresa.com', 'email'); // 'j***@empresa.com'

anonymizeAddress({ street: 'Rua A', city: 'SP', state: 'SP', country: 'BR' });
// { street: '[redacted]', city: 'SP', state: 'SP', country: 'BR', ... }
```

## Notas

- Logica identica ao Core (`neetru_core/src/lib/crypto/pii.ts`) — nao divergir sem versionar os dois lados.
- Esta lib contem apenas funcoes PURAS. Criptografia (AES-256-GCM) e HMAC ficam no Core (server-only).
