export const PEDIDO_STATUS = {
  CRIADO: "criado",
  APROVANDO: "aprovando",
  PRODUCAO: "producao",
  EM_TRANSPORTE: "em_transporte",
  ENTREGUE: "entregue",
  ATRASADO: "atrasado",
  CANCELADO: "cancelado",
} as const;

export type PedidoStatus = (typeof PEDIDO_STATUS)[keyof typeof PEDIDO_STATUS];

export const pedidoStatusLabels: Record<PedidoStatus, string> = {
  [PEDIDO_STATUS.CRIADO]: "Criado",
  [PEDIDO_STATUS.APROVANDO]: "Aprovando",
  [PEDIDO_STATUS.PRODUCAO]: "Producao",
  [PEDIDO_STATUS.EM_TRANSPORTE]: "Em transporte",
  [PEDIDO_STATUS.ENTREGUE]: "Entregue",
  [PEDIDO_STATUS.ATRASADO]: "Atrasado",
  [PEDIDO_STATUS.CANCELADO]: "Cancelado",
};

export const pedidoStatusFlow: Record<PedidoStatus, PedidoStatus[]> = {
  [PEDIDO_STATUS.CRIADO]: [PEDIDO_STATUS.APROVANDO, PEDIDO_STATUS.CANCELADO],
  [PEDIDO_STATUS.APROVANDO]: [PEDIDO_STATUS.PRODUCAO, PEDIDO_STATUS.CANCELADO],
  [PEDIDO_STATUS.PRODUCAO]: [PEDIDO_STATUS.EM_TRANSPORTE, PEDIDO_STATUS.ATRASADO, PEDIDO_STATUS.CANCELADO],
  [PEDIDO_STATUS.EM_TRANSPORTE]: [PEDIDO_STATUS.ENTREGUE, PEDIDO_STATUS.ATRASADO, PEDIDO_STATUS.CANCELADO],
  [PEDIDO_STATUS.ATRASADO]: [PEDIDO_STATUS.EM_TRANSPORTE, PEDIDO_STATUS.ENTREGUE, PEDIDO_STATUS.CANCELADO],
  [PEDIDO_STATUS.ENTREGUE]: [],
  [PEDIDO_STATUS.CANCELADO]: [],
};

export const getNextPedidoStatus = (status: string): PedidoStatus | null => {
  const current = status as PedidoStatus;
  const next = pedidoStatusFlow[current]?.[0];
  return next ?? null;
};
