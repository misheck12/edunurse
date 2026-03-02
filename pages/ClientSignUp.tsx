import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../src/context/AuthContext";
import { signupClient } from "../src/services/backendApi";
import SEO from "../src/components/SEO";

const ClientSignUp: React.FC = () => {
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

    setIsSubmitting(true);
    try {
      await signupClient({
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        nrc: form.nrc,
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

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <SEO
        title="Sign Up"
        description="Create your EduNurse Pro account. Start generating AI-powered, curriculum-aligned lesson plans for nursing and midwifery education."
        canonicalPath="/signup"
        keywords="nurse educator signup, create account, nursing lesson plans"
      />
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Client Sign Up</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create your educator account. All fields are required.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {errorMessage && (
            <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Full Name
            </span>
            <input
              type="text"
              value={form.fullName}
              onChange={(event) => setField("fullName", event.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Phone Number
            </span>
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={(event) => setField("phoneNumber", event.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              NRC Number
            </span>
            <input
              type="text"
              value={form.nrc}
              onChange={(event) => setField("nrc", event.target.value)}
              placeholder="123456/12/1"
              required
              disabled={isSubmitting}
              pattern="\d{6}/\d{2}/\d{1}"
              title="NRC must be in format: 123456/12/1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Student Number
            </span>
            <input
              type="text"
              value={form.studentNumber}
              onChange={(event) => setField("studentNumber", event.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              School
            </span>
            <input
              type="text"
              value={form.school}
              onChange={(event) => setField("school", event.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Information
            </span>
            <textarea
              value={form.information}
              onChange={(event) => setField("information", event.target.value)}
              required
              disabled={isSubmitting}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Tell us about your role, department, or any context."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              required
              minLength={8}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Password
            </span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                setField("confirmPassword", event.target.value)
              }
              required
              minLength={8}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="sm:col-span-2 mt-1 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ClientSignUp;
