import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { startOfflineQueueProcessor } from "../services/backendApi";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALL_DISMISS_KEY = "edunurse_pwa_install_dismissed_at";
const INSTALL_DISMISS_TTL_MS = 1000 * 60 * 60 * 24;

function isStandalone() {
  if (typeof window === "undefined") return false;
  const displayStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  )?.matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(displayStandalone || iosStandalone);
}

function shouldSuppressInstallPrompt() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return false;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed < INSTALL_DISMISS_TTL_MS;
}

function dismissInstallPrompt() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
}

const bannerBaseClass =
  "fixed left-1/2 z-[60] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur";

export function PwaManager() {
  const isOnline = useOnlineStatus();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [offlineReadyVisible, setOfflineReadyVisible] = useState(true);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const stop = startOfflineQueueProcessor();
    return () => {
      stop();
    };
  }, []);

  useEffect(() => {
    setInstallDismissed(shouldSuppressInstallPrompt());
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandalone() || installDismissed) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setInstallDismissed(true);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(INSTALL_DISMISS_KEY);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installDismissed]);

  const showInstallBanner = useMemo(
    () =>
      Boolean(
        installEvent && !installDismissed && !isStandalone() && isOnline,
      ),
    [installEvent, installDismissed, isOnline],
  );

  const handleInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstallEvent(null);
        return;
      }
    } catch (error) {
      console.warn("PWA install prompt failed:", error);
    }

    dismissInstallPrompt();
    setInstallDismissed(true);
    setInstallEvent(null);
  };

  const handleDismissInstall = () => {
    dismissInstallPrompt();
    setInstallDismissed(true);
    setInstallEvent(null);
  };

  return (
    <>
      {!isOnline && (
        <div className={`${bannerBaseClass} top-3 border-amber-200 bg-amber-50 text-amber-800`}>
          <div className="flex items-center gap-2 text-sm">
            <WifiOff size={16} />
            <span>You are offline. Cached content is available, but generation and exports may be limited.</span>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <div className={`${bannerBaseClass} ${isOnline ? "top-3" : "top-20"} border-blue-200 bg-blue-50 text-blue-900`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Download size={16} />
              <span>Install EduNurse for faster loading and a full-screen app experience.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Install
              </button>
              <button
                onClick={handleDismissInstall}
                className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className={`${bannerBaseClass} bottom-4 border-emerald-200 bg-emerald-50 text-emerald-900`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw size={16} />
              <span>New version available. Refresh to update the app.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Refresh
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="rounded-md border border-emerald-300 bg-white p-1.5 text-emerald-700 hover:bg-emerald-100"
                aria-label="Dismiss update banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {offlineReady && offlineReadyVisible && (
        <div className={`${bannerBaseClass} bottom-4 border-slate-200 bg-white text-slate-800`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Offline cache is ready.</span>
            <button
              onClick={() => {
                setOfflineReady(false);
                setOfflineReadyVisible(false);
              }}
              className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label="Dismiss offline-ready banner"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PwaManager;
