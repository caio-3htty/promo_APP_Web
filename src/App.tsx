import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ProtectedRoute,
  RequireObraAccess,
  RequireObraPermission,
  RequireOperationalAccess,
  RequireRole,
  RequirePermission,
} from "@/components/auth/RouteGuards";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/i18n/I18nProvider";

import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const AccessRequestReview = lazy(() => import("./pages/AccessRequestReview"));
const AlertasManager = lazy(() => import("./pages/AlertasManager"));
const AlmoxarifeRapido = lazy(() => import("./pages/AlmoxarifeRapido"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EstoqueManager = lazy(() => import("./pages/EstoqueManager"));
const FornecedoresManager = lazy(() => import("./pages/FornecedoresManager"));
const MateriaisManager = lazy(() => import("./pages/MateriaisManager"));
const MaterialFornecedorManager = lazy(() => import("./pages/MaterialFornecedorManager"));
const ObrasManager = lazy(() => import("./pages/ObrasManager"));
const PedidosCompraManager = lazy(() => import("./pages/PedidosCompraManager"));
const RecebimentoManager = lazy(() => import("./pages/RecebimentoManager"));
const RelatoriosPedidos = lazy(() => import("./pages/RelatoriosPedidos"));
const SemAcesso = lazy(() => import("./pages/SemAcesso"));
const SubstituicoesManager = lazy(() => import("./pages/SubstituicoesManager"));
const UsuariosAcessos = lazy(() => import("./pages/UsuariosAcessos"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="p-4 text-sm text-muted-foreground">Carregando modulo...</div>
);

const lazyPage = (element: ReactElement) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/acesso/avaliar" element={lazyPage(<AccessRequestReview />)} />

              <Route
                path="/"
                element={(
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/sem-acesso"
                element={(
                  <ProtectedRoute>
                    {lazyPage(<SemAcesso />)}
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/obras"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequirePermission permission="obras.view">
                        {lazyPage(<ObrasManager />)}
                      </RequirePermission>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/usuarios-acessos"
                element={(
                  <ProtectedRoute>
                    <RequirePermission permission="users.manage">
                      {lazyPage(<UsuariosAcessos />)}
                    </RequirePermission>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/cadastros/fornecedores"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequirePermission permission="fornecedores.view">
                        {lazyPage(<FornecedoresManager />)}
                      </RequirePermission>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/cadastros/materiais"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequirePermission permission="materiais.view">
                        {lazyPage(<MateriaisManager />)}
                      </RequirePermission>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/cadastros/material-fornecedor"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequirePermission permission="material_fornecedor.view">
                        {lazyPage(<MaterialFornecedorManager />)}
                      </RequirePermission>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />

              <Route
                path="/dashboard/:obraId"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequireObraAccess>
                        <RequireObraPermission permission="obras.view">
                          {lazyPage(<Dashboard />)}
                        </RequireObraPermission>
                      </RequireObraAccess>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/pedidos"
                element={(
                  <ProtectedRoute>
                    <RequireOperationalAccess>
                      <RequireObraAccess>
                        <RequireObraPermission permission="pedidos.view">
                          {lazyPage(<PedidosCompraManager />)}
                        </RequireObraPermission>
                      </RequireObraAccess>
                    </RequireOperationalAccess>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/recebimento"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "almoxarife", "engenheiro"]}>
                      <RequireObraAccess>
                        <RequireObraPermission anyOf={["pedidos.view", "pedidos.receive"]}>
                          {lazyPage(<RecebimentoManager />)}
                        </RequireObraPermission>
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/estoque"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "almoxarife", "engenheiro"]}>
                      <RequireObraAccess>
                        <RequireObraPermission permission="estoque.view">
                          {lazyPage(<EstoqueManager />)}
                        </RequireObraPermission>
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/alertas"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "almoxarife", "engenheiro"]}>
                      <RequireObraAccess>
                        {lazyPage(<AlertasManager />)}
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/substituicoes"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "engenheiro"]}>
                      <RequireObraAccess>
                        {lazyPage(<SubstituicoesManager />)}
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/almoxarife"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "almoxarife"]}>
                      <RequireObraAccess>
                        {lazyPage(<AlmoxarifeRapido />)}
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard/:obraId/relatorios"
                element={(
                  <ProtectedRoute>
                    <RequireRole allowed={["master", "gestor", "engenheiro"]}>
                      <RequireObraAccess>
                        {lazyPage(<RelatoriosPedidos />)}
                      </RequireObraAccess>
                    </RequireRole>
                  </ProtectedRoute>
                )}
              />

              <Route path="/fornecedores" element={<Navigate to="/cadastros/fornecedores" replace />} />
              <Route path="/materiais" element={<Navigate to="/cadastros/materiais" replace />} />
              <Route path="/material-fornecedor" element={<Navigate to="/cadastros/material-fornecedor" replace />} />
              <Route path="/pedidos" element={<Navigate to="/obras" replace />} />
              <Route path="/recebimento" element={<Navigate to="/obras" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
