import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ProtectedRoute,
  RequireObraAccess,
  RequireObraPermission,
  RequireOperationalAccess,
  RequirePermission,
  RequireRole,
} from "@/components/auth/RouteGuards";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/i18n/I18nProvider";

import Dashboard from "./pages/Dashboard";
import AccessRequestReview from "./pages/AccessRequestReview";
import EstoqueManager from "./pages/EstoqueManager";
import FornecedoresManager from "./pages/FornecedoresManager";
import Index from "./pages/Index";
import Login from "./pages/Login";
import MateriaisManager from "./pages/MateriaisManager";
import MaterialFornecedorManager from "./pages/MaterialFornecedorManager";
import NotFound from "./pages/NotFound";
import ObrasManager from "./pages/ObrasManager";
import PedidosCompraManager from "./pages/PedidosCompraManager";
import RecebimentoManager from "./pages/RecebimentoManager";
import SemAcesso from "./pages/SemAcesso";
import UsuariosAcessos from "./pages/UsuariosAcessos";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/acesso/avaliar" element={<AccessRequestReview />} />

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
                  <SemAcesso />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/obras"
              element={(
                <ProtectedRoute>
                  <RequireOperationalAccess>
                    <RequirePermission permission="obras.view">
                      <ObrasManager />
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
                      <RequireRole allowed={["master", "gestor"]}>
                        <UsuariosAcessos />
                      </RequireRole>
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
                        <FornecedoresManager />
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
                        <MateriaisManager />
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
                        <MaterialFornecedorManager />
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
                          <Dashboard />
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
                          <PedidosCompraManager />
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
                          <RecebimentoManager />
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
                          <EstoqueManager />
                        </RequireObraPermission>
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
