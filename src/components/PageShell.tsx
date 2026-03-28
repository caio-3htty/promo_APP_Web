import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { canAccessRecebimentoRoute } from "@/lib/rbac";

type NavItem = { label: string; path: string };

export const PageShell = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { obraId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut, can } = useAuth();

  const inObraRoute = !!obraId && location.pathname.startsWith(`/dashboard/${obraId}`);

  const obraNav: NavItem[] = [
    { label: "Dashboard", path: `/dashboard/${obraId}` },
    { label: "Pedidos", path: `/dashboard/${obraId}/pedidos` },
    ...(canAccessRecebimentoRoute(role) && !!obraId && (can("pedidos.view", obraId) || can("pedidos.receive", obraId))
      ? [
          { label: "Recebimento", path: `/dashboard/${obraId}/recebimento` },
          ...(can("estoque.view", obraId) ? [{ label: "Estoque", path: `/dashboard/${obraId}/estoque` }] : []),
          ...(role === "master" || role === "gestor" || role === "almoxarife"
            ? [{ label: "Almoxarife Rapido", path: `/dashboard/${obraId}/almoxarife` }]
            : []),
          ...(role === "master" || role === "gestor" || role === "engenheiro" || role === "almoxarife"
            ? [{ label: "Alertas", path: `/dashboard/${obraId}/alertas` }]
            : []),
          ...(role === "master" || role === "gestor" || role === "engenheiro"
            ? [{ label: "Substituicoes", path: `/dashboard/${obraId}/substituicoes` }]
            : []),
          ...(role === "master" || role === "gestor" || role === "engenheiro"
            ? [{ label: "Relatorios", path: `/dashboard/${obraId}/relatorios` }]
            : []),
        ]
      : []),
  ];

  const globalNav: NavItem[] = [
    { label: "Obras", path: "/obras" },
    ...(can("fornecedores.view") || can("materiais.view") || can("material_fornecedor.view")
      ? [
          ...(can("fornecedores.view") ? [{ label: "Fornecedores", path: "/cadastros/fornecedores" }] : []),
          ...(can("materiais.view") ? [{ label: "Materiais", path: "/cadastros/materiais" }] : []),
          ...(can("material_fornecedor.view") ? [{ label: "Material x Fornecedor", path: "/cadastros/material-fornecedor" }] : []),
        ]
      : []),
    ...(can("users.manage") ? [{ label: "Usuarios e Acessos", path: "/usuarios-acessos" }] : []),
  ];

  const navItems = inObraRoute ? obraNav : globalNav;
  const goBackPath = inObraRoute ? `/dashboard/${obraId}` : "/";
  const handleBack = () => {
    const historyIndex = typeof window !== "undefined" ? window.history.state?.idx : undefined;
    const canGoBackInApp = typeof historyIndex === "number" && historyIndex > 0;
    if (canGoBackInApp) {
      navigate(-1);
      return;
    }
    navigate(goBackPath);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {children}
      </main>
    </div>
  );
};
