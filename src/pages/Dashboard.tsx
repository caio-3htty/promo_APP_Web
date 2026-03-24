import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BellRing, ChevronLeft, ClipboardList, Layers3, LineChart, LogOut, PackageSearch, RefreshCw, Shuffle, Truck } from "lucide-react";

import logoPrumo from "@/assets/image.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/useI18n";
import { canManageCadastros, roleLabelMap } from "@/lib/rbac";

const Dashboard = () => {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const { role, obras, signOut } = useAuth();
  const { t } = useI18n();

  const obra = obras.find((item) => item.id === obraId);

  const quickActions = useMemo(() => {
    const base = [
      { label: t("orders"), icon: ClipboardList, path: `/dashboard/${obraId}/pedidos` },
      { label: t("receipt"), icon: Truck, path: `/dashboard/${obraId}/recebimento` },
      { label: t("stock"), icon: PackageSearch, path: `/dashboard/${obraId}/estoque` },
      { label: "Alertas", icon: BellRing, path: `/dashboard/${obraId}/alertas` },
      { label: "Substituicoes", icon: Shuffle, path: `/dashboard/${obraId}/substituicoes` },
      { label: "Relatorios", icon: LineChart, path: `/dashboard/${obraId}/relatorios` },
    ];

    if (role === "master" || role === "gestor" || role === "almoxarife") {
      base.push({
        label: "Modo Almoxarife",
        icon: RefreshCw,
        path: `/dashboard/${obraId}/almoxarife`,
      });
    }

    if (canManageCadastros(role)) {
      base.push({
        label: t("registries"),
        icon: Layers3,
        path: "/cadastros/fornecedores",
      });
    }

    return base;
  }, [obraId, role, t]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/obras")} className="mr-1">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <img src={logoPrumo} alt="Prumo" className="h-8 object-contain" />
            <div>
              <h1 className="text-lg font-bold leading-tight">{obra?.name ?? t("dashboardFallbackTitle")}</h1>
              {role && (
                <Badge variant="secondary" className="text-xs">
                  {roleLabelMap[role]}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> {t("logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="animate-fade-in">
          <h2 className="mb-1 text-xl font-semibold">{t("dashboardOverviewTitle")}</h2>
          <p className="mb-6 text-muted-foreground">{obra?.address ?? t("dashboardOverviewSubtitle")}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, i) => (
              <Card
                key={action.label}
                className="cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:shadow-md"
                style={{ animationDelay: `${i * 80}ms` }}
                onClick={() => navigate(action.path)}
              >
                <CardContent className="flex items-center gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <action.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">{action.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
