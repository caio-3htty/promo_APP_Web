import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search, SkipForward, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { canApprovePedidos, canEditPedidosBase, canReceivePedidos } from "@/lib/rbac";
import {
  PEDIDO_STATUS,
  getNextPedidoStatus,
  pedidoStatusFlow,
  pedidoStatusLabels,
  type PedidoStatus,
} from "@/lib/pedidoStatus";

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
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
  deleted_at: string | null;
  obras: { name: string } | null;
  materiais: { nome: string; unidade: string } | null;
  fornecedores: { nome: string } | null;
}

interface FormState {
  obra_id: string;
  material_id: string;
  fornecedor_id: string;
  quantidade: string;
  preco_unit: string;
  status: PedidoStatus;
  codigo_compra: string;
  observacoes: string;
}

const emptyForm: FormState = {
  obra_id: "",
  material_id: "",
  fornecedor_id: "",
  quantidade: "",
  preco_unit: "",
  status: PEDIDO_STATUS.CRIADO,
  codigo_compra: "",
  observacoes: "",
};

const formSchema = z.object({
  obra_id: z.string().min(1, "Selecione uma obra"),
  material_id: z.string().min(1, "Selecione um material"),
  fornecedor_id: z.string().min(1, "Selecione um fornecedor"),
  quantidade: z.string().refine((value) => Number(value) > 0, "Quantidade deve ser maior que zero"),
  preco_unit: z.string().refine((value) => Number(value) > 0, "Preco unitario deve ser maior que zero"),
  status: z.string().min(1),
  codigo_compra: z.string().optional(),
  observacoes: z.string().optional(),
});

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const statusColor = (status: PedidoStatus): BadgeVariant => {
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
      return "destructive";
    case PEDIDO_STATUS.CANCELADO:
      return "destructive";
    default:
      return "secondary";
  }
};

const statusOptions: Array<{ value: PedidoStatus; label: string }> = [
  { value: PEDIDO_STATUS.CRIADO, label: pedidoStatusLabels[PEDIDO_STATUS.CRIADO] },
  { value: PEDIDO_STATUS.APROVANDO, label: pedidoStatusLabels[PEDIDO_STATUS.APROVANDO] },
  { value: PEDIDO_STATUS.PRODUCAO, label: pedidoStatusLabels[PEDIDO_STATUS.PRODUCAO] },
  { value: PEDIDO_STATUS.EM_TRANSPORTE, label: pedidoStatusLabels[PEDIDO_STATUS.EM_TRANSPORTE] },
  { value: PEDIDO_STATUS.ENTREGUE, label: pedidoStatusLabels[PEDIDO_STATUS.ENTREGUE] },
  { value: PEDIDO_STATUS.ATRASADO, label: pedidoStatusLabels[PEDIDO_STATUS.ATRASADO] },
  { value: PEDIDO_STATUS.CANCELADO, label: pedidoStatusLabels[PEDIDO_STATUS.CANCELADO] },
];

