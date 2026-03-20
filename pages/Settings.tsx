import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Save, User } from "lucide-react";
import {
  getUserPreferences,
  updateCurrentUser,
  updateUserPreferences,
} from "../src/services/backendApi";
import { useAuth } from "../src/context/AuthContext";
import { BillingSection } from "../src/components/BillingSection";
import { PaymentModal } from "../src/components/PaymentModal";
import SEO from "../src/components/SEO";
import {
  identityDocumentErrorMessage,
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from "../src/utils/identityDocument";

type ProgrammeOption = "Nursing" | "Midwifery";

const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [profileError, setProfileError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [preferencesNotice, setPreferencesNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nrc, setNrc] = useState("");
  const [school, setSchool] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [information, setInformation] = useState("");

  const [institutionName, setInstitutionName] = useState("");
  const [defaultProgramme, setDefaultProgramme] =
    useState<ProgrammeOption>("Nursing");
  const [lessonPlanFormat, setLessonPlanFormat] = useState(
    "Standard (NMC Aligned)",
  );
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [includeDisclaimers, setIncludeDisclaimers] = useState(true);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setPhoneNumber(user?.phoneNumber ?? "");
    setNrc(user?.nrc ?? "");
    setSchool(user?.school ?? "");
    setStudentNumber(user?.studentNumber ?? "");
    setInformation(user?.information ?? "");
  }, [user]);

  const loadPreferences = async () => {
    setPreferencesLoading(true);
    setPreferencesError(null);
    try {
      const preferences = await getUserPreferences();
      const ui = (preferences.uiPreferences ?? {}) as Record<string, unknown>;
      const exportDefaults = (preferences.exportDefaults ?? {}) as Record<
        string,
        unknown
      >;

      setDefaultProgramme(
        preferences.defaultProgramme === "Midwifery"
          ? "Midwifery"
          : "Nursing",
      );
      setInstitutionName(
        typeof ui.institutionName === "string" ? ui.institutionName : "",
      );
      setLessonPlanFormat(
        typeof ui.lessonPlanFormat === "string"
          ? ui.lessonPlanFormat
          : "Standard (NMC Aligned)",
      );
      setDefaultDuration(
        typeof ui.defaultDurationMinutes === "number"
          ? Math.max(15, ui.defaultDurationMinutes)
          : 60,
      );
      setIncludeDisclaimers(
        typeof exportDefaults.includeDisclaimers === "boolean"
          ? exportDefaults.includeDisclaimers
          : true,
      );
    } catch (error) {
      setPreferencesError(
        error instanceof Error ? error.message : "Failed to load settings.",
      );
    } finally {
      setPreferencesLoading(false);
    }
  };

  useEffect(() => {
    void loadPreferences();
  }, []);

  const canSaveProfile = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      phoneNumber.trim().length >= 7 &&
      isValidIdentityDocument(nrc) &&
      school.trim().length >= 2 &&
      studentNumber.trim().length >= 2 &&
      information.trim().length >= 2
    );
  }, [fullName, information, nrc, phoneNumber, school, studentNumber]);

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileNotice(null);

    if (!canSaveProfile) {
      setProfileError(
        `Complete all required fields: full name, phone number, NRC/passport number, school, student number, and information. ${identityDocumentErrorMessage}`,
      );
      return;
    }

    setProfileSaving(true);
    try {
      await updateCurrentUser({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        nrc: normalizeIdentityDocument(nrc),
        school: school.trim(),
        studentNumber: studentNumber.trim(),
        information: information.trim(),
      });
      await refreshUser();
      setProfileNotice("Account details updated.");
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Failed to update account details.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
    setPreferencesNotice(null);
    setPreferencesError(null);

    const safeDuration = Number.isFinite(defaultDuration)
      ? Math.min(600, Math.max(15, Math.round(defaultDuration)))
      : 60;

    try {
      await updateUserPreferences({
        defaultProgramme,
        defaultDocumentType: "Lesson Plan",
        exportDefaults: {
          includeDisclaimers,
        },
        uiPreferences: {
          institutionName: institutionName.trim(),
          lessonPlanFormat,
          defaultDurationMinutes: safeDuration,
        },
      });
      setDefaultDuration(safeDuration);
      setPreferencesNotice("Preferences saved.");
    } catch (error) {
      setPreferencesError(
        error instanceof Error ? error.message : "Failed to save settings.",
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 md:p-10">
      <SEO title="Settings" description="Manage your EduNurse Pro account settings and preferences." noIndex />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage your account details and default document generation behavior.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Account
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {user?.fullName ?? "Unspecified"}
          </p>
          <p className="text-sm text-slate-600">{user?.email ?? "-"}</p>
          <div className="mt-4 space-y-2 text-xs text-slate-500">
            <div>Role: {user?.role ?? "-"}</div>
            <div>Status: {user?.isActive ? "Active" : "Inactive"}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Full Name</span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={profileSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone Number</span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                disabled={profileSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">NRC / Passport Number</span>
              <input
                type="text"
                value={nrc}
                onChange={(event) => setNrc(event.target.value)}
                disabled={profileSaving}
                placeholder="123456/12/1 or AB1234567"
                title={identityDocumentErrorMessage}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Student Number</span>
              <input
                type="text"
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                disabled={profileSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">School</span>
              <input
                type="text"
                value={school}
                onChange={(event) => setSchool(event.target.value)}
                disabled={profileSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Information</span>
              <textarea
                value={information}
                onChange={(event) => setInformation(event.target.value)}
                rows={3}
                disabled={profileSaving}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Role, department, specialization, or teaching context."
              />
            </label>
          </div>

          {profileError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {profileError}
            </div>
          )}

          {profileNotice && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {profileNotice}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={profileSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} />
              {profileSaving ? "Saving..." : "Save Account"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Teaching Preferences</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Default Programme</span>
            <select
              value={defaultProgramme}
              onChange={(event) =>
                setDefaultProgramme(event.target.value as ProgrammeOption)
              }
              disabled={preferencesLoading || preferencesSaving}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="Nursing">Nursing</option>
              <option value="Midwifery">Midwifery</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Lesson Plan Format</span>
            <select
              value={lessonPlanFormat}
              onChange={(event) => setLessonPlanFormat(event.target.value)}
              disabled={preferencesLoading || preferencesSaving}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option>Standard (NMC Aligned)</option>
              <option>Gagne&apos;s 9 Events</option>
              <option>5E Model</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Default Duration (minutes)</span>
            <input
              type="number"
              min={15}
              max={600}
              value={defaultDuration}
              onChange={(event) => setDefaultDuration(Number(event.target.value) || 0)}
              disabled={preferencesLoading || preferencesSaving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-sm font-medium text-slate-700">Institution Name (for exports)</span>
            <input
              type="text"
              value={institutionName}
              onChange={(event) => setInstitutionName(event.target.value)}
              disabled={preferencesLoading || preferencesSaving}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="sm:col-span-2 lg:col-span-3 flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>Include disclaimers in exports</span>
            <input
              type="checkbox"
              checked={includeDisclaimers}
              onChange={(event) => setIncludeDisclaimers(event.target.checked)}
              disabled={preferencesLoading || preferencesSaving}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>

        {preferencesError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {preferencesError}
          </div>
        )}

        {preferencesNotice && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {preferencesNotice}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void loadPreferences()}
            disabled={preferencesLoading || preferencesSaving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void handleSavePreferences()}
            disabled={preferencesLoading || preferencesSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {preferencesSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>

      {/* Billing Section */}
      <div className="mt-6">
        <BillingSection onUpgradeClick={() => setShowPaymentModal(true)} />
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Settings;
