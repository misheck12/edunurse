import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../src/context/AuthContext";
import { signupClient } from "../src/services/backendApi";
import SEO from "../src/components/SEO";
import {
  identityDocumentErrorMessage,
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from "../src/utils/identityDocument";
import AuthPageLayout, {
  authCheckboxClassName,
  authInlineLinkClassName,
  getAuthAlertClassName,
} from "../src/components/auth/AuthPageLayout";

const ClientSignUp: React.FC = () => {
  const informationOptions = [
    "Nursing Student",
    "Midwifery Student",
    "Nurse Educator",
    "Clinical Instructor",
    "Registered Nurse",
    "Other",
  ];

  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    nrc: "",
    school: "",
    studentNumber: "",
    information: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (form.password !== form.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!isValidIdentityDocument(form.nrc)) {
      setErrorMessage(identityDocumentErrorMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      await signupClient({
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        nrc: normalizeIdentityDocument(form.nrc),
        school: form.school,
        studentNumber: form.studentNumber,
        information: form.information,
        password: form.password,
      });
      await refreshUser();
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="text-center text-sm text-slate-600">
      Already have an account?{" "}
      <Link to="/signin" className={authInlineLinkClassName}>
        Sign in
      </Link>
    </div>
  );

  const compactLabelClassName =
    "block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";
  const compactInputClassName =
    "block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base leading-5 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 md:text-sm";
  const compactButtonClassName =
    "inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none";

  return (
    <>
      <SEO
        title="Sign Up"
        description="Create your EduNurse Pro account. Start generating AI-powered, curriculum-aligned lesson plans for nursing and midwifery education."
        canonicalPath="/signup"
        keywords="nurse educator signup, create account, nursing lesson plans"
      />
      <AuthPageLayout
        eyebrow="New account"
        title="Client Sign Up"
        description="Create your educator account. All fields are required."
        contentWidthClassName="max-w-3xl"
        contentAlignment="start"
        footer={footer}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && <div className={getAuthAlertClassName()}>{errorMessage}</div>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="signup-full-name" className={compactLabelClassName}>
                Full Name
              </label>
              <input
                id="signup-full-name"
                type="text"
                value={form.fullName}
                onChange={(event) => setField("fullName", event.target.value)}
                autoComplete="name"
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className={compactLabelClassName}>
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-phone" className={compactLabelClassName}>
                Phone Number
              </label>
              <input
                id="signup-phone"
                type="tel"
                value={form.phoneNumber}
                onChange={(event) => setField("phoneNumber", event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-nrc" className={compactLabelClassName}>
                NRC / Passport Number
              </label>
              <input
                id="signup-nrc"
                type="text"
                value={form.nrc}
                onChange={(event) => setField("nrc", event.target.value)}
                placeholder="123456/12/1 or AB1234567"
                autoCapitalize="characters"
                required
                disabled={isSubmitting}
                title={identityDocumentErrorMessage}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-student-number" className={compactLabelClassName}>
                Student Number
              </label>
              <input
                id="signup-student-number"
                type="text"
                value={form.studentNumber}
                onChange={(event) => setField("studentNumber", event.target.value)}
                autoComplete="off"
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-school" className={compactLabelClassName}>
                School
              </label>
              <input
                id="signup-school"
                type="text"
                value={form.school}
                onChange={(event) => setField("school", event.target.value)}
                autoComplete="organization"
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-information" className={compactLabelClassName}>
                Role / Programme
              </label>
              <select
                id="signup-information"
                value={form.information}
                onChange={(event) => setField("information", event.target.value)}
                required
                disabled={isSubmitting}
                className={compactInputClassName}
              >
                <option value="" disabled>
                  Select an option
                </option>
                {informationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className={compactLabelClassName}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className={compactLabelClassName}>
                Confirm Password
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setField("confirmPassword", event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isSubmitting}
                className={compactInputClassName}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <input
              type="checkbox"
              required
              disabled={isSubmitting}
              className={authCheckboxClassName}
            />
            <span className="text-xs leading-5 text-slate-600 sm:text-sm">
              I agree to the{" "}
              <Link to="/terms" target="_blank" className={authInlineLinkClassName}>
                Terms and Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" className={authInlineLinkClassName}>
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className={compactButtonClassName}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </AuthPageLayout>
    </>
  );
};

export default ClientSignUp;