const PedidosCompraManager = () => {
  const { obraId } = useParams();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();

  const canEditBase = canEditPedidosBase(role);
  const canApprove = canApprovePedidos(role);
  const canReceive = canReceivePedidos(role);
  const canDelete = role === "master" || role === "gestor";

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PedidoCompra | null>(null);
  const [detailItem, setDetailItem] = useState<PedidoCompra | null>(null);
  const [transitionItem, setTransitionItem] = useState<PedidoCompra | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<PedidoStatus>(PEDIDO_STATUS.APROVANDO);
  const [transitionCodigo, setTransitionCodigo] = useState("");
  const [form, setForm] = useState<FormState>({ ...emptyForm, obra_id: obraId ?? "" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pedidos_compra", obraId],
    queryFn: async () => {
      let query = supabase
        .from("pedidos_compra")
        .select("*, obras(name), materiais(nome, unidade), fornecedores(nome)")
        .is("deleted_at", null)
        .order("criado_em", { ascending: false });

      if (obraId) {
        query = query.eq("obra_id", obraId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as PedidoCompra[];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, nome, unidade")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let result = [...items];

    if (filterStatus !== "all") {
      result = result.filter((item) => item.status === filterStatus);
    }

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
  }, [items, search, filterStatus]);

  const upsert = useMutation({
    mutationFn: async (values: FormState & { id?: string }) => {
      const qty = Number(values.quantidade) || 0;
      const unitPrice = Number(values.preco_unit) || 0;
      const payload: TablesUpdate<"pedidos_compra"> = {
        obra_id: values.obra_id,
        material_id: values.material_id,
        fornecedor_id: values.fornecedor_id,
        quantidade: qty,
        preco_unit: unitPrice,
        total: qty * unitPrice,
        status: role === "operacional" ? PEDIDO_STATUS.CRIADO : values.status,
        codigo_compra: values.codigo_compra || null,
      };

      if (values.id) {
        const updatePayload = {
          ...payload,
          observacoes: values.observacoes || null,
        } as TablesUpdate<"pedidos_compra">;

        const { error } = await supabase.from("pedidos_compra").update(updatePayload).eq("id", values.id);
        if (error) throw error;
      } else {
        const insertPayload: TablesInsert<"pedidos_compra"> = {
          ...payload,
          obra_id: payload.obra_id as string,
          material_id: payload.material_id as string,
          fornecedor_id: payload.fornecedor_id as string,
          criado_por: user?.id ?? null,
        };

        // observacoes exists in DB but not in generated type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertAny = { ...insertPayload, observacoes: values.observacoes || null } as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("pedidos_compra").insert(insertAny);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra", obraId] });
      toast.success(editing ? "Pedido atualizado" : "Pedido criado");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transitionMutation = useMutation({
    mutationFn: async (payload: { id: string; status: PedidoStatus; codigo_compra?: string | null }) => {
      if (payload.status === PEDIDO_STATUS.ENTREGUE && !payload.codigo_compra?.trim()) {
        throw new Error("Codigo de compra obrigatorio para concluir o pedido");
      }

      const transitionPayload: TablesUpdate<"pedidos_compra"> = {
        status: payload.status,
        codigo_compra: payload.codigo_compra?.trim() || null,
      };

      const { error } = await supabase
        .from("pedidos_compra")
        .update(transitionPayload)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra", obraId] });
      toast.success("Etapa do pedido atualizada");
      setTransitionItem(null);
      setTransitionCodigo("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pedidos_compra")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra", obraId] });
      toast.success("Pedido excluido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, obra_id: obraId ?? "" });
    setOpen(true);
  };

  const openEdit = (item: PedidoCompra) => {
    setEditing(item);
    setForm({
      obra_id: item.obra_id,
      material_id: item.material_id,
      fornecedor_id: item.fornecedor_id,
      quantidade: String(item.quantidade),
      preco_unit: String(item.preco_unit),
      status: item.status,
      codigo_compra: item.codigo_compra ?? "",
      observacoes: item.observacoes ?? "",
    });
    setOpen(true);
  };

  const openTransition = (item: PedidoCompra, target?: PedidoStatus) => {
    const possible = (pedidoStatusFlow[item.status] ?? []) as PedidoStatus[];
    const selected = target ?? possible[0] ?? item.status;
    setTransitionItem(item);
    setTransitionTarget(selected);
    setTransitionCodigo(item.codigo_compra ?? "");
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    const payload = { ...form, obra_id: obraId ?? form.obra_id };
    const parsed = formSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados invalidos");
      return;
    }

    if (payload.status === PEDIDO_STATUS.ENTREGUE && !payload.codigo_compra.trim()) {
      toast.error("Codigo de compra obrigatorio para concluir o pedido");
      return;
    }

    upsert.mutate(editing ? { ...payload, id: editing.id } : payload);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <PageShell title="Pedidos de Compra">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Pedidos de Compra</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ID, codigo, fornecedor, material..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-72 pl-9"
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEditBase && (
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Codigo</th>
                {!obraId && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Obra</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Material</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fornecedor</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qtd</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const nextStatus = getNextPedidoStatus(item.status);
                const canProgress = canApprove && !!nextStatus;

                return (
                  <tr key={item.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{item.codigo_compra || item.id.slice(0, 8)}</td>
                    {!obraId && <td className="px-4 py-3">{item.obras?.name}</td>}
                    <td className="px-4 py-3">
                      {item.materiais?.nome}
                      <span className="ml-1 text-xs text-muted-foreground">({item.materiais?.unidade})</span>
                    </td>
                    <td className="px-4 py-3">{item.fornecedores?.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantidade}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColor(item.status)}>{pedidoStatusLabels[item.status] ?? item.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(item.criado_em).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailItem(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEditBase && item.status !== PEDIDO_STATUS.ENTREGUE && item.status !== PEDIDO_STATUS.CANCELADO && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => softDelete.mutate(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {canProgress && (
                          <Button size="sm" variant="outline" onClick={() => openTransition(item, nextStatus!)}>
                            <SkipForward className="mr-1 h-4 w-4" />
                            Avancar
                          </Button>
                        )}
                        {canApprove && item.status !== PEDIDO_STATUS.ATRASADO && (pedidoStatusFlow[item.status] ?? []).includes(PEDIDO_STATUS.ATRASADO) && (
                          <Button size="sm" variant="destructive" onClick={() => openTransition(item, PEDIDO_STATUS.ATRASADO)}>
                            Atrasar
                          </Button>
                        )}
                        {canReceive && item.status !== PEDIDO_STATUS.ENTREGUE && (pedidoStatusFlow[item.status] ?? []).includes(PEDIDO_STATUS.ENTREGUE) && (
                          <Button size="sm" onClick={() => openTransition(item, PEDIDO_STATUS.ENTREGUE)}>
                            Entregar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">ID:</span> <span className="font-mono">{detailItem.id.slice(0, 8)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Codigo:</span> {detailItem.codigo_compra || "-"}
              </div>
              <div>
                <span className="text-muted-foreground">Obra:</span> {detailItem.obras?.name}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant={statusColor(detailItem.status)}>{pedidoStatusLabels[detailItem.status] ?? detailItem.status}</Badge>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Material:</span> {detailItem.materiais?.nome} ({detailItem.materiais?.unidade})
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Fornecedor:</span> {detailItem.fornecedores?.nome}
              </div>
              <div>
                <span className="text-muted-foreground">Quantidade:</span> {detailItem.quantidade}
              </div>
              <div>
                <span className="text-muted-foreground">Preco unit.:</span> {formatCurrency(detailItem.preco_unit)}
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Total:</span>{" "}
                <span className="font-semibold">{formatCurrency(detailItem.total)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Criado em:</span>{" "}
                {new Date(detailItem.criado_em).toLocaleString("pt-BR")}
              </div>
              {detailItem.observacoes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Observacoes:</span> {detailItem.observacoes}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailItem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pedido" : "Novo Pedido de Compra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!obraId && (
              <div>
                <Label>Obra *</Label>
                <Select value={form.obra_id} onValueChange={(value) => setForm({ ...form, obra_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Material *</Label>
              <Select value={form.material_id} onValueChange={(value) => setForm({ ...form, material_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.nome} ({material.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fornecedor *</Label>
              <Select value={form.fornecedor_id} onValueChange={(value) => setForm({ ...form, fornecedor_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.quantidade}
                  onChange={(event) => setForm({ ...form, quantidade: event.target.value })}
                />
              </div>
              <div>
                <Label>Preco Unitario (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_unit}
                  onChange={(event) => setForm({ ...form, preco_unit: event.target.value })}
                />
              </div>
            </div>

            {form.quantidade && form.preco_unit && (
              <p className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(form.quantidade) * Number(form.preco_unit))}
                </span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value as PedidoStatus })}
                  disabled={role === "operacional"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Codigo de Compra</Label>
                <Input
                  value={form.codigo_compra}
                  onChange={(event) => setForm({ ...form, codigo_compra: event.target.value })}
                  placeholder="Obrigatorio para pedido entregue"
                />
              </div>
            </div>

            <div>
              <Label>Observacoes</Label>
              <Input
                value={form.observacoes}
                onChange={(event) => setForm({ ...form, observacoes: event.target.value })}
                placeholder="Contexto operacional do pedido"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transitionItem} onOpenChange={() => setTransitionItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar etapa do pedido</DialogTitle>
          </DialogHeader>
          {transitionItem && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Pedido:</span> {transitionItem.id.slice(0, 8)}
                </p>
                <p>
                  <span className="text-muted-foreground">Status atual:</span> {pedidoStatusLabels[transitionItem.status]}
                </p>
                <p>
                  <span className="text-muted-foreground">Material:</span> {transitionItem.materiais?.nome}
                </p>
              </div>

              <div>
                <Label>Nova etapa</Label>
                <Select
                  value={transitionTarget}
                  onValueChange={(value) => setTransitionTarget(value as PedidoStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(pedidoStatusFlow[transitionItem.status] ?? []).map((status) => (
                      <SelectItem key={status} value={status}>
                        {pedidoStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Codigo de compra {transitionTarget === PEDIDO_STATUS.ENTREGUE ? "*" : ""}</Label>
                <Input
                  value={transitionCodigo}
                  onChange={(event) => setTransitionCodigo(event.target.value)}
                  placeholder="Obrigatorio para concluir entrega"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionItem(null)}>
              Fechar
            </Button>
            <Button
              onClick={() =>
                transitionItem &&
                transitionMutation.mutate({
                  id: transitionItem.id,
                  status: transitionTarget,
                  codigo_compra: transitionCodigo,
                })
              }
              disabled={transitionMutation.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default PedidosCompraManager;
