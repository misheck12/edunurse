import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Lock } from "lucide-react";
import AuthPageLayout, {
  authButtonClassName,
  authInputWithIconClassName,
  authLabelClassName,
  authMutedLinkClassName,
  getAuthAlertClassName,
} from "../src/components/auth/AuthPageLayout";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthPageLayout
        eyebrow="Password recovery"
        title="Invalid Link"
        description="This password reset link is invalid or has expired."
        contentWidthClassName="max-w-lg"
      >
        <div className="text-center">
          <Link to="/forgot-password" className={authButtonClassName}>
            Request New Link
          </Link>
        </div>
      </AuthPageLayout>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to reset password");
      }

      setSuccess(true);
      setTimeout(() => navigate("/signin"), 3000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to reset password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        eyebrow="Password recovery"
        title="Password Reset!"
        description="Your password has been successfully reset. Redirecting to sign in..."
        contentWidthClassName="max-w-lg"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      eyebrow="Password recovery"
      title="Reset Password"
      description="Enter your new password below."
      contentWidthClassName="max-w-lg"
      footer={
        <div className="text-center">
          <Link to="/signin" className={`text-sm ${authMutedLinkClassName}`}>
            Back to Sign In
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && <div className={getAuthAlertClassName()}>{errorMessage}</div>}

        <div className="space-y-2">
          <label htmlFor="reset-new-password" className={authLabelClassName}>
            New Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Lock size={18} />
            </div>
            <input
              id="reset-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isSubmitting}
              placeholder="At least 8 characters"
              className={authInputWithIconClassName}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="reset-confirm-password" className={authLabelClassName}>
            Confirm Password
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Lock size={18} />
            </div>
            <input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={isSubmitting}
              placeholder="Re-enter password"
              className={authInputWithIconClassName}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={authButtonClassName}
        >
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </AuthPageLayout>
  );
};

export default ResetPassword;
