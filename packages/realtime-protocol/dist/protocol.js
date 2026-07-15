/**
 * @neetru/realtime-protocol — contrato de wire do gateway neetru-realtime.
 *
 * Este modulo contem APENAS os tipos que viajam pelos bytes da conexao WebSocket
 * entre o NeetruRealtimeClient (SDK) e o gateway neetru-realtime (transport +
 * changestream). Incluir aqui apenas:
 *
 *   - Frames cliente → gateway (SubscribeFrame / ops outbound)
 *   - Frames gateway → cliente (DeltaFrame / ops inbound)
 *   - Descriptores de query e de mudanca (DbQuery, DbChange)
 *   - Unions de op string literals (SUBSCRIBE_OPS, DELTA_OPS)
 *   - Constantes de protocolo puras (sem estado, sem networking)
 *
 * NAO incluir aqui:
 *   - Abstracao de conexao WebSocket (ClientConnection) — e interna ao transport
 *   - Configuracao do servidor (RealtimeTransportOptions) — e interna ao transport
 *   - Interfaces de socket (WSSLike, WSSClientLike) — sao injecao de dependencia do transport
 *   - Estado da conexao do cliente (ConnectionState) — e interno ao SDK
 *   - Ticket de autenticacao (RealtimeTicket) — e contrato do Core, nao do wire
 *
 * Regra: se o tipo NAO aparece num frame JSON serializado que trafega pelo WS,
 * ele NAO pertence aqui.
 *
 * Ambos os lados importam este pacote para garantir que NUNCA derivem silenciosamente.
 */
// ---------------------------------------------------------------------------
// Ops do protocolo — string literals canônicos
// ---------------------------------------------------------------------------
/**
 * Ops de frames enviados pelo cliente (SDK) ao gateway.
 * Usado tanto na union do SubscribeFrame quanto em verificacoes de runtime.
 */
export const SUBSCRIBE_OPS = ['subscribe', 'unsubscribe', 'ping'];
/**
 * Ops de frames enviados pelo gateway ao cliente (SDK).
 * Usado tanto na union do DeltaFrame quanto em verificacoes de runtime.
 */
export const DELTA_OPS = ['delta', 'resync', 'stale', 'error', 'pong', 'drain'];
//# sourceMappingURL=protocol.js.map