import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, PlusCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
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
import { PEDIDO_STATUS, pedidoStatusLabels, type PedidoStatus } from "@/lib/pedidoStatus";

type PedidoRapido = {
  id: string;
  obra_id: string;
  material_id: string;
  fornecedor_id: string;
  quantidade: number;
  status: PedidoStatus;
  codigo_compra: string | null;
  materiais: { nome: string; unidade: string } | null;
  fornecedores: { nome: string } | null;
};

type MaterialResumo = {
  id: string;
  nome: string;
  unidade: string;
};

const AlmoxarifeRapido = () => {
  const { obraId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [codigoByPedido, setCodigoByPedido] = useState<Record<string, string>>({});
  const [materialId, setMaterialId] = useState("");
  const [delta, setDelta] = useState("");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["almoxarife-rapido-pedidos", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("id, obra_id, material_id, fornecedor_id, quantidade, status, codigo_compra, materiais(nome, unidade), fornecedores(nome)")
        .eq("obra_id", obraId)
        .is("deleted_at", null)
        .in("status", [PEDIDO_STATUS.PRODUCAO, PEDIDO_STATUS.EM_TRANSPORTE, PEDIDO_STATUS.ATRASADO, PEDIDO_STATUS.APROVANDO])
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as PedidoRapido[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["almoxarife-rapido-materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, nome, unidade")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as MaterialResumo[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return pedidos;
    const normalized = search.toLowerCase();
    return pedidos.filter((item) =>
      item.id.toLowerCase().includes(normalized)
      || item.codigo_compra?.toLowerCase().includes(normalized)
      || item.materiais?.nome?.toLowerCase().includes(normalized)
      || item.fornecedores?.nome?.toLowerCase().includes(normalized),
    );
  }, [pedidos, search]);

  const receiveQuick = useMutation({
    mutationFn: async (pedido: PedidoRapido) => {
      if (!obraId) throw new Error("Obra obrigatoria");
      const codigo = (codigoByPedido[pedido.id] ?? pedido.codigo_compra ?? "").trim();
      if (!codigo) throw new Error("Codigo de compra obrigatorio para concluir");

      const pedidoPayload: TablesUpdate<"pedidos_compra"> = {
        status: PEDIDO_STATUS.ENTREGUE,
        codigo_compra: codigo,
        data_recebimento: new Date().toISOString(),
        recebido_por: user?.id ?? null,
      };

      const { error: pedidoError } = await supabase
        .from("pedidos_compra")
        .update(pedidoPayload)
        .eq("id", pedido.id);
      if (pedidoError) throw pedidoError;

      const { data: existing, error: existingError } = await supabase
        .from("estoque_obra_material")
        .select("id, estoque_atual")
        .eq("obra_id", obraId)
        .eq("material_id", pedido.material_id)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        const payload = {
          estoque_atual: Number(existing.estoque_atual) + Number(pedido.quantidade),
          atualizado_em: new Date().toISOString(),
          ultima_atualizacao_estoque: new Date().toISOString(),
          atualizado_por: user?.id ?? null,
          confiabilidade: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("estoque_obra_material")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const insertPayload = {
          obra_id: obraId,
          material_id: pedido.material_id,
          estoque_atual: Number(pedido.quantidade),
          atualizado_por: user?.id ?? null,
          ultima_atualizacao_estoque: new Date().toISOString(),
        } as TablesInsert<"estoque_obra_material"> & { ultima_atualizacao_estoque?: string };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("estoque_obra_material")
          .insert(insertPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["almoxarife-rapido-pedidos", obraId] });
      queryClient.invalidateQueries({ queryKey: ["estoque_obra_material", obraId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos_recebimento", obraId] });
      toast.success("Recebimento confirmado no modo rapido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error("Obra obrigatoria");
      if (!materialId) throw new Error("Selecione um material");

      const change = Number(delta);
      if (!Number.isFinite(change) || change === 0) {
        throw new Error("Informe um ajuste diferente de zero");
      }

      const { data: existing, error: existingError } = await supabase
        .from("estoque_obra_material")
        .select("id, estoque_atual")
        .eq("obra_id", obraId)
        .eq("material_id", materialId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        const next = Number(existing.estoque_atual) + change;
        if (next < 0) throw new Error("Ajuste resultaria em estoque negativo");

        const payload = {
          estoque_atual: next,
          atualizado_em: new Date().toISOString(),
          ultima_atualizacao_estoque: new Date().toISOString(),
          atualizado_por: user?.id ?? null,
          confiabilidade: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("estoque_obra_material")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        if (change < 0) throw new Error("Nao existe estoque para baixa desse material");

        const payload = {
          obra_id: obraId,
          material_id: materialId,
          estoque_atual: change,
          atualizado_por: user?.id ?? null,
          ultima_atualizacao_estoque: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("estoque_obra_material")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_obra_material", obraId] });
      toast.success("Estoque atualizado rapidamente");
      setDelta("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PageShell title="Modo Rapido Almoxarife">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Fluxo rapido de campo</h2>
        <p className="text-sm text-muted-foreground">
          Menos cliques e entrada minima para recebimento e ajuste de estoque.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-border p-4">
        <h3 className="mb-3 text-base font-semibold">Atualizacao rapida de estoque</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Material</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
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
            <Label>Ajuste (+/-)</Label>
            <Input
              type="number"
              step="0.01"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              placeholder="Ex.: 10 ou -5"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => adjustStock.mutate()} disabled={adjustStock.isPending} className="w-full">
              <PlusCircle className="mr-1 h-4 w-4" /> Ajustar
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Recebimentos pendentes</h3>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar pedido/material/fornecedor"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Sem pedidos pendentes para recebimento rapido.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((pedido) => (
            <div key={pedido.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="font-semibold">{pedido.materiais?.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    Pedido {pedido.id.slice(0, 8)} | {pedido.fornecedores?.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Quantidade: {pedido.quantidade} {pedido.materiais?.unidade} | Etapa: {pedidoStatusLabels[pedido.status]}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                  <div>
                    <Label>Codigo compra *</Label>
                    <Input
                      value={codigoByPedido[pedido.id] ?? pedido.codigo_compra ?? ""}
                      onChange={(event) =>
                        setCodigoByPedido((current) => ({ ...current, [pedido.id]: event.target.value }))
                      }
                      placeholder="Obrigatorio"
                    />
                  </div>
                  <Button onClick={() => receiveQuick.mutate(pedido)} disabled={receiveQuick.isPending}>
                    <PackageCheck className="mr-1 h-4 w-4" /> Confirmar recebimento
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default AlmoxarifeRapido;
