import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import logoPrumo from "@/assets/image.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/useI18n";
import { supabase } from "@/integrations/supabase/client";

type SignupMode = "company_owner" | "company_internal";
type AppRole = "master" | "gestor" | "engenheiro" | "operacional" | "almoxarife";

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "master", label: "Master" },
  { value: "gestor", label: "Gestor" },
  { value: "engenheiro", label: "Engenheiro" },
  { value: "operacional", label: "Operacional" },
  { value: "almoxarife", label: "Almoxarife" },
];

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupMode, setSignupMode] = useState<SignupMode>("company_owner");
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [requestedRole, setRequestedRole] = useState<AppRole>("operacional");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const action = signupMode === "company_owner" ? "register_company" : "register_internal";
        const payload = {
          action,
          email: email.trim().toLowerCase(),
          password,
          fullName: fullName.trim(),
          username: (username.trim() || fullName.trim()),
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          requestedRole: signupMode === "company_owner" ? "master" : requestedRole,
          origin: window.location.origin,
        };

        const { data, error } = await supabase.functions.invoke("account-access-request", {
          body: payload,
        });

        if (error || !data?.ok) {
          const message = (data?.message ?? error?.message ?? "").toLowerCase();

          if (message.includes("empresa") && message.includes("não encontrada")) {
            toast.error("Empresa não encontrada", {
              description: "Confira o nome da empresa ou solicite primeiro a criação da conta empresa.",
            });
          } else if (message.includes("empresa") && message.includes("já existe")) {
            toast.error("Empresa já cadastrada", {
              description: "Use o fluxo de conta interna para solicitar acesso.",
            });
          } else if (message.includes("já está cadastrado") || message.includes("already")) {
            toast.error("E-mail já cadastrado", {
              description: "Use outro e-mail ou recupere a senha da conta existente.",
            });
          } else {
            toast.error(data?.message ?? error?.message ?? "Erro ao criar solicitação.", {
              description: t("createAccountError"),
            });
          }
        } else {
          if (signupMode === "company_owner") {
            toast.success("Conta empresa criada", {
              description: "A conta master foi criada com sucesso. Faça login para continuar.",
            });
          } else {
            toast.success("Solicitação enviada", {
              description:
                "A empresa recebeu um e-mail para aprovar, rejeitar ou editar seu usuário e cargo. A senha não é compartilhada.",
            });
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          const message = error.message.toLowerCase();
          if (message.includes("invalid login credentials")) {
            toast.error("Credenciais inválidas", {
              description: "E-mail/senha incorretos ou conta ainda não existe neste ambiente.",
            });
          } else if (message.includes("email not confirmed")) {
            toast.error("E-mail não confirmado", {
              description: "Confirme seu e-mail antes de entrar.",
            });
          } else {
            toast.error(error.message, { description: t("signInError") });
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-end">
            <LanguageSwitcher />
          </div>
          <img src={logoPrumo} alt="Prumo" className="mx-auto mb-4 h-16 object-contain" />
          <p className="mt-1 text-muted-foreground">{t("centralControl")}</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{isSignUp ? t("signupTitle") : t("loginTitle")}</CardTitle>
            <CardDescription>{isSignUp ? t("signupSubtitle") : t("loginSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder={t("fullNamePlaceholder")}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                </div>
              )}

              {isSignUp && (
                <div className="space-y-2">
                  <Label>Tipo de cadastro</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={signupMode === "company_owner" ? "default" : "outline"}
                      onClick={() => setSignupMode("company_owner")}
                    >
                      Conta empresa
                    </Button>
                    <Button
                      type="button"
                      variant={signupMode === "company_internal" ? "default" : "outline"}
                      onClick={() => setSignupMode("company_internal")}
                    >
                      Conta interna
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("corporateEmailPlaceholder")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da empresa</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Nome oficial da empresa"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    required
                  />
                </div>
              )}

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário (nome exibido)</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Nome do usuário"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </div>
              )}

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Cargo</Label>
                  <Input
                    id="jobTitle"
                    type="text"
                    placeholder="Ex.: Comprador, Engenheiro, Almoxarife"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    required
                  />
                </div>
              )}

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="requestedRole">Perfil de acesso</Label>
                  <select
                    id="requestedRole"
                    value={requestedRole}
                    onChange={(event) => setRequestedRole(event.target.value as AppRole)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    disabled={signupMode === "company_owner"}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  {signupMode === "company_owner" ? (
                    <p className="text-xs text-muted-foreground">
                      Conta empresa sempre nasce como Master.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Se a empresa não existir, o cadastro será bloqueado e você verá o aviso.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {t("loading")}
                  </span>
                ) : isSignUp ? (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> {t("createAccount")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> {t("signIn")}
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp((current) => !current)}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {isSignUp ? t("hasAccount") : t("noAccount")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
