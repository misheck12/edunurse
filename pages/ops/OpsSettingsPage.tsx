import React, { useEffect, useState } from "react";
import {
  getAdminSettings,
  updateAdminSettings,
  testEmailConfiguration,
  SystemSettingsResponse,
} from "../../src/services/backendApi";
import { Settings, Mail, Globe, Save, RefreshCw, AlertCircle, CheckCircle2, Send } from "lucide-react";

const OpsSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminSettings();
      setSettings(response);
      
      // Initialize edited values
      const initial: Record<string, string> = {};
      for (const category in response.categories) {
        for (const setting of response.categories[category]) {
          initial[setting.key] = setting.value;
        }
      }
      setEditedValues(initial);
      setHasChanges(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateAdminSettings(editedValues);
      setNotice("Settings saved successfully. Restart backend to apply changes.");
      setHasChanges(false);
      await loadSettings();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      setError("Please enter an email address");
      return;
    }

    setSendingTestEmail(true);
    setNotice(null);
    setError(null);
    try {
      const response = await testEmailConfiguration(testEmailAddress);
      setNotice(response.message);
      setShowTestEmailModal(false);
      setTestEmailAddress("");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to send test email.");
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "email":
        return <Mail size={20} />;
      case "application":
        return <Globe size={20} />;
      default:
        return <Settings size={20} />;
    }
  };

  const getCategoryTitle = (category: string) => {
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case "email":
        return "Configure SMTP server and email notification settings";
      case "application":
        return "General application configuration and external links";
      default:
        return "System configuration settings";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure system-wide settings including email, SMTP, and application settings.
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <Settings className="text-blue-600" size={24} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
          <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">{notice}</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm font-medium text-slate-600">Loading settings...</p>
        </div>
      )}

      {/* Settings Categories */}
      {!loading && settings && (
        <>
          <div className="space-y-6">
            {Object.entries(settings.categories).map(([category, categorySettings]) => (
              <section key={category} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                    {getCategoryIcon(category)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {getCategoryTitle(category)}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getCategoryDescription(category)}
                    </p>
                  </div>
                </div>

                {/* Category Settings */}
                <div className="p-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {categorySettings.map((setting) => (
                      <div key={setting.key} className="space-y-2">
                        <label className="flex items-center justify-between text-sm font-medium text-slate-700">
                          <span>{setting.description}</span>
                          {setting.isSecret && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Secret
                            </span>
                          )}
                        </label>
                        <input
                          type={setting.isSecret ? "password" : "text"}
                          value={editedValues[setting.key] || ""}
                          onChange={(e) => handleChange(setting.key, e.target.value)}
                          placeholder={`Enter ${setting.description.toLowerCase()}`}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                        />
                        <p className="text-xs text-slate-500">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                            {setting.key}
                          </code>
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Test Email Button for Email Category */}
                  {category === "email" && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <button
                        onClick={() => setShowTestEmailModal(true)}
                        className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-all hover:bg-blue-100"
                      >
                        <Send size={16} />
                        Send Test Email
                      </button>
                      <p className="mt-2 text-xs text-slate-500">
                        Send a test email to verify your SMTP configuration is working correctly
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {hasChanges && (
                <>
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="font-medium">Unsaved changes</span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => void loadSettings()}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                Reset Changes
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {/* Important Notice */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <div className="flex-1 text-sm text-amber-900">
                <p className="font-medium mb-1">Restart Required</p>
                <p className="text-amber-800">
                  After saving settings, restart the backend service for changes to take effect:
                </p>
                <code className="mt-2 block rounded bg-amber-100 px-3 py-2 font-mono text-xs text-amber-900">
                  cd deploy && docker-compose restart backend
                </code>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Test Email</h3>
            <p className="text-sm text-slate-600 mb-4">
              Enter an email address to receive a test welcome email. This will verify your SMTP configuration is working correctly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="test@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowTestEmailModal(false);
                    setTestEmailAddress("");
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSendTestEmail()}
                  disabled={sendingTestEmail || !testEmailAddress.trim()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Send size={16} />
                  {sendingTestEmail ? "Sending..." : "Send Test Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpsSettingsPage;
