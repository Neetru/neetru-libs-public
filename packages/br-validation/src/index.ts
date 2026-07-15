/**
 * @neetru/br-validation
 *
 * Funcoes puras de validacao e normalizacao BR — CPF, CNPJ, redactPII,
 * anonymizeAddress. Extraidas de neetru_core/src/lib/crypto/pii.ts.
 *
 * Zero dependencias. Compativel com Node, edge runtimes e bundlers.
 * Logica identica a origem no Core — nao divergir sem versionar os dois lados.
 *
 * Consumers: gestovendas, pdv-agiliza (e futuros produtos Neetru).
 */

// ─── Normalize ───────────────────────────────────────────────────────────────

/** Tira tudo que nao e digito (mantém CPF/CNPJ comparavel). */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

// ─── Validacao CPF / CNPJ (Modulo-11 puro — Receita Federal) ────────────────

/**
 * Valida CPF via Modulo-11 oficial. Aceita string com ou sem formatacao
 * (`123.456.789-09` ou `12345678909`). Rejeita CPFs todos-iguais.
 */
export function isValidCPF(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const digitAt = (s: string, i: number): number => parseInt(s.charAt(i), 10);

  const calc = (slice: string, weight: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += digitAt(slice, i) * (weight - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);

  return d1 === digitAt(digits, 9) && d2 === digitAt(digits, 10);
}

/**
 * Valida CNPJ via Modulo-11 com pesos canonicos. Aceita formatado ou cru.
 * Rejeita CNPJs todos-iguais.
 */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const digitAt = (s: string, i: number): number => parseInt(s.charAt(i), 10);

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calc = (slice: string, weights: readonly number[]): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += digitAt(slice, i) * (weights[i] ?? 0);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(digits.slice(0, 12), weights1);
  const d2 = calc(digits.slice(0, 13), weights2);

  return d1 === digitAt(digits, 12) && d2 === digitAt(digits, 13);
}

// ─── Redact (para audit logs / traces / errors) ──────────────────────────────

/**
 * Redaction para incluir valores PII em audit logs sem expor cleartext.
 *
 * - CPF "123.456.789-00"       => "***.***.***-00"  (preserva ultimos 2 digitos)
 * - CNPJ "12.345.678/0001-99"  => "XX.XXX.XXX/XXXX-99"
 * - Email "nome@dominio.com"   => "n***@dominio.com"
 * - Phone "(11) 9 8765-4321"   => "***4321"
 *
 * Para outros tipos retorna `[REDACTED]`.
 */
export function redactPII(value: string, kind: 'cpf' | 'cnpj' | 'email' | 'phone'): string {
  if (!value) return '[REDACTED]';
  const digits = value.replace(/\D/g, '');

  switch (kind) {
    case 'cpf':
      if (digits.length !== 11) return '[REDACTED]';
      return `***.***.***-${digits.slice(-2)}`;
    case 'cnpj':
      if (digits.length !== 14) return '[REDACTED]';
      return `**.***.***/****-${digits.slice(-2)}`;
    case 'email': {
      const parts = value.split('@');
      const local = parts[0] ?? '';
      const domain = parts[1];
      if (!domain) return '[REDACTED]';
      const head = local.length > 0 ? `${local.charAt(0)}***` : '***';
      return `${head}@${domain}`;
    }
    case 'phone':
      if (digits.length < 4) return '[REDACTED]';
      return `***${digits.slice(-4)}`;
    default:
      return '[REDACTED]';
  }
}

// ─── Endereco — anonimizacao parcial (DSR) ───────────────────────────────────

export interface AddressStruct {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;   // sigla (SP, RJ)
  zipCode?: string; // CEP
  country?: string; // default 'BR'
}

/**
 * Anonimizacao parcial conforme decisao CEO #3 (LGPD art. 16 + retencao fiscal).
 *
 * Mantém: city, state, country (relevancia fiscal — NF-e por municipio).
 * Redact: street, number, complement, neighborhood, zipCode.
 *
 * Usado quando DSR erasure pede delete de PII mas ha subscriptions ativas
 * ou invoices fiscais vigentes. Logica identica ao Core — nao divergir.
 */
export function anonymizeAddress(address: AddressStruct): AddressStruct {
  return {
    street: '[redacted]',
    number: '[redacted]',
    complement: '[redacted]',
    neighborhood: '[redacted]',
    city: address.city ?? '[redacted]',
    state: address.state ?? '[redacted]',
    zipCode: '[redacted]',
    country: address.country ?? 'BR',
  };
}
