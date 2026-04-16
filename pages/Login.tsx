import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { useAuth } from "../src/context/AuthContext";
import { loginSuperadmin } from "../src/services/backendApi";
import AuthPageLayout, {
  authButtonClassName,
  authInputWithIconClassName,
  authLabelClassName,
  getAuthAlertClassName,
} from "../src/components/auth/AuthPageLayout";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [email, setEmail] = React.useState("superadmin@edunurse.local");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setErrorMessage(state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await loginSuperadmin({ email, password });
      await refreshUser();
      navigate(response.user.role === "admin" ? "/ops" : "/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Login failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      brandHref="/ops/login"
      eyebrow="Admin access"
      title="Welcome back"
      description="Please enter your details to access your curriculum tools."
      contentWidthClassName="max-w-lg"
      footer={
        <p className="text-center text-sm text-slate-600">
          Superadmin login only.
        </p>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
        {errorMessage && (
          <div
            className={getAuthAlertClassName(
              errorMessage.includes("Session expired") ? "warning" : "error",
            )}
          >
            {errorMessage}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="admin-email" className={authLabelClassName}>
            Email Address
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Mail size={18} />
            </div>
            <input
              id="admin-email"
              type="email"
              placeholder="superadmin@edunurse.local"
              className={authInputWithIconClassName}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="admin-password" className={authLabelClassName}>
            Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Lock size={18} />
            </div>
            <input
              id="admin-password"
              type="password"
              className={authInputWithIconClassName}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={authButtonClassName}
        >
          {isSubmitting ? "Signing In..." : "Sign In"}
        </button>
      </form>
    </AuthPageLayout>
  );
};

export default Login;
