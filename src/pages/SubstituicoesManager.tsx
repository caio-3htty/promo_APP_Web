import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type PedidoResumo = {
  id: string;
  fornecedor_id: string;
  codigo_compra: string | null;
  status: string;
  materiais: { nome: string } | null;
};

type MaterialResumo = {
  id: string;
  nome: string;
  unidade: string;
};

type FornecedorResumo = {
  id: string;
  nome: string;
};

type Incidente = {
  id: string;
  pedido_id: string | null;
  material_planejado_id: string;
  material_substituto_id: string;
  motivo: string;
  quantidade_planejada: number;
  quantidade_substituto: number;
  custo_planejado_unit: number;
  custo_substituto_unit: number;
  necessita_reposicao: boolean;
  pedido_reposicao_id: string | null;
  status: "aberto" | "pendente_reposicao" | "resolvido";
  created_at: string;
};

const statusColor = (status: Incidente["status"]) => {
  switch (status) {
    case "pendente_reposicao":
      return "destructive" as const;
    case "resolvido":
      return "default" as const;
    default:
      return "secondary" as const;
  }
};

const SubstituicoesManager = () => {
  const { obraId } = useParams();
  const queryClient = useQueryClient();

  const [pedidoId, setPedidoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [materialPlanejadoId, setMaterialPlanejadoId] = useState("");
  const [materialSubstitutoId, setMaterialSubstitutoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [qtdPlanejada, setQtdPlanejada] = useState("");
  const [qtdSubstituto, setQtdSubstituto] = useState("");
  const [custoPlanejado, setCustoPlanejado] = useState("");
  const [custoSubstituto, setCustoSubstituto] = useState("");
  const [codigoCompra, setCodigoCompra] = useState("");
  const [gerarReposicao, setGerarReposicao] = useState(true);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["substituicao-pedidos", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("id, fornecedor_id, codigo_compra, status, materiais(nome)")
        .eq("obra_id", obraId)
        .is("deleted_at", null)
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as PedidoResumo[];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["substituicao-materiais"],
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

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["substituicao-fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as FornecedorResumo[];
    },
  });

  const { data: incidentes = [], isLoading } = useQuery({
    queryKey: ["incidentes-substituicao", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny
        .from("incidentes_substituicao_material")
        .select("id, pedido_id, material_planejado_id, material_substituto_id, motivo, quantidade_planejada, quantidade_substituto, custo_planejado_unit, custo_substituto_unit, necessita_reposicao, pedido_reposicao_id, status, created_at")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Incidente[];
    },
  });

  const materialById = useMemo(() => {
    const map = new Map<string, MaterialResumo>();
    materiais.forEach((item) => map.set(item.id, item));
    return map;
  }, [materiais]);

  const registerSubstitution = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error("Obra obrigatoria");
      if (!materialPlanejadoId || !materialSubstitutoId) throw new Error("Selecione materiais planejado e substituto");
      if (!motivo.trim()) throw new Error("Motivo obrigatorio");
      if (Number(qtdPlanejada) <= 0 || Number(qtdSubstituto) <= 0) {
        throw new Error("Quantidades devem ser maiores que zero");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny.rpc("register_material_substitution", {
        _obra_id: obraId,
        _pedido_id: pedidoId || null,
        _material_planejado_id: materialPlanejadoId,
        _material_substituto_id: materialSubstitutoId,
        _motivo: motivo.trim(),
        _quantidade_planejada: Number(qtdPlanejada),
        _quantidade_substituto: Number(qtdSubstituto),
        _custo_planejado_unit: Number(custoPlanejado || 0),
        _custo_substituto_unit: Number(custoSubstituto || 0),
        _gerar_reposicao: gerarReposicao,
        _fornecedor_id: fornecedorId || null,
        _codigo_compra: codigoCompra || null,
        _observacoes: "registrado pela tela de substituicoes",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["incidentes-substituicao", obraId] });
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra", obraId] });
      toast.success("Substituicao registrada", {
        description: data?.pedido_reposicao_id
          ? `Pedido de reposicao gerado: ${String(data.pedido_reposicao_id).slice(0, 8)}`
          : "Sem pedido de reposicao automatico",
      });

      setPedidoId("");
      setFornecedorId("");
      setMaterialPlanejadoId("");
      setMaterialSubstitutoId("");
      setMotivo("");
      setQtdPlanejada("");
      setQtdSubstituto("");
      setCustoPlanejado("");
      setCustoSubstituto("");
      setCodigoCompra("");
      setGerarReposicao(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolveIncident = useMutation({
    mutationFn: async (incidentId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from("incidentes_substituicao_material")
        .update({ status: "resolvido", updated_at: new Date().toISOString() })
        .eq("id", incidentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidentes-substituicao", obraId] });
      toast.success("Incidente marcado como resolvido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PageShell title="Substituicoes de Material">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Substituicao e Reposicao</h2>
          <p className="text-sm text-muted-foreground">
            Registre o material utilizado em substituicao e gere reposicao futura automaticamente.
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["incidentes-substituicao", obraId] })}>
          <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="mb-8 rounded-lg border border-border p-4">
        <h3 className="mb-4 text-base font-semibold">Novo registro de substituicao</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Pedido original (opcional)</Label>
            <Select value={pedidoId || "none"} onValueChange={(value) => setPedidoId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pedido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem pedido</SelectItem>
                {pedidos.map((pedido) => (
                  <SelectItem key={pedido.id} value={pedido.id}>
                    {pedido.id.slice(0, 8)} - {pedido.materiais?.nome ?? "Material"} ({pedido.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fornecedor para reposicao</Label>
            <Select value={fornecedorId || "none"} onValueChange={(value) => setFornecedorId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Usar fornecedor do pedido</SelectItem>
                {fornecedores.map((fornecedor) => (
                  <SelectItem key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Material planejado *</Label>
            <Select value={materialPlanejadoId} onValueChange={setMaterialPlanejadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
            <Label>Material utilizado *</Label>
            <Select value={materialSubstitutoId} onValueChange={setMaterialSubstitutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
            <Label>Qtd planejada *</Label>
            <Input type="number" min="0" step="0.01" value={qtdPlanejada} onChange={(event) => setQtdPlanejada(event.target.value)} />
          </div>

          <div>
            <Label>Qtd utilizada *</Label>
            <Input type="number" min="0" step="0.01" value={qtdSubstituto} onChange={(event) => setQtdSubstituto(event.target.value)} />
          </div>

          <div>
            <Label>Custo unitario planejado</Label>
            <Input type="number" min="0" step="0.01" value={custoPlanejado} onChange={(event) => setCustoPlanejado(event.target.value)} />
          </div>

          <div>
            <Label>Custo unitario substituto</Label>
            <Input type="number" min="0" step="0.01" value={custoSubstituto} onChange={(event) => setCustoSubstituto(event.target.value)} />
          </div>

          <div>
            <Label>Codigo de compra (reposicao)</Label>
            <Input value={codigoCompra} onChange={(event) => setCodigoCompra(event.target.value)} placeholder="Opcional" />
          </div>

          <div className="flex items-center gap-3 pt-7">
            <Switch checked={gerarReposicao} onCheckedChange={setGerarReposicao} />
            <Label>Gerar pedido de reposicao automaticamente</Label>
          </div>
        </div>

        <div className="mt-4">
          <Label>Motivo *</Label>
          <Textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Explique a substituicao e impacto operacional"
            rows={3}
          />
        </div>

        <div className="mt-4">
          <Button onClick={() => registerSubstitution.mutate()} disabled={registerSubstitution.isPending || !obraId}>
            <Plus className="mr-1 h-4 w-4" />
            Registrar substituicao
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">Historico de substituicoes</h3>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : incidentes.length === 0 ? (
          <p className="text-muted-foreground">Sem substituicoes registradas nesta obra.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Planejado -&gt; Utilizado</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-left">Impacto</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reposicao</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {incidentes.map((incidente) => {
                  const materialPlanejado = materialById.get(incidente.material_planejado_id)?.nome ?? incidente.material_planejado_id.slice(0, 8);
                  const materialSubstituto = materialById.get(incidente.material_substituto_id)?.nome ?? incidente.material_substituto_id.slice(0, 8);
                  const impacto = (incidente.custo_substituto_unit - incidente.custo_planejado_unit) * incidente.quantidade_substituto;

                  return (
                    <tr key={incidente.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs">{new Date(incidente.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        {materialPlanejado} <span className="text-muted-foreground">{"->"}</span> {materialSubstituto}
                        <p className="text-xs text-muted-foreground">{incidente.motivo}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {incidente.quantidade_planejada} / {incidente.quantidade_substituto}
                      </td>
                      <td className="px-4 py-3">
                        <span className={impacto > 0 ? "text-destructive" : "text-emerald-700"}>
                          {impacto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColor(incidente.status)}>{incidente.status}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {incidente.pedido_reposicao_id ? incidente.pedido_reposicao_id.slice(0, 8) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {incidente.status !== "resolvido" && (
                          <Button size="sm" variant="outline" onClick={() => resolveIncident.mutate(incidente.id)}>
                            Marcar resolvido
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default SubstituicoesManager;
