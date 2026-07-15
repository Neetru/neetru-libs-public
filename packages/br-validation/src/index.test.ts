import { describe, it, expect } from 'vitest';
import {
  isValidCPF,
  isValidCNPJ,
  normalizeCpf,
  normalizeCnpj,
  redactPII,
  anonymizeAddress,
} from './index.js';

// ─── normalizeCpf / normalizeCnpj ────────────────────────────────────────────

describe('normalizeCpf', () => {
  it('remove pontos e traco de CPF formatado', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });
  it('nao altera CPF ja em digitos', () => {
    expect(normalizeCpf('12345678909')).toBe('12345678909');
  });
});

describe('normalizeCnpj', () => {
  it('remove pontos, barra e traco de CNPJ formatado', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
  it('nao altera CNPJ ja em digitos', () => {
    expect(normalizeCnpj('11222333000181')).toBe('11222333000181');
  });
});

// ─── isValidCPF ──────────────────────────────────────────────────────────────

describe('isValidCPF', () => {
  it('aceita CPF valido sem formatacao (modulo-11)', () => {
    // CPF canônico gerado via calculo modulo-11
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('aceita CPF valido com formatacao', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF com digito verificador errado', () => {
    expect(isValidCPF('529.982.247-26')).toBe(false);
  });

  it('rejeita CPF todos-iguais (111.111.111-11)', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('99999999999')).toBe(false);
  });

  it('rejeita CPF com comprimento errado', () => {
    expect(isValidCPF('1234567890')).toBe(false);   // 10 digitos
    expect(isValidCPF('123456789012')).toBe(false);  // 12 digitos
  });

  it('rejeita string vazia', () => {
    expect(isValidCPF('')).toBe(false);
  });

  it('rejeita CPF com letras', () => {
    expect(isValidCPF('abc.def.ghi-jk')).toBe(false);
  });
});

// ─── isValidCNPJ ─────────────────────────────────────────────────────────────

describe('isValidCNPJ', () => {
  it('aceita CNPJ valido sem formatacao (modulo-11)', () => {
    // CNPJ canônico da Receita Federal (exemplo publico)
    expect(isValidCNPJ('11222333000181')).toBe(true);
  });

  it('aceita CNPJ valido com formatacao', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ com digito verificador errado', () => {
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
  });

  it('rejeita CNPJ todos-iguais (00.000.000/0000-00)', () => {
    expect(isValidCNPJ('00000000000000')).toBe(false);
    expect(isValidCNPJ('11111111111111')).toBe(false);
  });

  it('rejeita CNPJ com comprimento errado', () => {
    expect(isValidCNPJ('1122233300018')).toBe(false);   // 13 digitos
    expect(isValidCNPJ('112223330001810')).toBe(false);  // 15 digitos
  });

  it('rejeita string vazia', () => {
    expect(isValidCNPJ('')).toBe(false);
  });
});

// ─── redactPII ───────────────────────────────────────────────────────────────

describe('redactPII — cpf', () => {
  it('preserva os 2 ultimos digitos', () => {
    expect(redactPII('529.982.247-25', 'cpf')).toBe('***.***.***-25');
  });

  it('funciona com CPF so em digitos', () => {
    expect(redactPII('52998224725', 'cpf')).toBe('***.***.***-25');
  });

  it('retorna [REDACTED] quando comprimento errado', () => {
    expect(redactPII('1234567890', 'cpf')).toBe('[REDACTED]');
  });

  it('retorna [REDACTED] para string vazia', () => {
    expect(redactPII('', 'cpf')).toBe('[REDACTED]');
  });
});

describe('redactPII — cnpj', () => {
  it('preserva os 2 ultimos digitos', () => {
    expect(redactPII('11.222.333/0001-81', 'cnpj')).toBe('**.***.***/****-81');
  });

  it('funciona com CNPJ so em digitos', () => {
    expect(redactPII('11222333000181', 'cnpj')).toBe('**.***.***/****-81');
  });

  it('retorna [REDACTED] quando comprimento errado', () => {
    expect(redactPII('1122233300018', 'cnpj')).toBe('[REDACTED]');
  });
});

describe('redactPII — email', () => {
  it('preserva primeiro char do local e dominio completo', () => {
    expect(redactPII('joao@neetru.com', 'email')).toBe('j***@neetru.com');
  });

  it('retorna [REDACTED] sem @', () => {
    expect(redactPII('naoemail', 'email')).toBe('[REDACTED]');
  });
});

describe('redactPII — phone', () => {
  it('preserva 4 ultimos digitos', () => {
    expect(redactPII('(11) 98765-4321', 'phone')).toBe('***4321');
  });

  it('retorna [REDACTED] com menos de 4 digitos', () => {
    expect(redactPII('123', 'phone')).toBe('[REDACTED]');
  });
});

// ─── anonymizeAddress ────────────────────────────────────────────────────────

describe('anonymizeAddress', () => {
  it('redact campos sensiveis e mantém city/state/country', () => {
    const result = anonymizeAddress({
      street: 'Rua das Flores',
      number: '42',
      complement: 'Apto 3',
      neighborhood: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01310-100',
      country: 'BR',
    });

    expect(result.street).toBe('[redacted]');
    expect(result.number).toBe('[redacted]');
    expect(result.complement).toBe('[redacted]');
    expect(result.neighborhood).toBe('[redacted]');
    expect(result.zipCode).toBe('[redacted]');
    expect(result.city).toBe('Sao Paulo');
    expect(result.state).toBe('SP');
    expect(result.country).toBe('BR');
  });

  it('usa [redacted] como fallback quando city/state ausentes', () => {
    const result = anonymizeAddress({});
    expect(result.city).toBe('[redacted]');
    expect(result.state).toBe('[redacted]');
    expect(result.country).toBe('BR');
  });

  it('country default BR quando ausente', () => {
    const result = anonymizeAddress({ city: 'Rio de Janeiro', state: 'RJ' });
    expect(result.country).toBe('BR');
  });

  it('nao muta o objeto original', () => {
    const original = { street: 'Rua A', city: 'Curitiba', state: 'PR' };
    anonymizeAddress(original);
    expect(original.street).toBe('Rua A');
  });
});
