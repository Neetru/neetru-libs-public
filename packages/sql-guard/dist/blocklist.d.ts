/**
 * Blocklist de funções SQL perigosas.
 *
 * Mesmo que um statement seja sintaticamente um SELECT (read-only), se ele
 * referenciar QUALQUER função desta lista ele é classificado como inseguro.
 * São funções que leem/escrevem arquivos do sistema, abrem conexões externas,
 * ou consomem recursos do servidor — capazes de exfiltrar dados ou derrubar o
 * banco a partir de uma "consulta de leitura".
 *
 * A lista é fechada e em minúsculas; a detecção compara sempre em minúsculas.
 */
export declare const DANGEROUS_FUNCTIONS: ReadonlySet<string>;
/**
 * Testa se um nome de função (qualquer caixa) está na blocklist.
 */
export declare function isDangerousFunction(name: string): boolean;
