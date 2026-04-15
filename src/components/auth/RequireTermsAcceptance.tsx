import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { acceptTerms } from "../../services/backendApi";
import { ShieldCheck, FileText, Loader2 } from "lucide-react";

/**
 * Gate component that blocks access to the app until the user has accepted
 * the Terms & Conditions and Privacy Policy.
 *
 * Placed inside RequireClient → wraps the authenticated shell.
 * Existing users who signed up before the T&C feature will see this once.
 */
const RequireTermsAcceptance: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const { user, refreshUser } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user has already accepted terms, render children
  if (user?.termsAcceptedAt) {
    return children;
  }

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await acceptTerms();
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Terms & Privacy</h1>
            <p className="text-sm text-slate-500">Please review and accept to continue</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          Before using EduNurse Pro, you must agree to our Terms and Conditions and
          acknowledge our Privacy Policy. These documents explain how the platform works,
          your rights, and how we handle your data.
        </p>

        <div className="mt-5 space-y-2">
          <Link
            to="/terms"
            target="_blank"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
          >
            <FileText size={16} />
            Read Terms and Conditions
          </Link>
          <Link
            to="/privacy"
            target="_blank"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
          >
            <FileText size={16} />
            Read Privacy Policy
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => void handleAccept()}
          disabled={accepting}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-2"
        >
          {accepting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Accepting…
            </>
          ) : (
            "I agree to the Terms & Conditions and Privacy Policy"
          )}
        </button>

        <p className="mt-3 text-center text-xs text-slate-400">
          By clicking above you confirm that you have read and agree to our{" "}
          <Link to="/terms" target="_blank" className="underline">Terms</Link> and{" "}
          <Link to="/privacy" target="_blank" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default RequireTermsAcceptance;
