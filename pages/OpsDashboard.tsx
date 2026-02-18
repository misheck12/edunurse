import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Database,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldAlert,
} from "lucide-react";
import {
  AdminAiHealthResponse,
  AdminConnector,
  AdminPlan,
  AdminSubscription,
  AdminTransaction,
  AdminUserListItem,
  GoogleDriveBrowseItem,
  CreateAdminConnectorInput,
  CurriculumSourceSummary,
  OpsCurriculumVersion,
  OpsExportJobItem,
  OpsGenerationRunItem,
  OpsOverviewResponse,
  activateOpsCurriculumVersion,
  browseAdminGoogleDrive,
  createAdminGoogleDriveConnector,
  createAdminSubscription,
  createAdminPlan,
  createAdminUser,
  createAdminTransaction,
  createAdminConnector,
  exchangeAdminGoogleDriveOauthCode,
  getAdminAiHealth,
  getAdminConnector,
  getAdminConnectorRun,
  getCurrentDevUserId,
  listAdminPlans,
  listAdminSubscriptions,
  listAdminTransactions,
  listAdminUsers,
  listAdminConnectors,
  listCurriculumSources,
  listOpsCurriculumVersions,
  listOpsExportJobs,
  listOpsGenerationRuns,
  getOpsOverview,
  updateAdminSubscription,
  updateAdminPlan,
  updateAdminTransaction,
  updateAdminUser,
  queueAdminConnectorSync,
  setCurrentDevUserId,
  updateAdminConnector,
} from "../src/services/backendApi";
import { useAuth } from "../src/context/AuthContext";
import { requestGoogleDriveAuthorizationCode } from "../src/services/googleDriveAuth";

const PAGE_SIZE = 50;

const CONNECTOR_TYPES = [
  "google_drive",
  "web_url",
  "postgres",
  "mysql",
  "manual_upload",
] as const;

