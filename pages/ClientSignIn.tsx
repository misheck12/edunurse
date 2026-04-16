import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { useAuth } from "../src/context/AuthContext";
import { signinClient } from "../src/services/backendApi";
import SEO from "../src/components/SEO";
import AuthPageLayout, {
  authButtonClassName,
  authInlineLinkClassName,
  authInputWithIconClassName,
  authLabelClassName,
  getAuthAlertClassName,
} from "../src/components/auth/AuthPageLayout";

const ClientSignIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const redirectTo =
    typeof (location.state as { from?: string } | null)?.from === "string"
      ? (location.state as { from: string }).from
      : "/";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signinClient({ email, password });
      await refreshUser();
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <>
      <div className="text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link to="/signup" className={authInlineLinkClassName}>
          Create one
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
        <Link to="/terms" className="transition-colors hover:text-slate-900">
          Terms of Service
        </Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/privacy" className="transition-colors hover:text-slate-900">
          Privacy Policy
        </Link>
      </div>
    </>
  );

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to EduNurse Pro. Access AI-powered lesson plan generation for nursing and midwifery educators."
        canonicalPath="/signin"
      />
      <AuthPageLayout
        eyebrow="Client access"
        title="Client Sign In"
        description="Sign in to your educator account."
        contentWidthClassName="max-w-lg"
        footer={footer}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && <div className={getAuthAlertClassName()}>{errorMessage}</div>}

          <div className="space-y-2">
            <label htmlFor="signin-email" className={authLabelClassName}>
              Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                required
                disabled={isSubmitting}
                className={authInputWithIconClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="signin-password" className={authLabelClassName}>
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                className={authInputWithIconClassName}
              />
            </div>
          </div>

          <div className="flex items-center justify-end text-sm">
            <Link to="/forgot-password" className={authInlineLinkClassName}>
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={authButtonClassName}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </AuthPageLayout>
    </>
  );
};

export default ClientSignIn;
