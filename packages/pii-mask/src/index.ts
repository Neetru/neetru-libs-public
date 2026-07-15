/**
 * @neetru/pii-mask
 *
 * Mascaramento de PII fail-closed do Neetru Core DB. Mascara dados pessoais
 * num result set, no servidor, antes de a UI staff do visualizador de banco em
 * producao ve-los — uma salvaguarda LGPD.
 *
 * A decisao de seguranca cravada: FAIL-CLOSED. Uma coluna que NAO esta
 * explicitamente classificada e mascarada genericamente. O staff marca colunas
 * como `'safe'` explicitamente para desmascara-las.
 *
 * Funcao pura, isomorfica, zero dependencias de runtime.
 */

export { maskResultSet } from './mask.js';
export type { MaskPolicy, MaskOptions, MaskedResultSet } from './types.js';
