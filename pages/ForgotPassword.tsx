import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import SEO from "../src/components/SEO";
import AuthPageLayout, {
  authButtonClassName,
  authInlineLinkClassName,
  authInputWithIconClassName,
  authLabelClassName,
  authMutedLinkClassName,
  getAuthAlertClassName,
} from "../src/components/auth/AuthPageLayout";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/auth/request-password-reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to send reset email");
      }

      setSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to send reset email. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        eyebrow="Password recovery"
        title="Check Your Email"
        description={
          <>
            If an account exists with <strong>{email}</strong>, you&apos;ll receive a
            password reset link shortly.
          </>
        }
        contentWidthClassName="max-w-lg"
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Mail className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-sm text-slate-500">
            The link will expire in 1 hour for security reasons.
          </p>
          <Link
            to="/signin"
            className={`inline-flex items-center justify-center gap-2 ${authInlineLinkClassName}`}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <>
      <SEO
        title="Forgot Password"
        description="Reset your EduNurse Pro password."
        canonicalPath="/forgot-password"
        noIndex
      />
      <AuthPageLayout
        eyebrow="Password recovery"
        title="Forgot Password?"
        description="Enter your email address and we'll send you a link to reset your password."
        contentWidthClassName="max-w-lg"
        footer={
          <div className="text-center">
            <Link
              to="/signin"
              className={`inline-flex items-center gap-2 text-sm ${authMutedLinkClassName}`}
            >
              <ArrowLeft size={16} />
              Back to Sign In
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && <div className={getAuthAlertClassName()}>{errorMessage}</div>}

          <div className="space-y-2">
            <label htmlFor="forgot-email" className={authLabelClassName}>
              Email Address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                required
                disabled={isSubmitting}
                placeholder="your-email@example.com"
                className={authInputWithIconClassName}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={authButtonClassName}
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      </AuthPageLayout>
    </>
  );
};

export default ForgotPassword;
