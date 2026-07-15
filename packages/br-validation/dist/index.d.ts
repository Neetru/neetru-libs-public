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
/** Tira tudo que nao e digito (mantém CPF/CNPJ comparavel). */
export declare function normalizeCpf(cpf: string): string;
export declare function normalizeCnpj(cnpj: string): string;
/**
 * Valida CPF via Modulo-11 oficial. Aceita string com ou sem formatacao
 * (`123.456.789-09` ou `12345678909`). Rejeita CPFs todos-iguais.
 */
export declare function isValidCPF(cpf: string): boolean;
/**
 * Valida CNPJ via Modulo-11 com pesos canonicos. Aceita formatado ou cru.
 * Rejeita CNPJs todos-iguais.
 */
export declare function isValidCNPJ(cnpj: string): boolean;
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
export declare function redactPII(value: string, kind: 'cpf' | 'cnpj' | 'email' | 'phone'): string;
export interface AddressStruct {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
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
export declare function anonymizeAddress(address: AddressStruct): AddressStruct;
