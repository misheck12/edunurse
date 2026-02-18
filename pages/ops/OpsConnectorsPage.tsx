import React, { useEffect, useMemo, useState } from "react";
import {
  AdminConnector,
  CreateAdminConnectorInput,
  GoogleDriveBrowseItem,
  browseAdminGoogleDrive,
  createAdminConnector,
  createAdminGoogleDriveConnector,
  disconnectAdminConnector,
  exchangeAdminGoogleDriveOauthCode,
  getAdminConnector,
  listAdminConnectors,
  queueAdminConnectorSync,
  updateAdminConnector,
} from "../../src/services/backendApi";
import { requestGoogleDriveAuthorizationCode } from "../../src/services/googleDriveAuth";

const CONNECTOR_TYPES = [
  "google_drive",
  "web_url",
  "postgres",
  "mysql",
  "manual_upload",
] as const;

function hasGoogleRefreshToken(secretJson: unknown) {
  if (!secretJson || typeof secretJson !== "object" || Array.isArray(secretJson)) {
    return false;
  }

  const secret = secretJson as Record<string, unknown>;
  const googleOAuth =
    secret.googleOAuth && typeof secret.googleOAuth === "object" && !Array.isArray(secret.googleOAuth)
      ? (secret.googleOAuth as Record<string, unknown>)
      : {};

  return Boolean(
    (typeof googleOAuth.refreshToken === "string" && googleOAuth.refreshToken.trim()) ||
    (typeof secret.refreshToken === "string" && secret.refreshToken.trim()),
  );
}

function formatCoverage(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.0%";
  }
  return `${value.toFixed(1)}%`;
}

