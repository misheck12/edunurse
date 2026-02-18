declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: "popup" | "redirect";
            redirect_uri?: string;
            callback: (response: { code?: string; scope?: string; error?: string }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google OAuth is only available in browser."));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-identity='true']",
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity script."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function requestGoogleDriveAuthorizationCode(input: {
  clientId: string;
  scopes?: string[];
  redirectUri?: string;
}) {
  if (!input.clientId) {
    throw new Error(
      "Missing VITE_GOOGLE_OAUTH_CLIENT_ID. Configure it to enable one-click Google connect.",
    );
  }

  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google OAuth client failed to initialize.");
  }

  const scopeList =
    input.scopes?.join(" ") ||
    "https://www.googleapis.com/auth/drive.readonly";
  const redirectUri =
    input.redirectUri ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  return await new Promise<{ authorizationCode: string; scope?: string }>(
    (resolve, reject) => {
      const codeClient = oauth2.initCodeClient({
      client_id: input.clientId,
      scope: scopeList,
      ux_mode: "popup",
      redirect_uri: redirectUri,
      callback: (response) => {
        if (response.error || !response.code) {
          reject(
            new Error(response.error ?? "Failed to obtain Google authorization code."),
          );
          return;
        }
        resolve({
          authorizationCode: response.code,
          scope: response.scope,
        });
      },
      error_callback: (error) => {
        reject(error instanceof Error ? error : new Error("Google OAuth popup failed."));
      },
    });

      codeClient.requestCode();
    },
  );
}

export {};
