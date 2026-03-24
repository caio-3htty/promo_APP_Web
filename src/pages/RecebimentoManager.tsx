import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PackageCheck, Search } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { EstoqueSection } from "@/components/EstoqueSection";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { canReceivePedidos } from "@/lib/rbac";
import { PEDIDO_STATUS, pedidoStatusLabels, type PedidoStatus } from "@/lib/pedidoStatus";

interface PedidoCompra {
  id: string;
  obra_id: string;
  material_id: string;
  fornecedor_id: string;
  quantidade: number;
  preco_unit: number;
  total: number;
  status: PedidoStatus;
  codigo_compra: string | null;
  criado_em: string;
  data_recebimento: string | null;
  obras: { name: string } | null;
  materiais: { nome: string; unidade: string } | null;
  fornecedores: { nome: string } | null;
}

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const statusColor = (status: string): BadgeVariant => {
  switch (status) {
    case PEDIDO_STATUS.CRIADO:
      return "secondary";
    case PEDIDO_STATUS.APROVANDO:
      return "outline";
    case PEDIDO_STATUS.PRODUCAO:
      return "default";
    case PEDIDO_STATUS.EM_TRANSPORTE:
      return "outline";
    case PEDIDO_STATUS.ENTREGUE:
      return "default";
    case PEDIDO_STATUS.ATRASADO:
    case PEDIDO_STATUS.CANCELADO:
      return "destructive";
    default:
      return "secondary";
  }
};

const RecebimentoManager = () => {
  const { obraId } = useParams();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const canReceive = canReceivePedidos(role);

  const [search, setSearch] = useState("");
  const [receiveItem, setReceiveItem] = useState<PedidoCompra | null>(null);
  const [codigoCompra, setCodigoCompra] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pedidos_recebimento", obraId],
    queryFn: async () => {
      let query = supabase
        .from("pedidos_compra")
        .select("*, obras(name), materiais(nome, unidade), fornecedores(nome)")
        .is("deleted_at", null)
        .in("status", [PEDIDO_STATUS.PRODUCAO, PEDIDO_STATUS.EM_TRANSPORTE, PEDIDO_STATUS.ATRASADO, PEDIDO_STATUS.ENTREGUE])
        .order("criado_em", { ascending: false });

      if (obraId) {
        query = query.eq("obra_id", obraId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PedidoCompra[];
    },
  });

  const filtered = useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const normalized = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(normalized) ||
          item.codigo_compra?.toLowerCase().includes(normalized) ||
          item.fornecedores?.nome?.toLowerCase().includes(normalized) ||
          item.materiais?.nome?.toLowerCase().includes(normalized) ||
          item.obras?.name?.toLowerCase().includes(normalized),
      );
    }

    return result;
  }, [items, search]);

  const receberMutation = useMutation({
    mutationFn: async (payload: { pedido: PedidoCompra; codigo: string; dataRec: string }) => {
      if (!payload.codigo.trim()) {
        throw new Error("Codigo de compra e obrigatorio");
      }

      const pedidoPayload: TablesUpdate<"pedidos_compra"> = {
        status: PEDIDO_STATUS.ENTREGUE,
        codigo_compra: payload.codigo.trim(),
        data_recebimento: new Date(payload.dataRec).toISOString(),
        recebido_por: user?.id ?? null,
      };

      const { error: pedidoError } = await supabase
        .from("pedidos_compra")
        .update(pedidoPayload)
        .eq("id", payload.pedido.id);
      if (pedidoError) throw pedidoError;

      const { data: existing, error: existingError } = await supabase
        .from("estoque_obra_material")
        .select("id, estoque_atual")
        .eq("obra_id", payload.pedido.obra_id)
        .eq("material_id", payload.pedido.material_id)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        const estoquePayload: TablesUpdate<"estoque_obra_material"> = {
          estoque_atual: existing.estoque_atual + payload.pedido.quantidade,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user?.id ?? null,
        };
        const { error } = await supabase
          .from("estoque_obra_material")
          .update(estoquePayload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const insertPayload: TablesInsert<"estoque_obra_material"> = {
          obra_id: payload.pedido.obra_id,
          material_id: payload.pedido.material_id,
          estoque_atual: payload.pedido.quantidade,
          atualizado_por: user?.id ?? null,
        };
        const { error } = await supabase
          .from("estoque_obra_material")
          .insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_recebimento", obraId] });
      queryClient.invalidateQueries({ queryKey: ["estoque_obra_material"] });
      toast.success("Pedido entregue e estoque atualizado");
      setReceiveItem(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openReceive = (item: PedidoCompra) => {
    setReceiveItem(item);
    setCodigoCompra(item.codigo_compra ?? "");
    setDataRecebimento(format(new Date(), "yyyy-MM-dd"));
  };

  const handleReceive = () => {
    if (!receiveItem) return;
    if (!codigoCompra.trim()) {
      toast.error("Informe o codigo de compra");
      return;
    }
    if (!dataRecebimento) {
      toast.error("Informe a data de recebimento");
      return;
    }

    receberMutation.mutate({
      pedido: receiveItem,
      codigo: codigoCompra,
      dataRec: dataRecebimento,
    });
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <PageShell title="Recebimento">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Recebimento de Materiais</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar codigo, fornecedor, material..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-72 pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido para recebimento.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Codigo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Obra</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Material</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fornecedor</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qtd</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acao</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{item.codigo_compra || item.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{item.obras?.name}</td>
                  <td className="px-4 py-3">
                    {item.materiais?.nome}
                    <span className="ml-1 text-xs text-muted-foreground">({item.materiais?.unidade})</span>
                  </td>
                  <td className="px-4 py-3">{item.fornecedores?.nome}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.quantidade}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.total)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColor(item.status)}>
                      {pedidoStatusLabels[item.status] ?? item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status !== PEDIDO_STATUS.ENTREGUE && canReceive ? (
                      <Button size="sm" onClick={() => openReceive(item)}>
                        <PackageCheck className="mr-1 h-4 w-4" />
                        Receber
                      </Button>
                    ) : item.status === PEDIDO_STATUS.ENTREGUE ? (
                      <span className="text-xs text-muted-foreground">
                        {item.data_recebimento
                          ? new Date(item.data_recebimento).toLocaleDateString("pt-BR")
                          : "Entregue"}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EstoqueSection obraId={obraId} />

      <Dialog open={!!receiveItem} onOpenChange={() => setReceiveItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          {receiveItem && (
            <div className="space-y-4">
              <div className="space-y-1 rounded-md border border-border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Material:</span> {receiveItem.materiais?.nome}
                </p>
                <p>
                  <span className="text-muted-foreground">Fornecedor:</span> {receiveItem.fornecedores?.nome}
                </p>
                <p>
                  <span className="text-muted-foreground">Quantidade:</span> {receiveItem.quantidade}{" "}
                  {receiveItem.materiais?.unidade}
                </p>
                <p>
                  <span className="text-muted-foreground">Total:</span> {formatCurrency(receiveItem.total)}
                </p>
              </div>
              <div>
                <Label>Codigo de Compra *</Label>
                <Input
                  value={codigoCompra}
                  onChange={(event) => setCodigoCompra(event.target.value)}
                  placeholder="Informe ou confirme o codigo"
                />
              </div>
              <div>
                <Label>Data de Recebimento *</Label>
                <Input
                  type="date"
                  value={dataRecebimento}
                  onChange={(event) => setDataRecebimento(event.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveItem(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReceive} disabled={receberMutation.isPending}>
              <PackageCheck className="mr-1 h-4 w-4" />
              {receberMutation.isPending ? "Processando..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default RecebimentoManager;
