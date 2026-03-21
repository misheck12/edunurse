import crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import { env } from "../config.js";

const TOKEN_VERSION = "v1";

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export function signAuthToken(
  payload: Omit<AuthTokenPayload, "iat" | "exp">,
  expiresInSeconds = env.AUTH_TOKEN_TTL_SECONDS,
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenPayload: AuthTokenPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(tokenPayload),
    "utf8",
  ).toString("base64url");
  const unsignedToken = `${TOKEN_VERSION}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", env.AUTH_TOKEN_SECRET)
    .update(unsignedToken)
    .digest("base64url");

  return `${unsignedToken}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [version, encodedPayload, signature] = token.split(".");
  if (!version || !encodedPayload || !signature) {
    return null;
  }
  if (version !== TOKEN_VERSION) {
    return null;
  }

  const unsignedToken = `${version}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac("sha256", env.AUTH_TOKEN_SECRET)
    .update(unsignedToken)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<AuthTokenPayload>;

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "admin" && payload.role !== "educator" && payload.role !== "student") ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      return null;
    }

    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}
