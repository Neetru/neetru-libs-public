/**
 * Tipos canonicos do `@neetru/pii-mask`.
 */

/**
 * Politica de mascaramento de uma coluna.
 *
 * - `'safe'`    — coluna sem PII, passa sem alteracao.
 * - `'generic'` — mascaramento total: o valor inteiro vira `●●●●`.
 * - `'email'`   — mascaramento de e-mail (preserva 2 chars do local, 1 do dominio, TLD).
 * - `'cpf'`     — mascaramento de CPF brasileiro (preserva os 2 ultimos digitos).
 * - `'phone'`   — mascaramento de telefone (preserva os 4 ultimos digitos).
 * - `'card'`    — mascaramento de cartao de pagamento (preserva os 4 ultimos digitos, padrao PCI).
 */
export type MaskPolicy = 'email' | 'cpf' | 'phone' | 'card' | 'generic' | 'safe';

/**
 * Opcoes de mascaramento de um result set.
 */
export interface MaskOptions {
  /**
   * Mapa coluna → politica. Uma coluna AUSENTE deste mapa e tratada como
   * `'generic'` — esta e a regra fail-closed da LGPD: uma coluna nao
   * classificada NUNCA pode vazar.
   */
  columns: Record<string, MaskPolicy>;
}

/**
 * Result set apos o mascaramento.
 */
export interface MaskedResultSet {
  /** As linhas mascaradas — objetos novos, sem mutar a entrada. */
  rows: Record<string, unknown>[];
  /**
   * Nomes das colunas que sofreram algum mascaramento. Uma coluna entra nesta
   * lista quando a sua politica nao e `'safe'` (a politica FOI aplicada),
   * independentemente de os valores serem `null`. Deduplicada e ordenada.
   */
  maskedColumns: string[];
}
