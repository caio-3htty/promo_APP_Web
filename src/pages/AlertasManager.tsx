import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type AlertItem = {
  id: string;
  tipo: string;
  severidade: "info" | "warning" | "critical";
  titulo: string;
  mensagem: string;
  status: "aberta" | "acknowledged" | "escalada" | "encerrada";
  obra_id: string | null;
  created_at: string;
  ack_em: string | null;
  encerrada_em: string | null;
  metadata: Record<string, unknown>;
};

const severityVariant = (severity: AlertItem["severidade"]) => {
  switch (severity) {
    case "critical":
      return "destructive" as const;
    case "warning":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const statusLabel: Record<AlertItem["status"], string> = {
  aberta: "Aberta",
  acknowledged: "Assumida",
  escalada: "Escalada",
  encerrada: "Encerrada",
};

const AlertasManager = () => {
  const { obraId } = useParams();
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["notificacoes", obraId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      let query = supabaseAny
        .from("notificacoes")
        .select("id, tipo, severidade, titulo, mensagem, status, obra_id, created_at, ack_em, encerrada_em, metadata")
        .order("created_at", { ascending: false })
        .limit(200);

      if (obraId) {
        query = query.eq("obra_id", obraId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AlertItem[];
    },
  });

  const runCycle = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const { data, error } = await supabaseAny.rpc("executar_ciclo_notificacoes", {
        _tenant_id: tenantId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes", obraId] });
      toast.success("Ciclo de alertas executado", {
        description: `Criados: ${data?.created ?? 0} | Repetidos: ${data?.repeated ?? 0} | Escalados: ${data?.escalated ?? 0}`,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ackAlert = useMutation({
    mutationFn: async (alertId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const note = noteById[alertId]?.trim() || null;
      const { error } = await supabaseAny.rpc("ack_notificacao", {
        _notificacao_id: alertId,
        _nota: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes", obraId] });
      toast.success("Alerta assumido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny.rpc("encerrar_notificacao", {
        _notificacao_id: alertId,
        _motivo: "Encerrado pela operacao",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes", obraId] });
      toast.success("Alerta encerrado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const abertas = alerts.filter((item) => item.status !== "encerrada").length;
  const criticas = alerts.filter((item) => item.severidade === "critical" && item.status !== "encerrada").length;

  return (
    <PageShell title="Alertas e Decisoes">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Motor de Alertas</h2>
          <p className="text-sm text-muted-foreground">
            Alertas ativos com ACK, escalonamento e acompanhamento operacional.
          </p>
        </div>
        <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending}>
          <RefreshCcw className="mr-1 h-4 w-4" />
          Executar ciclo
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase text-muted-foreground">Alertas ativos</p>
          <p className="mt-1 text-2xl font-semibold">{abertas}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase text-muted-foreground">Criticos abertos</p>
          <p className="mt-1 text-2xl font-semibold text-destructive">{criticas}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase text-muted-foreground">Total monitorado</p>
          <p className="mt-1 text-2xl font-semibold">{alerts.length}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando alertas...</p>
      ) : alerts.length === 0 ? (
        <p className="text-muted-foreground">Sem alertas para esta obra.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant(alert.severidade)}>{alert.severidade}</Badge>
                    <Badge variant="outline">{statusLabel[alert.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <h3 className="text-base font-semibold">{alert.titulo}</h3>
                  <p className="text-sm text-muted-foreground">{alert.mensagem}</p>
                  <p className="text-xs text-muted-foreground">Tipo: {alert.tipo}</p>
                </div>

                <div className="w-full max-w-sm space-y-2">
                  <Input
                    value={noteById[alert.id] ?? ""}
                    onChange={(event) => setNoteById((current) => ({ ...current, [alert.id]: event.target.value }))}
                    placeholder="Nota de assuncao (opcional)"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => ackAlert.mutate(alert.id)}
                      disabled={alert.status === "encerrada" || ackAlert.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      OK / Assumir
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => closeAlert.mutate(alert.id)}
                      disabled={alert.status === "encerrada" || closeAlert.isPending}
                    >
                      <ShieldAlert className="mr-1 h-4 w-4" />
                      Encerrar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default AlertasManager;