const OpsConnectorsPage: React.FC = () => {
  const [connectors, setConnectors] = useState<AdminConnector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminConnector>> | null>(
    null,
  );
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [showCreateConnector, setShowCreateConnector] = useState(false);
  const [creatingConnector, setCreatingConnector] = useState(false);
  const [createConnectorError, setCreateConnectorError] = useState<string | null>(null);
  const [createConnectorForm, setCreateConnectorForm] =
    useState<CreateAdminConnectorInput>({
      name: "",
      connectorType: "web_url",
      configJson: {},
      secretJson: {},
    });
  const [webUrlsText, setWebUrlsText] = useState("");
  const [webApiKey, setWebApiKey] = useState("");
  const [webSourceType, setWebSourceType] = useState<
    "syllabus" | "standards" | "guideline"
  >("guideline");
  const [webProgramme, setWebProgramme] = useState("Nursing");
  const [dbConnectionString, setDbConnectionString] = useState("");
  const [dbQuery, setDbQuery] = useState("");
  const [dbIdColumn, setDbIdColumn] = useState("id");
  const [dbTitleColumn, setDbTitleColumn] = useState("title");
  const [dbTextColumns, setDbTextColumns] = useState("content");
  const [dbSourceType, setDbSourceType] = useState<
    "syllabus" | "standards" | "guideline"
  >("guideline");
  const [dbProgramme, setDbProgramme] = useState("Nursing");
  const [manualSourceType, setManualSourceType] = useState<
    "syllabus" | "standards" | "guideline"
  >("guideline");
  const [manualProgramme, setManualProgramme] = useState("Nursing");
  const [configJsonText, setConfigJsonText] = useState("{}");
  const [secretJsonText, setSecretJsonText] = useState("{}");
  const [googleDriveOauthSessionId, setGoogleDriveOauthSessionId] = useState("");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState("root");
  const [googleDriveFolderBatchText, setGoogleDriveFolderBatchText] = useState("");
  const [googleDriveItems, setGoogleDriveItems] = useState<GoogleDriveBrowseItem[]>([]);
  const [googleDriveSelectedFolders, setGoogleDriveSelectedFolders] = useState<
    Record<string, string>
  >({});
  const [googleDriveSelectedFileIds, setGoogleDriveSelectedFileIds] = useState<string[]>([]);
  const [googleDriveBrowseLoading, setGoogleDriveBrowseLoading] = useState(false);
  const [googleDriveBrowseError, setGoogleDriveBrowseError] = useState<string | null>(null);
  const [googleDriveMode, setGoogleDriveMode] = useState<"folder" | "files">("folder");
  const [googleDriveSourceType, setGoogleDriveSourceType] = useState<
    "syllabus" | "standards" | "guideline"
  >("guideline");
  const [googleDriveProgramme, setGoogleDriveProgramme] = useState("Nursing");
  const [googleDriveConnecting, setGoogleDriveConnecting] = useState(false);
  const [autoSyncAfterCreate, setAutoSyncAfterCreate] = useState(true);

  const loadConnectors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminConnectors({ page: 1, pageSize: 100 });
      setConnectors(response.items);
      if (!selectedConnectorId && response.items.length > 0) {
        setSelectedConnectorId(response.items[0].id);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load connectors.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (connectorId: string) => {
    setDetailLoading(true);
    try {
      const response = await getAdminConnector(connectorId);
      setDetail(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load connector detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadConnectors();
  }, []);

  useEffect(() => {
    if (!selectedConnectorId) return;
    void loadDetail(selectedConnectorId);
  }, [selectedConnectorId]);

  useEffect(() => {
    setConfigJsonText("{}");
    setSecretJsonText("{}");

    if (createConnectorForm.connectorType === "google_drive") {
      setGoogleDriveOauthSessionId("");
      setGoogleDriveFolderId("root");
      setGoogleDriveFolderBatchText("");
      setGoogleDriveItems([]);
      setGoogleDriveSelectedFolders({});
      setGoogleDriveSelectedFileIds([]);
      setGoogleDriveMode("folder");
      setGoogleDriveSourceType("guideline");
      setGoogleDriveProgramme("Nursing");
      setGoogleDriveBrowseError(null);
      return;
    }

    if (createConnectorForm.connectorType === "web_url") {
      setWebUrlsText("");
      setWebApiKey("");
      setWebSourceType("guideline");
      setWebProgramme("Nursing");
      return;
    }

    if (
      createConnectorForm.connectorType === "postgres" ||
      createConnectorForm.connectorType === "mysql"
    ) {
      setDbConnectionString("");
      setDbQuery("");
      setDbIdColumn("id");
      setDbTitleColumn("title");
      setDbTextColumns("content");
      setDbSourceType("guideline");
      setDbProgramme("Nursing");
      return;
    }

    if (createConnectorForm.connectorType === "manual_upload") {
      setManualSourceType("guideline");
      setManualProgramme("Nursing");
    }
  }, [createConnectorForm.connectorType]);

  const connectorStats = useMemo(() => {
    return {
      total: connectors.length,
      active: connectors.filter((item) => item.status === "active").length,
      paused: connectors.filter((item) => item.status === "paused").length,
      error: connectors.filter((item) => item.status === "error").length,
    };
  }, [connectors]);

  const toggleConnectorStatus = async (connector: AdminConnector) => {
    setError(null);
    setNotice(null);
    try {
      const nextStatus = connector.status === "active" ? "paused" : "active";
      await updateAdminConnector(connector.id, { status: nextStatus });
      setNotice(`${connector.name} updated to ${nextStatus}.`);
      await loadConnectors();
      if (selectedConnectorId === connector.id) {
        await loadDetail(connector.id);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update connector.",
      );
    }
  };

  const queueSync = async (connectorId: string) => {
    setSyncingIds((prev) => [...prev, connectorId]);
    setError(null);
    setNotice(null);
    try {
      const queued = await queueAdminConnectorSync(connectorId);
      setNotice(`Sync queued. Run ID: ${queued.runId}`);
      await loadConnectors();
      if (selectedConnectorId === connectorId) {
        await loadDetail(connectorId);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to queue sync.");
    } finally {
      setSyncingIds((prev) => prev.filter((item) => item !== connectorId));
    }
  };

  const disconnectConnector = async (connector: AdminConnector) => {
    setError(null);
    setNotice(null);
    try {
      if (connector.connectorType !== "google_drive") {
        throw new Error("Disconnect is only available for Google Drive connectors.");
      }

      await disconnectAdminConnector(connector.id);
      setNotice(`${connector.name} disconnected. Reconnect when ready.`);
      await loadConnectors();
      if (selectedConnectorId === connector.id) {
        await loadDetail(connector.id);
      }
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Failed to disconnect connector.",
      );
    }
  };

  const parseObjectJson = (raw: string, field: string) => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${field} must be a JSON object.`);
      }
      return parsed as Record<string, unknown>;
    } catch (parseError) {
      throw new Error(
        parseError instanceof Error ? `${field}: ${parseError.message}` : `${field} invalid.`,
      );
    }
  };

  const parseLines = (raw: string) =>
    raw
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

  const connectorBaseName = () => createConnectorForm.name.trim();

  const browseGoogleDriveFolder = async (
    folderId?: string,
    oauthSessionIdOverride?: string,
  ) => {
    setGoogleDriveBrowseError(null);
    setGoogleDriveBrowseLoading(true);
    try {
      const oauthSessionId = oauthSessionIdOverride?.trim() || googleDriveOauthSessionId.trim();
      if (!oauthSessionId) {
        throw new Error("Connect Google Drive first.");
      }

      const resolvedFolderId = folderId?.trim() || googleDriveFolderId.trim() || "root";
      const result = await browseAdminGoogleDrive({
        oauthSessionId,
        folderId: resolvedFolderId,
        pageSize: 200,
      });

      setGoogleDriveFolderId(result.folderId);
      setGoogleDriveItems(result.items);
    } catch (browseError) {
      setGoogleDriveBrowseError(
        browseError instanceof Error ? browseError.message : "Failed to browse Google Drive folder.",
      );
    } finally {
      setGoogleDriveBrowseLoading(false);
    }
  };

  const connectGoogleDrive = async () => {
    setGoogleDriveBrowseError(null);
    setGoogleDriveConnecting(true);
    try {
      const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI ?? window.location.origin;
      const oauthCode = await requestGoogleDriveAuthorizationCode({
        clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? "",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        redirectUri,
      });
      const session = await exchangeAdminGoogleDriveOauthCode({
        authorizationCode: oauthCode.authorizationCode,
        redirectUri: oauthCode.redirectUri,
      });
      setGoogleDriveOauthSessionId(session.oauthSessionId);
      setNotice("Google Drive connected. Browse folders/files to continue.");
      await browseGoogleDriveFolder(googleDriveFolderId || "root", session.oauthSessionId);
    } catch (oauthError) {
      setGoogleDriveBrowseError(
        oauthError instanceof Error ? oauthError.message : "Google Drive OAuth failed.",
      );
    } finally {
      setGoogleDriveConnecting(false);
    }
  };

  const toggleGoogleDriveFileSelection = (fileId: string) => {
    setGoogleDriveSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  };

  const toggleGoogleDriveFolderSelection = (folderId: string, folderName: string) => {
    setGoogleDriveSelectedFolders((prev) => {
      if (prev[folderId]) {
        const next = { ...prev };
        delete next[folderId];
        return next;
      }
      return {
        ...prev,
        [folderId]: folderName,
      };
    });
  };

  const createConnector = async () => {
    setCreateConnectorError(null);
    setCreatingConnector(true);
    try {
      const createdConnectorIds: string[] = [];

      if (createConnectorForm.connectorType === "google_drive") {
        if (!googleDriveOauthSessionId.trim()) {
          throw new Error("Connect Google Drive first.");
        }

        if (googleDriveMode === "files") {
          if (googleDriveSelectedFileIds.length === 0) {
            throw new Error("Select at least one Google Drive file.");
          }

          const created = await createAdminGoogleDriveConnector({
            oauthSessionId: googleDriveOauthSessionId.trim(),
            name: connectorBaseName() || "Google Drive Files",
            mode: "files",
            fileIds: googleDriveSelectedFileIds,
            programme: googleDriveProgramme.trim(),
            sourceType: googleDriveSourceType,
            defaultCurriculumVersionId: createConnectorForm.defaultCurriculumVersionId,
          });
          createdConnectorIds.push(created.id);
        } else {
          const selectedFolders = Object.keys(googleDriveSelectedFolders);
          const folderInputs = parseLines(googleDriveFolderBatchText);
          const folders =
            selectedFolders.length > 0
              ? selectedFolders
              : folderInputs.length > 0
                ? folderInputs
                : [googleDriveFolderId.trim() || "root"];
          const baseName = connectorBaseName() || "Google Drive Source";

          for (let index = 0; index < folders.length; index += 1) {
            const folderId = folders[index];
            const selectedName = googleDriveSelectedFolders[folderId];
            const created = await createAdminGoogleDriveConnector({
              oauthSessionId: googleDriveOauthSessionId.trim(),
              name:
                folders.length === 1
                  ? selectedName
                    ? `${baseName} - ${selectedName}`
                    : baseName
                  : selectedName
                    ? `${baseName} - ${selectedName}`
                    : `${baseName} ${index + 1}`,
              mode: "folder",
              folderId,
              programme: googleDriveProgramme.trim(),
              sourceType: googleDriveSourceType,
              defaultCurriculumVersionId: createConnectorForm.defaultCurriculumVersionId,
            });
            createdConnectorIds.push(created.id);
          }
        }
      } else if (createConnectorForm.connectorType === "web_url") {
        const urls = parseLines(webUrlsText);
        if (urls.length === 0) {
          throw new Error("Add at least one URL.");
        }

        const created = await createAdminConnector({
          ...createConnectorForm,
          name: connectorBaseName() || "Web Sources",
          configJson: {
            url: urls[0],
            urls,
            sourceType: webSourceType,
            programme: webProgramme.trim() || undefined,
          },
          secretJson: webApiKey.trim() ? { apiKey: webApiKey.trim() } : {},
        });
        createdConnectorIds.push(created.id);
      } else if (
        createConnectorForm.connectorType === "postgres" ||
        createConnectorForm.connectorType === "mysql"
      ) {
        if (!dbConnectionString.trim()) {
          throw new Error("Connection string is required.");
        }
        if (!dbQuery.trim()) {
          throw new Error("SQL query is required.");
        }

        const textColumns = dbTextColumns
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

        const baseConfig = {
          query: dbQuery.trim(),
          idColumn: dbIdColumn.trim() || "id",
          titleColumn: dbTitleColumn.trim() || "title",
          textColumns,
          sourceType: dbSourceType,
          programme: dbProgramme.trim() || undefined,
        };

        const created = await createAdminConnector({
          ...createConnectorForm,
          name:
            connectorBaseName() ||
            (createConnectorForm.connectorType === "postgres"
              ? "Postgres Source"
              : "MySQL Source"),
          configJson:
            createConnectorForm.connectorType === "postgres"
              ? {
                ...baseConfig,
                connectionString: dbConnectionString.trim(),
              }
              : {
                ...baseConfig,
                connectionUri: dbConnectionString.trim(),
              },
          secretJson: {},
        });
        createdConnectorIds.push(created.id);
      } else if (createConnectorForm.connectorType === "manual_upload") {
        const created = await createAdminConnector({
          ...createConnectorForm,
          name: connectorBaseName() || "Manual Upload Source",
          configJson: {
            sourceType: manualSourceType,
            programme: manualProgramme.trim() || undefined,
          },
          secretJson: {},
        });
        createdConnectorIds.push(created.id);
      } else {
        const configJson = parseObjectJson(configJsonText, "Config JSON");
        const secretJson = parseObjectJson(secretJsonText, "Secret JSON");
        const created = await createAdminConnector({
          ...createConnectorForm,
          name: connectorBaseName() || "Custom Connector",
          configJson,
          secretJson,
        });
        createdConnectorIds.push(created.id);
      }

      let queuedSyncRuns = 0;
      if (autoSyncAfterCreate) {
        for (const connectorId of createdConnectorIds) {
          try {
            await queueAdminConnectorSync(connectorId);
            queuedSyncRuns += 1;
          } catch {
            // Keep going when one queue call fails.
          }
        }
      }

      setShowCreateConnector(false);
      setCreateConnectorForm({
        name: "",
        connectorType: "web_url",
        configJson: {},
        secretJson: {},
      });
      setWebUrlsText("");
      setWebApiKey("");
      setWebSourceType("guideline");
      setWebProgramme("Nursing");
      setDbConnectionString("");
      setDbQuery("");
      setDbIdColumn("id");
      setDbTitleColumn("title");
      setDbTextColumns("content");
      setDbSourceType("guideline");
      setDbProgramme("Nursing");
      setManualSourceType("guideline");
      setManualProgramme("Nursing");
      setConfigJsonText("{}");
      setSecretJsonText("{}");
      setGoogleDriveOauthSessionId("");
      setGoogleDriveFolderId("root");
      setGoogleDriveFolderBatchText("");
      setGoogleDriveItems([]);
      setGoogleDriveSelectedFolders({});
      setGoogleDriveSelectedFileIds([]);
      setGoogleDriveMode("folder");
      setGoogleDriveSourceType("guideline");
      setGoogleDriveProgramme("Nursing");
      setGoogleDriveBrowseError(null);
      setAutoSyncAfterCreate(true);
      setNotice(
        queuedSyncRuns > 0
          ? `${createdConnectorIds.length} connector(s) created. ${queuedSyncRuns} sync job(s) queued.`
          : `${createdConnectorIds.length} connector(s) created.`,
      );
      await loadConnectors();
    } catch (createError) {
      setCreateConnectorError(
        createError instanceof Error ? createError.message : "Failed to create connector.",
      );
    } finally {
      setCreatingConnector(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Connectors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor ingestion connectors and run sync jobs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Total</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{connectorStats.total}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Active</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{connectorStats.active}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Paused</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{connectorStats.paused}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Error</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{connectorStats.error}</div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Connector List</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateConnector((prev) => !prev)}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                {showCreateConnector ? "Close" : "New Connector"}
              </button>
              <button
                onClick={() => void loadConnectors()}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>
          {showCreateConnector && (
            <div className="space-y-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={createConnectorForm.name}
                  onChange={(event) =>
                    setCreateConnectorForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Connector name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={createConnectorForm.connectorType}
                  onChange={(event) =>
                    setCreateConnectorForm((prev) => ({
                      ...prev,
                      connectorType: event.target.value as (typeof CONNECTOR_TYPES)[number],
                    }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {CONNECTOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {createConnectorForm.connectorType === "google_drive" ? (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-xs text-slate-600">
                    Connect Google Drive, browse folders, select folder(s), then create connector(s).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void connectGoogleDrive()}
                      disabled={
                        googleDriveConnecting || !import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      {googleDriveConnecting
                        ? "Connecting..."
                        : googleDriveOauthSessionId
                          ? "Reconnect Google"
                          : "Connect Google"}
                    </button>
                    <span
                      className={`rounded px-2 py-1 text-[11px] font-medium ${googleDriveOauthSessionId
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {googleDriveOauthSessionId ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  {!import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID && (
                    <p className="text-xs text-amber-700">
                      Set `VITE_GOOGLE_OAUTH_CLIENT_ID` in frontend env for one-click OAuth.
                    </p>
                  )}
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="text"
                      value={googleDriveFolderId}
                      onChange={(event) => setGoogleDriveFolderId(event.target.value)}
                      placeholder="Folder ID, URL, or use Shared with me"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs md:col-span-2"
                    />
                    <button
                      onClick={() => void browseGoogleDriveFolder()}
                      disabled={googleDriveBrowseLoading || !googleDriveOauthSessionId}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      {googleDriveBrowseLoading ? "Loading..." : "Browse Folder"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void browseGoogleDriveFolder("sharedWithMe")}
                      disabled={googleDriveBrowseLoading || !googleDriveOauthSessionId}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      Shared with me
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Open shared root, then click Open on a shared folder.
                    </span>
                  </div>
                  <textarea
                    value={googleDriveFolderBatchText}
                    onChange={(event) => setGoogleDriveFolderBatchText(event.target.value)}
                    placeholder={
                      "Optional fallback: paste many folder IDs/URLs (one per line)"
                    }
                    className="min-h-[72px] w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Priority: selected folders from table, then pasted list, then current folder field.
                  </p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <select
                      value={googleDriveMode}
                      onChange={(event) => setGoogleDriveMode(event.target.value as "folder" | "files")}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="folder">Sync whole folder</option>
                      <option value="files">Pick specific files</option>
                    </select>
                    <select
                      value={googleDriveSourceType}
                      onChange={(event) =>
                        setGoogleDriveSourceType(
                          event.target.value as "syllabus" | "standards" | "guideline",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="guideline">guideline</option>
                      <option value="syllabus">syllabus</option>
                      <option value="standards">standards</option>
                    </select>
                    <select
                      value={googleDriveProgramme}
                      onChange={(event) => setGoogleDriveProgramme(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      <option value="Nursing">Nursing</option>
                      <option value="Midwifery">Midwifery</option>
                    </select>
                  </div>
                  {googleDriveItems.length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="px-3 py-2">Select</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {googleDriveItems.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">
                                {item.isFolder ? (
                                  <input
                                    type="checkbox"
                                    checked={Boolean(googleDriveSelectedFolders[item.id])}
                                    onChange={() =>
                                      toggleGoogleDriveFolderSelection(item.id, item.name)
                                    }
                                    disabled={googleDriveMode !== "folder"}
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={googleDriveSelectedFileIds.includes(item.id)}
                                    onChange={() => toggleGoogleDriveFileSelection(item.id)}
                                    disabled={googleDriveMode !== "files"}
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">{item.name}</div>
                                <div className="text-[10px] text-slate-400">{item.id}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {item.isFolder ? "folder" : "file"}
                              </td>
                              <td className="px-3 py-2">
                                {item.isFolder && (
                                  <button
                                    onClick={() => void browseGoogleDriveFolder(item.id)}
                                    className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                                  >
                                    Open
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Selected folders: {Object.keys(googleDriveSelectedFolders).length}</span>
                    <span>Selected files: {googleDriveSelectedFileIds.length}</span>
                    <button
                      onClick={() => {
                        setGoogleDriveSelectedFolders({});
                        setGoogleDriveSelectedFileIds([]);
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-slate-50"
                    >
                      Clear selection
                    </button>
                  </div>
                  {googleDriveBrowseError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {googleDriveBrowseError}
                    </div>
                  )}
                </div>
              ) : createConnectorForm.connectorType === "web_url" ? (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-xs text-slate-600">
                    Paste one or many URLs (one per line). If protected, add its API key.
                  </p>
                  <textarea
                    value={webUrlsText}
                    onChange={(event) => setWebUrlsText(event.target.value)}
                    placeholder={"https://example.com/doc-a\nhttps://example.com/doc-b"}
                    className="min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={webApiKey}
                    onChange={(event) => setWebApiKey(event.target.value)}
                    placeholder="Optional API key"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={webSourceType}
                      onChange={(event) =>
                        setWebSourceType(
                          event.target.value as "syllabus" | "standards" | "guideline",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="guideline">guideline</option>
                      <option value="syllabus">syllabus</option>
                      <option value="standards">standards</option>
                    </select>
                    <select
                      value={webProgramme}
                      onChange={(event) => setWebProgramme(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Nursing">Nursing</option>
                      <option value="Midwifery">Midwifery</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    If key is provided, backend sends it as `Authorization: Bearer &lt;key&gt;`.
                  </p>
                </div>
              ) : createConnectorForm.connectorType === "postgres" ||
                createConnectorForm.connectorType === "mysql" ? (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-xs text-slate-600">
                    Paste database connection string and SQL query.
                  </p>
                  <input
                    type="text"
                    value={dbConnectionString}
                    onChange={(event) => setDbConnectionString(event.target.value)}
                    placeholder={
                      createConnectorForm.connectorType === "postgres"
                        ? "postgresql://user:pass@host:5432/db"
                        : "mysql://user:pass@host:3306/db"
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={dbQuery}
                    onChange={(event) => setDbQuery(event.target.value)}
                    placeholder="SELECT id, title, content FROM curriculum_docs LIMIT 500;"
                    className="min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="text"
                      value={dbIdColumn}
                      onChange={(event) => setDbIdColumn(event.target.value)}
                      placeholder="id column"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={dbTitleColumn}
                      onChange={(event) => setDbTitleColumn(event.target.value)}
                      placeholder="title column"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={dbTextColumns}
                      onChange={(event) => setDbTextColumns(event.target.value)}
                      placeholder="text columns (comma separated)"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={dbSourceType}
                      onChange={(event) =>
                        setDbSourceType(
                          event.target.value as "syllabus" | "standards" | "guideline",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="guideline">guideline</option>
                      <option value="syllabus">syllabus</option>
                      <option value="standards">standards</option>
                    </select>
                    <select
                      value={dbProgramme}
                      onChange={(event) => setDbProgramme(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Nursing">Nursing</option>
                      <option value="Midwifery">Midwifery</option>
                    </select>
                  </div>
                </div>
              ) : createConnectorForm.connectorType === "manual_upload" ? (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
                  <p className="text-xs text-slate-600">
                    Manual upload connector does not pull automatically. Use it for future upload workflows.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={manualSourceType}
                      onChange={(event) =>
                        setManualSourceType(
                          event.target.value as "syllabus" | "standards" | "guideline",
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="guideline">guideline</option>
                      <option value="syllabus">syllabus</option>
                      <option value="standards">standards</option>
                    </select>
                    <select
                      value={manualProgramme}
                      onChange={(event) => setManualProgramme(event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Nursing">Nursing</option>
                      <option value="Midwifery">Midwifery</option>
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    value={configJsonText}
                    onChange={(event) => setConfigJsonText(event.target.value)}
                    className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                    placeholder='Config JSON, e.g. {"urls":["https://example.com/doc"]}'
                  />
                  <textarea
                    value={secretJsonText}
                    onChange={(event) => setSecretJsonText(event.target.value)}
                    className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                    placeholder='Secret JSON, e.g. {"accessToken":"..."}'
                  />
                </>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={autoSyncAfterCreate}
                  onChange={(event) => setAutoSyncAfterCreate(event.target.checked)}
                />
                Queue sync immediately after create
              </label>

              <button
                onClick={() => void createConnector()}
                disabled={creatingConnector}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {creatingConnector ? "Creating..." : "Create Connector"}
              </button>
              {createConnectorError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createConnectorError}
                </div>
              )}
            </div>
          )}
          <div className="p-5">
            {loading && <div className="text-sm text-slate-500">Loading connectors...</div>}
            {!loading && connectors.length === 0 && (
              <div className="space-y-2 text-sm text-slate-500">
                <div>No connectors configured.</div>
                <button
                  onClick={() => setShowCreateConnector(true)}
                  className="rounded border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Create your first connector
                </button>
              </div>
            )}
            {connectors.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Last Synced</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {connectors.map((connector) => {
                      const syncing = syncingIds.includes(connector.id);
                      return (
                        <tr key={connector.id}>
                          <td className="py-3 pr-4">
                            <button
                              onClick={() => setSelectedConnectorId(connector.id)}
                              className="font-medium text-slate-900 hover:text-blue-700"
                            >
                              {connector.name}
                            </button>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{connector.connectorType}</td>
                          <td className="py-3 pr-4 text-slate-600">{connector.status}</td>
                          <td className="py-3 pr-4 text-xs text-slate-600">
                            {connector.lastSyncedAt
                              ? new Date(connector.lastSyncedAt).toLocaleString()
                              : "Never"}
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <button
                              onClick={() => void queueSync(connector.id)}
                              disabled={syncing}
                              className="rounded border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                            >
                              {syncing ? "Queueing..." : "Sync"}
                            </button>
                            <button
                              onClick={() => void toggleConnectorStatus(connector)}
                              className="rounded border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50"
                            >
                              {connector.status === "active" ? "Pause" : "Activate"}
                            </button>
                            {connector.connectorType === "google_drive" && (
                              <button
                                onClick={() => void disconnectConnector(connector)}
                                className="rounded border border-red-300 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                              >
                                Disconnect
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Connector Detail</h2>
          </div>
          <div className="p-5">
            {detailLoading && <div className="text-sm text-slate-500">Loading detail...</div>}
            {!detailLoading && !detail && (
              <div className="text-sm text-slate-500">Select a connector.</div>
            )}
            {detail && (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-slate-500">Name</div>
                  <div className="font-medium text-slate-900">{detail.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">Type</div>
                  <div className="text-slate-700">{detail.connectorType}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">Status</div>
                  <div className="text-slate-700">{detail.status}</div>
                </div>
                {detail.connectorType === "google_drive" && (
                  <div>
                    <div className="text-xs uppercase text-slate-500">Connection</div>
                    <div className="text-slate-700">
                      {hasGoogleRefreshToken(detail.secretJson) ? "Connected" : "Disconnected"}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs uppercase text-slate-500">Runs</div>
                  <div className="text-slate-700">{detail.runs.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-slate-500">Documents</div>
                  <div className="text-slate-700">{detail.externalDocuments.length}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase text-slate-500">Ingestion Quality</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div className="text-[11px] text-slate-500">Chunks Indexed</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {detail.ingestionQuality?.chunksIndexed ?? 0}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div className="text-[11px] text-slate-500">Chunks Embedded</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {detail.ingestionQuality?.chunksEmbedded ?? 0}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div className="text-[11px] text-slate-500">Semester Coverage</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCoverage(detail.ingestionQuality?.semesterMetadataCoveragePct)}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div className="text-[11px] text-slate-500">Course Coverage</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCoverage(detail.ingestionQuality?.courseMetadataCoveragePct)}
                      </div>
                    </div>
                  </div>
                </div>
                {detail.runs.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs uppercase text-slate-500">Recent Run Quality</div>
                    <div className="max-h-52 overflow-y-auto rounded border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100">
                          <tr>
                            <th className="px-2 py-1.5">Run</th>
                            <th className="px-2 py-1.5">Status</th>
                            <th className="px-2 py-1.5">Chunks</th>
                            <th className="px-2 py-1.5">Embedded</th>
                            <th className="px-2 py-1.5">Sem%</th>
                            <th className="px-2 py-1.5">Course%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {detail.runs.slice(0, 10).map((run) => (
                            <tr key={run.id}>
                              <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600">
                                {run.id.slice(0, 8)}
                              </td>
                              <td className="px-2 py-1.5 text-slate-700">{run.status}</td>
                              <td className="px-2 py-1.5 text-slate-700">
                                {run.ingestionQuality?.chunksIndexed ?? 0}
                              </td>
                              <td className="px-2 py-1.5 text-slate-700">
                                {run.ingestionQuality?.chunksEmbedded ?? 0}
                              </td>
                              <td className="px-2 py-1.5 text-slate-700">
                                {formatCoverage(run.ingestionQuality?.semesterMetadataCoveragePct)}
                              </td>
                              <td className="px-2 py-1.5 text-slate-700">
                                {formatCoverage(run.ingestionQuality?.courseMetadataCoveragePct)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OpsConnectorsPage;