const OpsDashboard: React.FC = () => {
  const { refreshUser } = useAuth();
  const [devUserId, setDevUserId] = useState(getCurrentDevUserId());
  const [notice, setNotice] = useState<string | null>(null);

  const [aiHealth, setAiHealth] = useState<AdminAiHealthResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<AdminConnector[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );
  const [connectorDetail, setConnectorDetail] = useState<Awaited<
    ReturnType<typeof getAdminConnector>
  > | null>(null);
  const [connectorDetailLoading, setConnectorDetailLoading] = useState(false);
  const [syncingConnectorIds, setSyncingConnectorIds] = useState<string[]>([]);

  const [sources, setSources] = useState<CurriculumSourceSummary[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OpsOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [generationRuns, setGenerationRuns] = useState<OpsGenerationRunItem[]>([]);
  const [generationRunsLoading, setGenerationRunsLoading] = useState(false);
  const [generationRunsError, setGenerationRunsError] = useState<string | null>(null);
  const [generationStatusFilter, setGenerationStatusFilter] = useState<
    "all" | "queued" | "running" | "succeeded" | "failed" | "blocked"
  >("all");

  const [exportJobs, setExportJobs] = useState<OpsExportJobItem[]>([]);
  const [exportJobsLoading, setExportJobsLoading] = useState(false);
  const [exportJobsError, setExportJobsError] = useState<string | null>(null);

  const [curriculumVersions, setCurriculumVersions] = useState<OpsCurriculumVersion[]>([]);
  const [curriculumVersionsLoading, setCurriculumVersionsLoading] = useState(false);
  const [curriculumVersionsError, setCurriculumVersionsError] = useState<string | null>(null);
  const [activatingVersionId, setActivatingVersionId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"educator" | "admin">("educator");
  const [newUserProgramme, setNewUserProgramme] = useState("Nursing");
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserError, setNewUserError] = useState<string | null>(null);

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPriceCents, setNewPlanPriceCents] = useState(0);
  const [newPlanLimitsText, setNewPlanLimitsText] = useState("{}");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanError, setNewPlanError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editPlanCode, setEditPlanCode] = useState("");
  const [editPlanName, setEditPlanName] = useState("");
  const [editPlanPriceCents, setEditPlanPriceCents] = useState(0);
  const [editPlanLimitsText, setEditPlanLimitsText] = useState("{}");
  const [savingPlan, setSavingPlan] = useState(false);
  const [editPlanError, setEditPlanError] = useState<string | null>(null);

  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const [newSubscriptionUserId, setNewSubscriptionUserId] = useState("");
  const [newSubscriptionPlanId, setNewSubscriptionPlanId] = useState("");
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [newSubscriptionError, setNewSubscriptionError] = useState<string | null>(null);

  const [newTransactionUserId, setNewTransactionUserId] = useState("");
  const [newTransactionSubscriptionId, setNewTransactionSubscriptionId] = useState("");
  const [newTransactionProvider, setNewTransactionProvider] = useState("manual");
  const [newTransactionType, setNewTransactionType] = useState<"charge" | "refund" | "adjustment">("charge");
  const [newTransactionStatus, setNewTransactionStatus] = useState<"pending" | "succeeded" | "failed" | "canceled">("pending");
  const [newTransactionAmount, setNewTransactionAmount] = useState(0);
  const [newTransactionCurrency, setNewTransactionCurrency] = useState("USD");
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [newTransactionError, setNewTransactionError] = useState<string | null>(null);

  const [runLookupId, setRunLookupId] = useState("");
  const [runLookupLoading, setRunLookupLoading] = useState(false);
  const [runLookupError, setRunLookupError] = useState<string | null>(null);
  const [runLookupResult, setRunLookupResult] = useState<Awaited<
    ReturnType<typeof getAdminConnectorRun>
  > | null>(null);

  const [showCreateConnector, setShowCreateConnector] = useState(false);
  const [creatingConnector, setCreatingConnector] = useState(false);
  const [createConnectorError, setCreateConnectorError] = useState<string | null>(
    null,
  );
  const [createConnectorForm, setCreateConnectorForm] =
    useState<CreateAdminConnectorInput>({
      name: "",
      connectorType: "web_url",
      configJson: {},
      secretJson: {},
    });
  const [configJsonText, setConfigJsonText] = useState("{}");
  const [secretJsonText, setSecretJsonText] = useState("{}");
  const [googleDriveOauthSessionId, setGoogleDriveOauthSessionId] = useState("");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState("root");
  const [googleDriveItems, setGoogleDriveItems] = useState<GoogleDriveBrowseItem[]>([]);
  const [googleDriveSelectedFileIds, setGoogleDriveSelectedFileIds] = useState<string[]>([]);
  const [googleDriveBrowseLoading, setGoogleDriveBrowseLoading] = useState(false);
  const [googleDriveBrowseError, setGoogleDriveBrowseError] = useState<string | null>(null);
  const [googleDriveMode, setGoogleDriveMode] = useState<"folder" | "files">("folder");
  const [googleDriveSourceType, setGoogleDriveSourceType] = useState<
    "syllabus" | "standards" | "guideline"
  >("guideline");
  const [googleDriveProgramme, setGoogleDriveProgramme] = useState("Nursing");
  const [googleDriveConnecting, setGoogleDriveConnecting] = useState(false);

  const loadAiHealth = async (probe: boolean) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getAdminAiHealth({ probe, timeoutMs: 12000 });
      setAiHealth(result);
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Failed to load AI health.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const loadConnectors = async () => {
    setConnectorsLoading(true);
    setConnectorsError(null);
    try {
      const payload = await listAdminConnectors({ page: 1, pageSize: PAGE_SIZE });
      setConnectors(payload.items);
      if (payload.items.length > 0 && !selectedConnectorId) {
        setSelectedConnectorId(payload.items[0].id);
      }
    } catch (error) {
      setConnectorsError(
        error instanceof Error ? error.message : "Failed to load connectors.",
      );
    } finally {
      setConnectorsLoading(false);
    }
  };

  const loadSources = async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const payload = await listCurriculumSources();
      setSources(payload.items);
    } catch (error) {
      setSourcesError(
        error instanceof Error ? error.message : "Failed to load sources.",
      );
    } finally {
      setSourcesLoading(false);
    }
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const payload = await getOpsOverview({ days: 7 });
      setOverview(payload);
    } catch (error) {
      setOverviewError(
        error instanceof Error ? error.message : "Failed to load overview.",
      );
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadGenerationRuns = async (
    status: "all" | "queued" | "running" | "succeeded" | "failed" | "blocked",
  ) => {
    setGenerationRunsLoading(true);
    setGenerationRunsError(null);
    try {
      const payload = await listOpsGenerationRuns({
        page: 1,
        pageSize: 20,
        status: status === "all" ? undefined : status,
      });
      setGenerationRuns(payload.items);
    } catch (error) {
      setGenerationRunsError(
        error instanceof Error ? error.message : "Failed to load generation runs.",
      );
    } finally {
      setGenerationRunsLoading(false);
    }
  };

  const loadExportJobs = async () => {
    setExportJobsLoading(true);
    setExportJobsError(null);
    try {
      const payload = await listOpsExportJobs({
        page: 1,
        pageSize: 20,
      });
      setExportJobs(payload.items);
    } catch (error) {
      setExportJobsError(
        error instanceof Error ? error.message : "Failed to load export jobs.",
      );
    } finally {
      setExportJobsLoading(false);
    }
  };

  const loadCurriculumVersions = async () => {
    setCurriculumVersionsLoading(true);
    setCurriculumVersionsError(null);
    try {
      const payload = await listOpsCurriculumVersions();
      setCurriculumVersions(payload.items);
    } catch (error) {
      setCurriculumVersionsError(
        error instanceof Error ? error.message : "Failed to load curriculum versions.",
      );
    } finally {
      setCurriculumVersionsLoading(false);
    }
  };

  const loadUsers = async (searchValue?: string) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const payload = await listAdminUsers({
        page: 1,
        pageSize: 50,
        search: searchValue?.trim() ? searchValue.trim() : undefined,
      });
      setUsers(payload.items);
      if (!searchValue?.trim() && payload.items.length > 0) {
        if (!newSubscriptionUserId) {
          setNewSubscriptionUserId(payload.items[0].id);
        }
        if (!newTransactionUserId) {
          setNewTransactionUserId(payload.items[0].id);
        }
      }
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const hydratePlanEditor = (plan: AdminPlan) => {
    setSelectedPlanId(plan.id);
    setEditPlanCode(plan.code);
    setEditPlanName(plan.name);
    setEditPlanPriceCents(plan.monthlyPriceCents);
    setEditPlanLimitsText(JSON.stringify(plan.limitsJson ?? {}, null, 2));
  };

  const loadPlans = async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const payload = await listAdminPlans();
      setPlans(payload);
      if (payload.length > 0) {
        const selected =
          payload.find((plan) => plan.id === selectedPlanId) ?? payload[0];
        hydratePlanEditor(selected);
        if (!newSubscriptionPlanId) {
          setNewSubscriptionPlanId(selected.id);
        }
      } else {
        setSelectedPlanId("");
        setEditPlanCode("");
        setEditPlanName("");
        setEditPlanPriceCents(0);
        setEditPlanLimitsText("{}");
      }
    } catch (error) {
      setPlansError(error instanceof Error ? error.message : "Failed to load plans.");
    } finally {
      setPlansLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);
    try {
      const payload = await listAdminSubscriptions({
        page: 1,
        pageSize: 50,
      });
      setSubscriptions(payload.items);
    } catch (error) {
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to load subscriptions.",
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const payload = await listAdminTransactions({
        page: 1,
        pageSize: 50,
      });
      setTransactions(payload.items);
    } catch (error) {
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to load transactions.",
      );
    } finally {
      setTransactionsLoading(false);
    }
  };

  const loadConnectorDetail = async (connectorId: string) => {
    setConnectorDetailLoading(true);
    try {
      setConnectorDetail(await getAdminConnector(connectorId));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Failed to load connector detail.",
      );
    } finally {
      setConnectorDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadAiHealth(false);
    void loadConnectors();
    void loadSources();
    void loadOverview();
    void loadGenerationRuns("all");
    void loadExportJobs();
    void loadCurriculumVersions();
    void loadUsers();
    void loadPlans();
    void loadSubscriptions();
    void loadTransactions();
  }, []);

  useEffect(() => {
    if (!selectedConnectorId) return;
    void loadConnectorDetail(selectedConnectorId);
  }, [selectedConnectorId]);

  useEffect(() => {
    void loadGenerationRuns(generationStatusFilter);
  }, [generationStatusFilter]);

  useEffect(() => {
    if (createConnectorForm.connectorType !== "google_drive") {
      return;
    }
    setConfigJsonText("{}");
    setSecretJsonText("{}");
    setGoogleDriveOauthSessionId("");
    setGoogleDriveFolderId("root");
    setGoogleDriveItems([]);
    setGoogleDriveSelectedFileIds([]);
    setGoogleDriveMode("folder");
    setGoogleDriveSourceType("guideline");
    setGoogleDriveProgramme("Nursing");
    setGoogleDriveBrowseError(null);
  }, [createConnectorForm.connectorType]);

  useEffect(() => {
    if (!newTransactionSubscriptionId) return;
    const exists = subscriptions.some(
      (subscription) =>
        subscription.id === newTransactionSubscriptionId &&
        subscription.userId === newTransactionUserId,
    );
    if (!exists) {
      setNewTransactionSubscriptionId("");
    }
  }, [newTransactionSubscriptionId, newTransactionUserId, subscriptions]);

  const connectorStats = useMemo(() => {
    return {
      total: connectors.length,
      active: connectors.filter((item) => item.status === "active").length,
      paused: connectors.filter((item) => item.status === "paused").length,
      errored: connectors.filter((item) => item.status === "error").length,
    };
  }, [connectors]);

  const providerStats = useMemo(() => {
    if (!aiHealth) return { configured: 0, healthy: 0 };
    const providers = [
      aiHealth.providers.azure,
      aiHealth.providers.gemini,
      aiHealth.providers.deepseek,
    ];
    return {
      configured: providers.filter((item) => item.configured).length,
      healthy: providers.filter((item) => item.probe?.ok).length,
    };
  }, [aiHealth]);

  const saveDevUser = () => {
    try {
      setCurrentDevUserId(devUserId.trim());
      void refreshUser();
      setNotice("User ID saved. Click Refresh All to reload with new header.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Invalid user ID.");
    }
  };

  const refreshAll = () => {
    setNotice(null);
    void loadAiHealth(false);
    void loadConnectors();
    void loadSources();
    void loadOverview();
    void loadGenerationRuns(generationStatusFilter);
    void loadExportJobs();
    void loadCurriculumVersions();
    void loadUsers(userSearch);
    void loadPlans();
    void loadSubscriptions();
    void loadTransactions();
  };

  const probeProviders = () => {
    setNotice(null);
    void loadAiHealth(true);
  };

  const toggleConnectorStatus = async (connector: AdminConnector) => {
    const nextStatus = connector.status === "active" ? "paused" : "active";
    try {
      await updateAdminConnector(connector.id, { status: nextStatus });
      setNotice(`Connector "${connector.name}" updated to ${nextStatus}.`);
      await loadConnectors();
      if (selectedConnectorId === connector.id) {
        await loadConnectorDetail(connector.id);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update status.");
    }
  };

  const queueSync = async (connectorId: string) => {
    setSyncingConnectorIds((prev) => [...prev, connectorId]);
    try {
      const queued = await queueAdminConnectorSync(connectorId);
      setNotice(`Sync queued. Run ID: ${queued.runId}`);
      await loadConnectors();
      if (selectedConnectorId === connectorId) {
        await loadConnectorDetail(connectorId);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to queue sync.");
    } finally {
      setSyncingConnectorIds((prev) => prev.filter((item) => item !== connectorId));
    }
  };

  const activateVersion = async (versionId: string) => {
    setActivatingVersionId(versionId);
    setCurriculumVersionsError(null);
    try {
      const activated = await activateOpsCurriculumVersion(versionId);
      setNotice(`Activated curriculum version: ${activated.label}`);
      await loadOverview();
      await loadCurriculumVersions();
    } catch (error) {
      setCurriculumVersionsError(
        error instanceof Error ? error.message : "Failed to activate version.",
      );
    } finally {
      setActivatingVersionId(null);
    }
  };

  const toggleUserActive = async (user: AdminUserListItem) => {
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      setNotice(
        `User ${user.email} ${!user.isActive ? "activated" : "deactivated"}.`,
      );
      await loadUsers(userSearch);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update user.");
    }
  };

  const toggleUserRole = async (user: AdminUserListItem) => {
    const nextRole = user.role === "admin" ? "educator" : "admin";
    try {
      await updateAdminUser(user.id, { role: nextRole });
      setNotice(`User ${user.email} role updated to ${nextRole}.`);
      await loadUsers(userSearch);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to update role.");
    }
  };

  const createUser = async () => {
    setNewUserError(null);
    setCreatingUser(true);
    try {
      const email = newUserEmail.trim().toLowerCase();
      if (!email) {
        throw new Error("Provide a valid email address.");
      }

      await createAdminUser({
        email,
        fullName: newUserFullName.trim() || undefined,
        role: newUserRole,
        isActive: true,
        preferences: {
          defaultProgramme: newUserProgramme,
          defaultDocumentType: "Lesson Plan",
          exportDefaults: { includeDisclaimers: true },
          uiPreferences: {},
        },
      });

      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserRole("educator");
      setNewUserProgramme("Nursing");
      setNotice(`User ${email} created.`);
      await loadUsers(userSearch);
    } catch (error) {
      setNewUserError(error instanceof Error ? error.message : "Failed to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const createPlan = async () => {
    setNewPlanError(null);
    setCreatingPlan(true);
    try {
      const code = newPlanCode.trim().toLowerCase();
      const name = newPlanName.trim();
      if (!code || !name) {
        throw new Error("Plan code and name are required.");
      }
      if (newPlanPriceCents < 0) {
        throw new Error("Monthly price must be 0 or greater.");
      }

      const limitsJson = parseObjectJson(newPlanLimitsText, "Plan limits JSON");
      const created = await createAdminPlan({
        code,
        name,
        monthlyPriceCents: newPlanPriceCents,
        limitsJson,
      });

      setNewPlanCode("");
      setNewPlanName("");
      setNewPlanPriceCents(0);
      setNewPlanLimitsText("{}");
      setNotice(`Plan ${created.name} created.`);
      await loadPlans();
      setSelectedPlanId(created.id);
    } catch (error) {
      setNewPlanError(error instanceof Error ? error.message : "Failed to create plan.");
    } finally {
      setCreatingPlan(false);
    }
  };

  const savePlan = async () => {
    setEditPlanError(null);
    setSavingPlan(true);
    try {
      if (!selectedPlanId) {
        throw new Error("Select a plan to update.");
      }
      const code = editPlanCode.trim().toLowerCase();
      const name = editPlanName.trim();
      if (!code || !name) {
        throw new Error("Plan code and name are required.");
      }
      if (editPlanPriceCents < 0) {
        throw new Error("Monthly price must be 0 or greater.");
      }
      const limitsJson = parseObjectJson(editPlanLimitsText, "Edit plan limits JSON");

      const updated = await updateAdminPlan(selectedPlanId, {
        code,
        name,
        monthlyPriceCents: editPlanPriceCents,
        limitsJson,
      });
      setNotice(`Plan ${updated.name} updated.`);
      await loadPlans();
    } catch (error) {
      setEditPlanError(error instanceof Error ? error.message : "Failed to update plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  const onPlanSelectionChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((item) => item.id === planId);
    if (!plan) {
      return;
    }
    setEditPlanCode(plan.code);
    setEditPlanName(plan.name);
    setEditPlanPriceCents(plan.monthlyPriceCents);
    setEditPlanLimitsText(JSON.stringify(plan.limitsJson ?? {}, null, 2));
    setEditPlanError(null);
  };

  const toggleSubscriptionCancelAtPeriodEnd = async (
    subscription: AdminSubscription,
  ) => {
    try {
      await updateAdminSubscription(subscription.id, {
        cancelAtPeriodEnd: !subscription.cancelAtPeriodEnd,
      });
      setNotice(
        `Subscription ${subscription.id.slice(0, 8)} updated successfully.`,
      );
      await loadSubscriptions();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Failed to update subscription.",
      );
    }
  };

  const createSubscription = async () => {
    setNewSubscriptionError(null);
    setCreatingSubscription(true);
    try {
      if (!newSubscriptionUserId || !newSubscriptionPlanId) {
        throw new Error("Provide user ID and plan ID.");
      }

      await createAdminSubscription({
        userId: newSubscriptionUserId.trim(),
        planId: newSubscriptionPlanId,
        provider: "manual",
        status: "active",
      });

      setNewSubscriptionUserId("");
      setNotice("Subscription created.");
      await loadSubscriptions();
      await loadUsers(userSearch);
    } catch (error) {
      setNewSubscriptionError(
        error instanceof Error
          ? error.message
          : "Failed to create subscription.",
      );
    } finally {
      setCreatingSubscription(false);
    }
  };

  const createTransaction = async () => {
    setNewTransactionError(null);
    setCreatingTransaction(true);
    try {
      if (!newTransactionUserId.trim()) {
        throw new Error("Provide user ID for transaction.");
      }
      await createAdminTransaction({
        userId: newTransactionUserId.trim(),
        subscriptionId: newTransactionSubscriptionId.trim() || undefined,
        provider: newTransactionProvider,
        transactionType: newTransactionType,
        status: newTransactionStatus,
        amountCents: newTransactionAmount,
        currency: newTransactionCurrency.toUpperCase(),
      });
      setNewTransactionUserId("");
      setNewTransactionSubscriptionId("");
      setNewTransactionAmount(0);
      setNotice("Transaction created.");
      await loadTransactions();
    } catch (error) {
      setNewTransactionError(
        error instanceof Error ? error.message : "Failed to create transaction.",
      );
    } finally {
      setCreatingTransaction(false);
    }
  };

  const markTransactionSucceeded = async (transaction: AdminTransaction) => {
    try {
      await updateAdminTransaction(transaction.id, {
        status: "succeeded",
        processedAt: new Date().toISOString(),
        errorMessage: null,
      });
      setNotice(
        `Transaction ${transaction.id.slice(0, 8)} marked as succeeded.`,
      );
      await loadTransactions();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Failed to update transaction.",
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
    } catch (error) {
      throw new Error(
        error instanceof Error ? `${field}: ${error.message}` : `${field} invalid.`,
      );
    }
  };

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
    } catch (error) {
      setGoogleDriveBrowseError(
        error instanceof Error ? error.message : "Failed to browse Google Drive folder.",
      );
    } finally {
      setGoogleDriveBrowseLoading(false);
    }
  };

  const connectGoogleDrive = async () => {
    setGoogleDriveBrowseError(null);
    setGoogleDriveConnecting(true);
    try {
      const redirectUri = window.location.origin;
      const oauthCode = await requestGoogleDriveAuthorizationCode({
        clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? "",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        redirectUri,
      });
      const session = await exchangeAdminGoogleDriveOauthCode({
        authorizationCode: oauthCode.authorizationCode,
        redirectUri,
      });
      setGoogleDriveOauthSessionId(session.oauthSessionId);
      setNotice("Google Drive connected. Now browse folders/files.");
      await browseGoogleDriveFolder(googleDriveFolderId || "root", session.oauthSessionId);
    } catch (error) {
      setGoogleDriveBrowseError(
        error instanceof Error ? error.message : "Google Drive OAuth failed.",
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

  const createConnector = async () => {
    setCreateConnectorError(null);
    setCreatingConnector(true);
    try {
      if (createConnectorForm.connectorType === "google_drive") {
        if (!googleDriveOauthSessionId.trim()) {
          throw new Error("Connect Google Drive first.");
        }

        if (googleDriveMode === "files" && googleDriveSelectedFileIds.length === 0) {
          throw new Error("Select at least one Google Drive file.");
        }

        await createAdminGoogleDriveConnector({
          oauthSessionId: googleDriveOauthSessionId.trim(),
          name: createConnectorForm.name,
          mode: googleDriveMode,
          folderId: googleDriveMode === "folder" ? googleDriveFolderId.trim() || "root" : undefined,
          fileIds: googleDriveMode === "files" ? googleDriveSelectedFileIds : undefined,
          programme: googleDriveProgramme.trim(),
          sourceType: googleDriveSourceType,
          defaultCurriculumVersionId: createConnectorForm.defaultCurriculumVersionId,
        });
      } else {
        const configJson = parseObjectJson(configJsonText, "Config JSON");
        const secretJson = parseObjectJson(secretJsonText, "Secret JSON");
        await createAdminConnector({
          ...createConnectorForm,
          configJson,
          secretJson,
        });
      }
      setShowCreateConnector(false);
      setCreateConnectorForm({
        name: "",
        connectorType: "web_url",
        configJson: {},
        secretJson: {},
      });
      setConfigJsonText("{}");
      setSecretJsonText("{}");
      setGoogleDriveOauthSessionId("");
      setGoogleDriveFolderId("root");
      setGoogleDriveItems([]);
      setGoogleDriveSelectedFileIds([]);
      setGoogleDriveMode("folder");
      setGoogleDriveSourceType("guideline");
      setGoogleDriveProgramme("Nursing");
      setGoogleDriveBrowseError(null);
      setNotice("Connector created successfully.");
      await loadConnectors();
    } catch (error) {
      setCreateConnectorError(
        error instanceof Error ? error.message : "Failed to create connector.",
      );
    } finally {
      setCreatingConnector(false);
    }
  };

  const lookupRun = async () => {
    const runId = runLookupId.trim();
    if (!runId) {
      setRunLookupError("Provide connector run ID.");
      return;
    }

    setRunLookupLoading(true);
    setRunLookupError(null);
    try {
      const result = await getAdminConnectorRun(runId);
      setRunLookupResult(result);
    } catch (error) {
      setRunLookupError(
        error instanceof Error ? error.message : "Failed to fetch run.",
      );
      setRunLookupResult(null);
    } finally {
      setRunLookupLoading(false);
    }
  };

  const isAdminAccessError = [
    aiError,
    connectorsError,
    overviewError,
    generationRunsError,
    exportJobsError,
    curriculumVersionsError,
    usersError,
    plansError,
    subscriptionsError,
    transactionsError,
    notice,
    runLookupError,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("superadmin");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ServerCog size={22} className="text-blue-600" />
            Operations Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Superadmin dashboard for AI health, RAG connectors, and ingestion runs.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
              x-user-id
            </label>
            <input
              type="text"
              value={devUserId}
              onChange={(event) => setDevUserId(event.target.value)}
              className="w-[320px] max-w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={saveDevUser}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            Save User
          </button>
          <button
            onClick={refreshAll}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCcw size={14} />
            Refresh All
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            isAdminAccessError
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">
            Providers Configured
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {providerStats.configured}/3
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">
            Probe Healthy
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {providerStats.healthy}/3
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">
            Connectors
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {connectorStats.total}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {connectorStats.active} active / {connectorStats.paused} paused /{" "}
            {connectorStats.errored} error
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500 uppercase font-semibold">
            Retrieval Blocks (7d)
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {overview?.guardrails.lowCoverageBlocks ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            stale jobs: {overview?.queue.staleRunningJobs ?? 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <BrainCircuit size={18} className="text-blue-600" />
              AI Provider Health
            </h2>
            <button
              onClick={probeProviders}
              disabled={aiLoading}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Probe
            </button>
          </div>
          <div className="p-5">
            {aiError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {aiError}
              </div>
            )}
            {!aiHealth && aiLoading && <div className="text-sm text-slate-500">Loading AI health...</div>}
            {aiHealth && (
              <div className="grid md:grid-cols-3 gap-4">
                {(["azure", "gemini", "deepseek"] as const).map((providerKey) => {
                  const provider = aiHealth.providers[providerKey];
                  return (
                    <div key={providerKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900 capitalize">{providerKey}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${provider.configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {provider.configured ? "configured" : "missing"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">model: {provider.model ?? "n/a"}</p>
                      {provider.probe && (
                        <p className={`mt-2 text-xs px-2 py-1 rounded ${provider.probe.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {provider.probe.ok ? "probe ok" : "probe failed"} ({provider.probe.latencyMs ?? 0} ms)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Search size={18} className="text-blue-600" />
              Run Inspector
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <input
              type="text"
              value={runLookupId}
              onChange={(event) => setRunLookupId(event.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Connector run UUID"
            />
            <button
              onClick={lookupRun}
              disabled={runLookupLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {runLookupLoading ? "Looking up..." : "Fetch Run"}
            </button>
            {runLookupError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {runLookupError}
              </div>
            )}
            {runLookupResult && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs space-y-1">
                <p><strong>Status:</strong> {runLookupResult.status}</p>
                <p><strong>Connector:</strong> {runLookupResult.connector?.name ?? runLookupResult.connectorId}</p>
                <p><strong>Discovered:</strong> {runLookupResult.discoveredCount}</p>
                <p><strong>Fetched:</strong> {runLookupResult.fetchedCount}</p>
                <p><strong>Indexed:</strong> {runLookupResult.indexedCount}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              RAG Connectors
            </h2>
            <button
              onClick={() => setShowCreateConnector((prev) => !prev)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 flex items-center gap-2"
            >
              <Plus size={14} />
              New Connector
            </button>
          </div>

          {showCreateConnector && (
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={createConnectorForm.name}
                  onChange={(event) =>
                    setCreateConnectorForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Connector name"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={createConnectorForm.connectorType}
                  onChange={(event) =>
                    setCreateConnectorForm((prev) => ({
                      ...prev,
                      connectorType: event.target.value as (typeof CONNECTOR_TYPES)[number],
                    }))
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
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
                    Simplified Google Drive connector: connect your account, open a folder, then choose either the whole folder or selected files.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void connectGoogleDrive()}
                      disabled={googleDriveConnecting || !import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      {googleDriveConnecting ? "Connecting..." : googleDriveOauthSessionId ? "Reconnect Google" : "Connect Google"}
                    </button>
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded ${
                        googleDriveOauthSessionId
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {googleDriveOauthSessionId ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  {!import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID && (
                    <p className="text-xs text-amber-700">
                      Set `VITE_GOOGLE_OAUTH_CLIENT_ID` to enable one-click Google OAuth.
                    </p>
                  )}

                  <div className="grid md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={googleDriveFolderId}
                      onChange={(event) => setGoogleDriveFolderId(event.target.value)}
                      placeholder="Folder ID, URL, or use Shared with me"
                      className="md:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => void browseGoogleDriveFolder()}
                      disabled={googleDriveBrowseLoading || !googleDriveOauthSessionId}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      {googleDriveBrowseLoading ? "Loading..." : "Browse Folder"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void browseGoogleDriveFolder("sharedWithMe")}
                      disabled={googleDriveBrowseLoading || !googleDriveOauthSessionId}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                    >
                      Shared with me
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Open shared root, then click Open on a shared folder.
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-2">
                    <select
                      value={googleDriveMode}
                      onChange={(event) =>
                        setGoogleDriveMode(event.target.value as "folder" | "files")
                      }
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
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
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="guideline">guideline</option>
                      <option value="syllabus">syllabus</option>
                      <option value="standards">standards</option>
                    </select>
                    <select
                      value={googleDriveProgramme}
                      onChange={(event) => setGoogleDriveProgramme(event.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
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
                                {!item.isFolder && (
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
                                    className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
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
                  <div className="text-xs text-slate-500">
                    Selected files: {googleDriveSelectedFileIds.length}
                  </div>
                  {googleDriveBrowseError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {googleDriveBrowseError}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={configJsonText}
                    onChange={(event) => setConfigJsonText(event.target.value)}
                    className="w-full min-h-[80px] border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                    placeholder='Config JSON, e.g. {"urls":["https://example.com/doc"]}'
                  />
                  <textarea
                    value={secretJsonText}
                    onChange={(event) => setSecretJsonText(event.target.value)}
                    className="w-full min-h-[80px] border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                    placeholder='Secret JSON, e.g. {"accessToken":"..."}'
                  />
                </>
              )}

              <button
                onClick={createConnector}
                disabled={creatingConnector}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
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
            {connectorsError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {connectorsError}
              </div>
            )}
            {connectorsLoading && <div className="text-sm text-slate-500">Loading connectors...</div>}
            {!connectorsLoading && connectors.length === 0 && (
              <div className="text-sm text-slate-500">No connectors configured.</div>
            )}
            {!connectorsLoading && connectors.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Last Run</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {connectors.map((connector) => {
                      const lastRun = connector.runs?.[0];
                      const syncing = syncingConnectorIds.includes(connector.id);
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
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${connector.status === "active" ? "bg-emerald-100 text-emerald-700" : connector.status === "paused" ? "bg-slate-200 text-slate-700" : "bg-red-100 text-red-700"}`}>
                              {connector.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-600">
                            {lastRun ? `${lastRun.status} (${new Date(lastRun.createdAt).toLocaleString()})` : "No runs"}
                          </td>
                          <td className="py-3 text-right space-x-2">
                            <button
                              onClick={() => void queueSync(connector.id)}
                              disabled={syncing}
                              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                            >
                              {syncing ? "Queueing..." : "Sync"}
                            </button>
                            <button
                              onClick={() => void toggleConnectorStatus(connector)}
                              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
                            >
                              {connector.status === "active" ? "Pause" : "Activate"}
                            </button>
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
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Connector Detail</h2>
          </div>
          <div className="p-5 space-y-3">
            {!selectedConnectorId && <p className="text-sm text-slate-500">Select a connector.</p>}
            {connectorDetailLoading && <p className="text-sm text-slate-500">Loading detail...</p>}
            {connectorDetail && !connectorDetailLoading && (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs space-y-1">
                  <p><strong>Name:</strong> {connectorDetail.name}</p>
                  <p><strong>Type:</strong> {connectorDetail.connectorType}</p>
                  <p><strong>Status:</strong> {connectorDetail.status}</p>
                  <p><strong>External docs:</strong> {connectorDetail.externalDocuments.length}</p>
                </div>
                <div>
                  <h3 className="text-xs uppercase font-semibold text-slate-500 mb-2">
                    Recent Runs
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {connectorDetail.runs.slice(0, 6).map((run) => (
                      <div key={run.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">{run.status}</span>
                          <span className="text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          discovered {run.discoveredCount} | fetched {run.fetchedCount} | indexed {run.indexedCount}
                        </p>
                      </div>
                    ))}
                    {connectorDetail.runs.length === 0 && (
                      <p className="text-xs text-slate-500">No runs yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Operational Signals (7 Days)</h2>
          <span className="text-xs text-slate-500">
            {overviewLoading ? "Loading..." : overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : "n/a"}
          </span>
        </div>
        <div className="p-5">
          {overviewError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {overviewError}
            </div>
          )}
          {!overviewError && overview && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="text-xs uppercase text-slate-500 font-semibold">Generation</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{overview.generation.total}</div>
                <div className="text-xs text-slate-500 mt-1">
                  ok: {overview.generation.byStatus.succeeded ?? 0} | failed: {(overview.generation.byStatus.failed ?? 0) + (overview.generation.byStatus.blocked ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="text-xs uppercase text-slate-500 font-semibold">Guardrails</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {(overview.guardrails.bySeverity.blocking ?? 0) + (overview.guardrails.bySeverity.warning ?? 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  blocking: {overview.guardrails.bySeverity.blocking ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="text-xs uppercase text-slate-500 font-semibold">Export Queue</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {overview.exports.byStatus.queued ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  failed: {overview.exports.byStatus.failed ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="text-xs uppercase text-slate-500 font-semibold">Active Curriculum</div>
                <div className="text-base font-semibold text-slate-900 mt-1 truncate">
                  {overview.curriculum.activeVersion?.label ?? "none"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  sources: {overview.curriculum.sourceCount} | chunks: {overview.curriculum.chunkCount}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Plan Management</h2>
          <span className="text-xs text-slate-500">
            {plansLoading ? "Loading..." : `${plans.length} plans`}
          </span>
        </div>
        <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="text-xs uppercase font-semibold text-slate-500">
              Create Plan
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={newPlanCode}
                onChange={(event) => setNewPlanCode(event.target.value)}
                placeholder="code (e.g. pro)"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                placeholder="name"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="number"
                value={newPlanPriceCents}
                onChange={(event) => setNewPlanPriceCents(Number(event.target.value) || 0)}
                placeholder="price cents"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <textarea
              value={newPlanLimitsText}
              onChange={(event) => setNewPlanLimitsText(event.target.value)}
              className="w-full min-h-[84px] border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
              placeholder='{"monthlyGenerations": 100, "monthlyExports": 50}'
            />
            <button
              onClick={() => void createPlan()}
              disabled={creatingPlan}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
            >
              {creatingPlan ? "Creating..." : "Create Plan"}
            </button>
            {newPlanError && <div className="text-xs text-red-700">{newPlanError}</div>}
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="text-xs uppercase font-semibold text-slate-500">
              Edit Plan
            </div>
            <select
              value={selectedPlanId}
              onChange={(event) => onPlanSelectionChange(event.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
            >
              {plans.length === 0 && <option value="">No plans available</option>}
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={editPlanCode}
                onChange={(event) => setEditPlanCode(event.target.value)}
                placeholder="code"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={editPlanName}
                onChange={(event) => setEditPlanName(event.target.value)}
                placeholder="name"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="number"
                value={editPlanPriceCents}
                onChange={(event) => setEditPlanPriceCents(Number(event.target.value) || 0)}
                placeholder="price cents"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <textarea
              value={editPlanLimitsText}
              onChange={(event) => setEditPlanLimitsText(event.target.value)}
              className="w-full min-h-[84px] border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
              placeholder='{"monthlyGenerations": 500, "monthlyExports": 250}'
            />
            <button
              onClick={() => void savePlan()}
              disabled={savingPlan || !selectedPlanId}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {savingPlan ? "Saving..." : "Save Plan"}
            </button>
            {editPlanError && <div className="text-xs text-red-700">{editPlanError}</div>}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Generation Observability</h2>
            <select
              value={generationStatusFilter}
              onChange={(event) =>
                setGenerationStatusFilter(
                  event.target.value as
                    | "all"
                    | "queued"
                    | "running"
                    | "succeeded"
                    | "failed"
                    | "blocked",
                )
              }
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
            >
              <option value="all">all</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="succeeded">succeeded</option>
              <option value="failed">failed</option>
              <option value="blocked">blocked</option>
            </select>
          </div>
          <div className="p-5">
            {generationRunsError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {generationRunsError}
              </div>
            )}
            {generationRunsLoading && (
              <div className="text-sm text-slate-500">Loading generation runs...</div>
            )}
            {!generationRunsLoading && generationRuns.length === 0 && (
              <div className="text-sm text-slate-500">No generation runs found.</div>
            )}
            {generationRuns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Doc</th>
                      <th className="py-2 pr-3">Model</th>
                      <th className="py-2 pr-3">Flags</th>
                      <th className="py-2 pr-0">At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {generationRuns.slice(0, 20).map((run) => (
                      <tr key={run.id}>
                        <td className="py-2 pr-3 text-xs">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${run.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : run.status === "failed" || run.status === "blocked" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-700 max-w-[180px] truncate">
                          {run.document?.title ?? "n/a"}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-600">
                          {run.modelProvider ?? "n/a"} / {run.modelName ?? "n/a"}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-600">
                          {run._count?.flags ?? 0}
                        </td>
                        <td className="py-2 pr-0 text-xs text-slate-500">
                          {run.createdAt ? new Date(run.createdAt).toLocaleString() : "n/a"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Export Reliability</h2>
          </div>
          <div className="p-5">
            {exportJobsError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {exportJobsError}
              </div>
            )}
            {exportJobsLoading && (
              <div className="text-sm text-slate-500">Loading export jobs...</div>
            )}
            {!exportJobsLoading && exportJobs.length === 0 && (
              <div className="text-sm text-slate-500">No export jobs found.</div>
            )}
            {exportJobs.length > 0 && (
              <div className="space-y-2 max-h-[440px] overflow-y-auto">
                {exportJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-slate-200 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {job.document?.title ?? job.documentId}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${job.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : job.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {job.format.toUpperCase()} | {new Date(job.createdAt).toLocaleString()}
                    </div>
                    {job.errorMessage && (
                      <div className="text-xs text-red-700 mt-1">{job.errorMessage}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Curriculum Version Control</h2>
          <span className="text-xs text-slate-500">
            {curriculumVersionsLoading ? "Loading..." : `${curriculumVersions.length} versions`}
          </span>
        </div>
        <div className="p-5">
          {curriculumVersionsError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {curriculumVersionsError}
            </div>
          )}
          {curriculumVersions.length === 0 && !curriculumVersionsLoading && (
            <div className="text-sm text-slate-500">No curriculum versions found.</div>
          )}
          {curriculumVersions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">Label</th>
                    <th className="py-2 pr-4">Sources</th>
                    <th className="py-2 pr-4">Chunks</th>
                    <th className="py-2 pr-4">Docs</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-0 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {curriculumVersions.map((version) => (
                    <tr key={version.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{version.label}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(version.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{version._count.sources}</td>
                      <td className="py-3 pr-4 text-slate-600">{version._count.chunks}</td>
                      <td className="py-3 pr-4 text-slate-600">{version._count.documents}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${version.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {version.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-0 text-right">
                        <button
                          onClick={() => void activateVersion(version.id)}
                          disabled={version.isActive || activatingVersionId === version.id}
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-50"
                        >
                          {version.isActive
                            ? "Active"
                            : activatingVersionId === version.id
                              ? "Activating..."
                              : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ShieldAlert size={18} className="text-blue-600" />
            Curriculum Source Inventory
          </h2>
          <span className="text-xs text-slate-500">
            {sourcesLoading ? "Loading..." : `${sources.length} sources`}
          </span>
        </div>
        <div className="p-5">
          {sourcesError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {sourcesError}
            </div>
          )}
          {sources.length === 0 && !sourcesLoading && (
            <div className="text-sm text-slate-500">No curriculum sources found.</div>
          )}
          {sources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Programme</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.slice(0, 20).map((source) => (
                    <tr key={source.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{source.name}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[320px]">
                          {source.url ?? source.storageKey}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{source.sourceType}</td>
                      <td className="py-3 pr-4 text-slate-600">{source.programme ?? "n/a"}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${source.status === "indexed" || source.status === "active" ? "bg-emerald-100 text-emerald-700" : source.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
                          {source.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">
                        {new Date(source.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search email/name..."
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
            />
            <button
              onClick={() => void loadUsers(userSearch)}
              className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
            >
              Search
            </button>
          </div>
        </div>
        <div className="p-5">
          {usersError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {usersError}
            </div>
          )}
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="text-xs uppercase font-semibold text-slate-500">
              Create User
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="email"
                value={newUserEmail}
                onChange={(event) => setNewUserEmail(event.target.value)}
                placeholder="user@edunurse.local"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newUserFullName}
                onChange={(event) => setNewUserFullName(event.target.value)}
                placeholder="Full name"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={newUserRole}
                onChange={(event) =>
                  setNewUserRole(event.target.value as "educator" | "admin")
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="educator">educator</option>
                <option value="admin">admin</option>
              </select>
              <select
                value={newUserProgramme}
                onChange={(event) => setNewUserProgramme(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="Nursing">Nursing</option>
                <option value="Midwifery">Midwifery</option>
              </select>
            </div>
            <button
              onClick={() => void createUser()}
              disabled={creatingUser}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
            >
              {creatingUser ? "Creating..." : "Create User"}
            </button>
            {newUserError && (
              <div className="text-xs text-red-700">{newUserError}</div>
            )}
          </div>
          {usersLoading && <div className="text-sm text-slate-500">Loading users...</div>}
          {!usersLoading && users.length === 0 && (
            <div className="text-sm text-slate-500">No users found.</div>
          )}
          {users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-0 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.slice(0, 30).map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{user.fullName ?? "Unnamed User"}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                        <div className="text-[10px] text-slate-400">{user.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{user.role}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {user.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {user.subscriptions?.[0]?.plan?.name ?? "n/a"}
                      </td>
                      <td className="py-3 pr-0 text-right space-x-2">
                        <button
                          onClick={() => void toggleUserRole(user)}
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
                        >
                          Make {user.role === "admin" ? "Educator" : "Admin"}
                        </button>
                        <button
                          onClick={() => void toggleUserActive(user)}
                          className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Subscriptions</h2>
            <span className="text-xs text-slate-500">
              {subscriptionsLoading ? "Loading..." : `${subscriptions.length} records`}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs uppercase font-semibold text-slate-500">
                Create Subscription
              </div>
              <select
                value={newSubscriptionUserId}
                onChange={(event) => setNewSubscriptionUserId(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>
              <select
                value={newSubscriptionPlanId}
                onChange={(event) => setNewSubscriptionPlanId(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.code})
                  </option>
                ))}
              </select>
              <button
                onClick={() => void createSubscription()}
                disabled={creatingSubscription || plansLoading}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
              >
                {creatingSubscription ? "Creating..." : "Create Subscription"}
              </button>
              {newSubscriptionError && (
                <div className="text-xs text-red-700">{newSubscriptionError}</div>
              )}
              {plansError && <div className="text-xs text-red-700">{plansError}</div>}
            </div>

            {subscriptionsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {subscriptionsError}
              </div>
            )}
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-lg border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {subscription.user?.email ?? subscription.userId}
                      </div>
                      <div className="text-xs text-slate-500">
                        {subscription.plan?.name ?? subscription.planId}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${subscription.status === "active" ? "bg-emerald-100 text-emerald-700" : subscription.status === "past_due" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>
                      {subscription.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    cancel_at_period_end: {subscription.cancelAtPeriodEnd ? "true" : "false"}
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => void toggleSubscriptionCancelAtPeriodEnd(subscription)}
                      className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
                    >
                      Toggle Cancel At Period End
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
            <span className="text-xs text-slate-500">
              {transactionsLoading ? "Loading..." : `${transactions.length} records`}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs uppercase font-semibold text-slate-500">
                Record Transaction
              </div>
              <select
                value={newTransactionUserId}
                onChange={(event) => setNewTransactionUserId(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email} ({user.role})
                  </option>
                ))}
              </select>
              <select
                value={newTransactionSubscriptionId}
                onChange={(event) => setNewTransactionSubscriptionId(event.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="">No subscription</option>
                {subscriptions
                  .filter((subscription) => subscription.userId === newTransactionUserId)
                  .map((subscription) => (
                    <option key={subscription.id} value={subscription.id}>
                      {subscription.plan?.name ?? subscription.planId} ({subscription.status})
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newTransactionProvider}
                  onChange={(event) => setNewTransactionProvider(event.target.value)}
                  placeholder="provider"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
                <select
                  value={newTransactionType}
                  onChange={(event) =>
                    setNewTransactionType(
                      event.target.value as "charge" | "refund" | "adjustment",
                    )
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="charge">charge</option>
                  <option value="refund">refund</option>
                  <option value="adjustment">adjustment</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTransactionStatus}
                  onChange={(event) =>
                    setNewTransactionStatus(
                      event.target.value as
                        | "pending"
                        | "succeeded"
                        | "failed"
                        | "canceled",
                    )
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="pending">pending</option>
                  <option value="succeeded">succeeded</option>
                  <option value="failed">failed</option>
                  <option value="canceled">canceled</option>
                </select>
                <input
                  type="number"
                  value={newTransactionAmount}
                  onChange={(event) =>
                    setNewTransactionAmount(Number(event.target.value) || 0)
                  }
                  placeholder="amount cents"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <input
                type="text"
                value={newTransactionCurrency}
                onChange={(event) => setNewTransactionCurrency(event.target.value)}
                placeholder="currency e.g USD"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <button
                onClick={() => void createTransaction()}
                disabled={creatingTransaction}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
              >
                {creatingTransaction ? "Recording..." : "Record Transaction"}
              </button>
              {newTransactionError && (
                <div className="text-xs text-red-700">{newTransactionError}</div>
              )}
            </div>

            {transactionsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {transactionsError}
              </div>
            )}
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-800">
                      {transaction.user?.email ?? transaction.userId}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${transaction.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : transaction.status === "failed" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>
                      {transaction.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {transaction.transactionType} | {transaction.amountCents}{" "}
                    {transaction.currency} | {transaction.provider}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </div>
                  {transaction.status !== "succeeded" && (
                    <div className="mt-2">
                      <button
                        onClick={() => void markTransactionSucceeded(transaction)}
                        className="px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
                      >
                        Mark Succeeded
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isAdminAccessError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <p>
            Admin endpoints require superadmin access. Use
            {" "}
            <code>00000000-0000-4000-8000-000000000000</code>.
          </p>
        </div>
      )}
    </div>
  );
};

export default OpsDashboard;
