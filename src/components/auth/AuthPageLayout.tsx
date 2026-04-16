import React from "react";
import { Link } from "react-router-dom";

type AuthPageLayoutProps = {
  brandHref?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentWidthClassName?: string;
  contentAlignment?: "center" | "start";
};

type AuthBrandProps = {
  inverse?: boolean;
};

const authInputBaseClassName =
  "block w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base leading-6 text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const authLabelClassName = "block text-sm font-semibold text-slate-700";
export const authInputClassName = authInputBaseClassName;
export const authInputWithIconClassName = `${authInputBaseClassName} pl-11`;
export const authTextAreaClassName = `${authInputBaseClassName} min-h-[7.5rem] resize-y`;
export const authCheckboxClassName =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200";
export const authButtonClassName =
  "inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none";
export const authInlineLinkClassName =
  "font-semibold text-blue-600 transition hover:text-blue-700";
export const authMutedLinkClassName =
  "font-medium text-slate-600 transition hover:text-slate-900";

export function getAuthAlertClassName(
  tone: "error" | "warning" | "success" = "error",
) {
  const toneClassNames = {
    error: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  } as const;

  return `rounded-2xl border px-4 py-3 text-sm ${toneClassNames[tone]}`;
}

function AuthBrand({ inverse = false }: AuthBrandProps) {
  const badgeClassName = inverse
    ? "bg-white text-blue-600"
    : "bg-blue-600 text-white shadow-lg shadow-blue-600/20";
  const textClassName = inverse ? "text-white" : "text-slate-900";
  const subTextClassName = inverse ? "text-white/75" : "text-slate-500";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${badgeClassName}`}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      </div>
      <div>
        <div className={`text-lg font-semibold tracking-tight ${textClassName}`}>
          EduNurse<span className="font-light">Pro</span>
        </div>
        <div className={`text-xs ${subTextClassName}`}>
          Nursing education tools
        </div>
      </div>
    </div>
  );
}

const AuthPageLayout: React.FC<AuthPageLayoutProps> = ({
  brandHref = "/signin",
  eyebrow = "Secure access",
  title,
  description,
  children,
  footer,
  contentWidthClassName = "max-w-lg",
  contentAlignment = "center",
}) => {
  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f8fbff_0%,#f6f7f8_42%,#eef4fb_100%)]">
      <div className="mx-auto flex min-h-[100dvh] w-full items-stretch xl:max-w-7xl xl:p-4">
        <div className="flex w-full flex-1 overflow-hidden bg-white xl:max-h-[calc(100dvh-2rem)] xl:rounded-[32px] xl:border xl:border-slate-200/80 xl:shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <aside className="relative hidden xl:flex xl:w-[45%] xl:flex-col xl:overflow-hidden xl:bg-slate-900">
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1576091160550-217358c7db81?auto=format&fit=crop&q=80&w=2000"
                alt=""
                onError={(event) => {
                  event.currentTarget.style.opacity = "0";
                }}
                className="h-full w-full object-cover opacity-35 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.65),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.3),rgba(15,23,42,0.92))]" />
            </div>

            <div className="relative z-10 flex h-full flex-col justify-between gap-10 p-12 text-white">
              <div className="space-y-8">
                <AuthBrand inverse />
                <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/85 backdrop-blur-sm">
                  Built for nursing education
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-5">
                  <h2 className="text-4xl font-semibold leading-tight">
                    Teaching workflows that feel calm, fast, and organized.
                  </h2>
                  <p className="text-lg leading-8 text-white/80">
                    Access curriculum-aligned resources, generate lesson plans,
                    and support learners with less admin friction.
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    "Curriculum-ready planning support",
                    "Protected educator and student access",
                    "Designed for mobile and desktop workflows",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85 backdrop-blur-sm"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {[51, 52, 53].map((imageId) => (
                        <img
                          key={imageId}
                          className="inline-block h-10 w-10 rounded-full ring-2 ring-white/70"
                          src={`https://picsum.photos/id/${imageId}/100/100`}
                          alt=""
                        />
                      ))}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        Trusted by 12,000+ tutors
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/65">
                        Secure sign-in experience
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex min-h-[100dvh] flex-1 flex-col overflow-y-auto xl:min-h-0">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-10 xl:px-12">
              <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
                <Link
                  to={brandHref}
                  className="transition hover:opacity-90"
                  aria-label="EduNurse Pro"
                >
                  <AuthBrand />
                </Link>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {eyebrow}
                </div>
              </div>

              <div
                className={`flex flex-1 flex-col ${
                  contentAlignment === "center" ? "justify-center" : "justify-start"
                }`}
              >
                <div className={`mx-auto w-full ${contentWidthClassName}`}>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                      {title}
                    </h1>
                    {description ? (
                      <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                        {description}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-5 sm:mt-6">{children}</div>

                  {footer ? <div className="mt-5 sm:mt-6">{footer}</div> : null}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AuthPageLayout;
