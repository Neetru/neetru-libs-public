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
export const SUBSCRIBE_OPS = ['subscribe', 'unsubscribe', 'ping'] as const;
export type SubscribeOp = (typeof SUBSCRIBE_OPS)[number];

/**
 * Ops de frames enviados pelo gateway ao cliente (SDK).
 * Usado tanto na union do DeltaFrame quanto em verificacoes de runtime.
 */
export const DELTA_OPS = ['delta', 'resync', 'stale', 'error', 'pong', 'drain'] as const;
export type DeltaOp = (typeof DELTA_OPS)[number];

// ---------------------------------------------------------------------------
// Query descriptor (viaja no frame subscribe)
// ---------------------------------------------------------------------------

/**
 * Descritor de query de colecao enviado no frame `subscribe` ao gateway.
 *
 * O gateway usa estes campos para filtrar quais documentos do change stream
 * sao relevantes para esta subscription.
 *
 * Campos especiais no `filter`:
 *   - `_ticket`: token de autenticacao do realtime (embutido pelo SDK)
 *   - `_dbId`:   ID do banco logico (embutido pelo SDK, exigido pelo changestream)
 */
export interface DbQuery {
  /** Ex.: { status: 'active', _ticket: '<token>', _dbId: '<id>' } */
  filter?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Frames cliente → gateway (outbound / inbound no gateway)
// ---------------------------------------------------------------------------

/**
 * Frame enviado pelo NeetruRealtimeClient ao gateway.
 *
 * - op 'subscribe'   : registra uma subscription na colecao `collection` com
 *                      query `query` (que inclui `_ticket` e `_dbId`).
 * - op 'unsubscribe' : cancela a subscription com `subscriptionId`.
 * - op 'ping'        : heartbeat de aplicacao (distinto do ping/pong do protocolo WS);
 *                      usa subscriptionId === '' convencional.
 */
export interface SubscribeFrame {
  op: SubscribeOp;
  subscriptionId: string;
  /** Obrigatorio quando op === 'subscribe'. */
  collection?: string;
  query?: DbQuery;
}

// ---------------------------------------------------------------------------
// Frames gateway → cliente (outbound do gateway / inbound no SDK)
// ---------------------------------------------------------------------------

/**
 * Representa uma mudanca individual num documento, transportada em DeltaFrame.
 *
 * O campo `type` segue a convencao do change stream Mongo:
 *   - 'insert' : documento novo
 *   - 'update' : documento existente modificado
 *   - 'delete' : documento removido (sem `data`)
 */
export interface DbChange {
  /** 'insert' | 'update' | 'delete' */
  type: string;
  documentId: string;
  data?: Record<string, unknown>;
}

/**
 * Frame enviado pelo gateway ao NeetruRealtimeClient.
 *
 * - 'delta'  : incremento — lista de mudancas aplicadas ao snapshot local.
 * - 'resync' : o cliente deve descartar o snapshot e reaplicar do zero.
 * - 'stale'  : o gateway perdeu eventos; cliente deve marcar cache como stale.
 * - 'error'  : erro na subscription; `reason` explica.
 * - 'pong'   : resposta ao ping de heartbeat de aplicacao.
 * - 'drain'  : sinal de graceful shutdown; cliente deve reconectar com backoff.
 */
export interface DeltaFrame {
  op: DeltaOp;
  subscriptionId: string;
  changes?: DbChange[];
  reason?: string;
}
