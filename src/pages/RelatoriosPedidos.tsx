import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Mail, RefreshCcw } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { PEDIDO_STATUS, pedidoStatusLabels } from "@/lib/pedidoStatus";

type PedidoRelatorio = {
  id: string;
  status: string;
  codigo_compra: string | null;
  criado_em: string;
  total: number;
  materiais: { nome: string } | null;
  fornecedores: { nome: string } | null;
};

const downloadBase64Pdf = (base64: string, fileName: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const RelatoriosPedidos = () => {
  const { obraId } = useParams();
  const [pedidoId, setPedidoId] = useState("");
  const [emailTo, setEmailTo] = useState("");

  const { data: pedidos = [], isLoading, refetch } = useQuery({
    queryKey: ["relatorios-pedidos", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_compra")
        .select("id, status, codigo_compra, criado_em, total, materiais(nome), fornecedores(nome)")
        .eq("obra_id", obraId)
        .is("deleted_at", null)
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PedidoRelatorio[];
    },
  });

  const { data: extraMetrics } = useQuery({
    queryKey: ["relatorios-metricas", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const [alertsRes, incidentsRes, auditRes] = await Promise.all([
        supabaseAny.from("notificacoes").select("id", { count: "exact", head: true }).eq("obra_id", obraId).neq("status", "encerrada"),
        supabaseAny.from("incidentes_substituicao_material").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabaseAny.from("audit_log").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
      ]);

      if (alertsRes.error) throw alertsRes.error;
      if (incidentsRes.error) throw incidentsRes.error;
      if (auditRes.error) throw auditRes.error;

      return {
        activeAlerts: Number(alertsRes.count ?? 0),
        substitutions: Number(incidentsRes.count ?? 0),
        events: Number(auditRes.count ?? 0),
      };
    },
  });

  const metrics = useMemo(() => {
    const total = pedidos.length;
    const entregues = pedidos.filter((item) => item.status === PEDIDO_STATUS.ENTREGUE).length;
    const atrasados = pedidos.filter((item) => item.status === PEDIDO_STATUS.ATRASADO).length;

    return {
      total,
      entregues,
      atrasados,
      activeAlerts: extraMetrics?.activeAlerts ?? 0,
      substitutions: extraMetrics?.substitutions ?? 0,
      events: extraMetrics?.events ?? 0,
    };
  }, [pedidos, extraMetrics]);

  const generateReport = useMutation({
    mutationFn: async (sendEmail: boolean) => {
      if (!pedidoId) throw new Error("Selecione um pedido");
      if (sendEmail && !emailTo.trim()) throw new Error("Informe e-mail de destino");

      const { data, error } = await supabase.functions.invoke("pedido-report", {
        body: {
          pedidoId,
          to: sendEmail ? emailTo.trim() : undefined,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error ?? error?.message ?? "Falha ao gerar relatorio");
      }

      if (data.pdfBase64) {
        downloadBase64Pdf(data.pdfBase64, `pedido-${pedidoId.slice(0, 8)}.pdf`);
      }

      return data;
    },
    onSuccess: (_data, sendEmail) => {
      toast.success(sendEmail ? "PDF gerado e enviado por e-mail" : "PDF gerado com sucesso");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PageShell title="Relatorios de Pedidos">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Relatorios operacionais</h2>
          <p className="text-sm text-muted-foreground">
            Compare previsto x real, atrasos, substituicoes e responsaveis por pedido.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCcw className="mr-1 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Pedidos</p><p className="text-xl font-semibold">{metrics.total}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-xl font-semibold">{metrics.entregues}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Atrasados</p><p className="text-xl font-semibold text-destructive">{metrics.atrasados}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Alertas ativos</p><p className="text-xl font-semibold">{metrics.activeAlerts}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Substituicoes</p><p className="text-xl font-semibold">{metrics.substitutions}</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Eventos auditados</p><p className="text-xl font-semibold">{metrics.events}</p></div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-4 text-base font-semibold">Gerar relatorio PDF por pedido</h3>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando pedidos...</p>
        ) : pedidos.length === 0 ? (
          <p className="text-muted-foreground">Sem pedidos nesta obra.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Pedido</Label>
              <Select value={pedidoId} onValueChange={setPedidoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pedido" />
                </SelectTrigger>
                <SelectContent>
                  {pedidos.map((pedido) => (
                    <SelectItem key={pedido.id} value={pedido.id}>
                      {pedido.id.slice(0, 8)} - {pedido.materiais?.nome ?? "Material"} ({pedidoStatusLabels[pedido.status as keyof typeof pedidoStatusLabels] ?? pedido.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>E-mail destino (opcional para envio)</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={(event) => setEmailTo(event.target.value)}
                placeholder="engenheiro@empresa.com"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => generateReport.mutate(false)} disabled={generateReport.isPending || !pedidoId}>
            <Download className="mr-1 h-4 w-4" /> Gerar PDF
          </Button>
          <Button variant="outline" onClick={() => generateReport.mutate(true)} disabled={generateReport.isPending || !pedidoId}>
            <Mail className="mr-1 h-4 w-4" /> Gerar + enviar e-mail
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

export default RelatoriosPedidos;
