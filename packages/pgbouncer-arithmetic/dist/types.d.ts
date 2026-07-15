/**
 * Tipos canonicos do `@neetru/coredb-pgbouncer-arithmetic`.
 */
/**
 * Dimensionamento do pool do PgBouncer derivado do `max_connections` do
 * Postgres e da contagem viva de bancos da VM.
 */
export interface PoolSizing {
    /**
     * `default_pool_size` do PgBouncer — quantas conexoes de servidor o pool
     * abre por banco.
     *
     * No regime normal vale a propriedade de seguranca
     * `nBancos * defaultPoolSize <= usable` — a soma das conexoes reais ao
     * Postgres nao estoura o teto.
     *
     * EXCECAO — VM over-densa: quando `floor(usable/nBancos) < 2`, entra o floor
     * de viabilidade `defaultPoolSize: 2` (um pool menor que 2 nao funciona).
     * Nessa regiao `nBancos * 2` PODE exceder `usable` — o `2` e um valor de
     * viabilidade MINIMA, NAO um valor seguro. E o sinal de que a VM tem bancos
     * demais: a correcao e operacional (hospedar menos bancos ou subir
     * `max_connections`).
     */
    defaultPoolSize: number;
    /**
     * `reserve_pool_size` do PgBouncer — folga de burst acima do
     * `default_pool_size`. Derivado como um quarto do `defaultPoolSize`.
     */
    reservePoolSize: number;
    /**
     * `max_client_conn` do PgBouncer — quantas conexoes de CLIENTE o PgBouncer
     * aceita. E barato (conexao de cliente nao consome conexao de servidor) e
     * fixo em 500.
     */
    maxClientConn: number;
}
