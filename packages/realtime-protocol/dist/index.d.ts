/**
 * @neetru/realtime-protocol
 *
 * Contrato de wire do gateway neetru-realtime. Tipos de frame, union de ops e
 * constantes do protocolo WebSocket multiplexado. Zero dependencias de runtime.
 *
 * Importado por:
 *   - @neetru/realtime-transport    (gateway, lado servidor)
 *   - @neetru/realtime-changestream (fan-out, lado servidor)
 *   - @neetru/sdk NeetruRealtimeClient (lado cliente)
 *
 * Garantia: gateway e cliente nunca derivam silenciosamente — ha um unico
 * contrato de wire compartilhado.
 */
export { SUBSCRIBE_OPS, DELTA_OPS, } from './protocol.js';
export type { SubscribeOp, DeltaOp, DbQuery, SubscribeFrame, DbChange, DeltaFrame, } from './protocol.js';
