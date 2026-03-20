/**
 * Unified Notification Service
 * Handles Email, SMS (Africa's Talking), and WhatsApp (Meta Cloud API) messaging.
 * Logs every attempt in the notification_logs table.
 */

import { PrismaClient } from "@prisma/client";
import { env } from "../config.js";
import { getSetting } from "./system-settings.js";

let prisma: any = null;

export function setNotificationPrismaClient(p: PrismaClient) {
  prisma = p;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel = "email" | "sms" | "whatsapp";

export interface SendNotificationInput {
  channel: NotificationChannel;
  recipient: string; // email, phone (+260…), or whatsapp number
  subject?: string; // email subject or internal label
  body: string; // HTML for email, plain text for SMS/WA
  userId?: string; // optional user reference
  sentBy?: string; // admin who triggered it
}

export interface NotificationResult {
  id: string;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers — resolve config from DB or env
// ---------------------------------------------------------------------------

async function cfg(key: string): Promise<string> {
  if (prisma) {
    const val = await getSetting(prisma, key);
    if (val) return val;
  }
  return ((env as Record<string, unknown>)[key] as string) ?? "";
}

// ---------------------------------------------------------------------------
// Email — delegates to the existing email.ts service
// ---------------------------------------------------------------------------

async function sendEmailNotification(
  input: SendNotificationInput,
): Promise<NotificationResult> {
  // Dynamic import to avoid circular dependency
  const { sendCustomEmail } = await import("./email.js");
  try {
    await sendCustomEmail(input.recipient, input.subject ?? "EduNurse Notification", input.body);
    return await logNotification(input, "sent");
  } catch (err) {
    return await logNotification(
      input,
      "failed",
      err instanceof Error ? err.message : "Unknown email error",
    );
  }
}

// ---------------------------------------------------------------------------
// SMS — Africa's Talking HTTP API (no SDK dependency)
// ---------------------------------------------------------------------------

async function sendSmsNotification(
  input: SendNotificationInput,
): Promise<NotificationResult> {
  const enabled = (await cfg("SMS_ENABLED")) === "true";
  if (!enabled) {
    return await logNotification(input, "failed", "SMS is disabled.");
  }

  const apiKey = await cfg("AT_API_KEY");
  const username = (await cfg("AT_USERNAME")) || "sandbox";
  const senderId = await cfg("AT_SENDER_ID");

  if (!apiKey) {
    return await logNotification(input, "failed", "AT_API_KEY not configured.");
  }

  const baseUrl =
    username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("to", input.recipient);
  formData.append("message", input.body);
  if (senderId) formData.append("from", senderId);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: formData.toString(),
    });

    const json = (await response.json()) as {
      SMSMessageData?: {
        Recipients?: Array<{
          status: string;
          statusCode: number;
          number: string;
        }>;
      };
    };

    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.statusCode === 101) {
      return await logNotification(input, "sent");
    }

    const errMsg = recipient
      ? `AT status ${recipient.statusCode}: ${recipient.status}`
      : `HTTP ${response.status}`;
    return await logNotification(input, "failed", errMsg);
  } catch (err) {
    return await logNotification(
      input,
      "failed",
      err instanceof Error ? err.message : "SMS fetch error",
    );
  }
}

// ---------------------------------------------------------------------------
// WhatsApp — Meta Cloud API (text message)
// ---------------------------------------------------------------------------

async function sendWhatsAppNotification(
  input: SendNotificationInput,
): Promise<NotificationResult> {
  const enabled = (await cfg("WHATSAPP_ENABLED")) === "true";
  if (!enabled) {
    return await logNotification(input, "failed", "WhatsApp is disabled.");
  }

  const phoneNumberId = await cfg("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = await cfg("WHATSAPP_ACCESS_TOKEN");
  const apiVersion = (await cfg("WHATSAPP_API_VERSION")) || "v21.0";

  if (!phoneNumberId || !accessToken) {
    return await logNotification(
      input,
      "failed",
      "WhatsApp not configured (missing PHONE_NUMBER_ID or ACCESS_TOKEN).",
    );
  }

  // Normalise recipient — strip leading + if present, Meta expects digits only
  const to = input.recipient.replace(/^\+/, "").replace(/[^0-9]/g, "");

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: input.body },
      }),
    });

    if (response.ok) {
      return await logNotification(input, "sent");
    }

    const errBody = await response.text().catch(() => "");
    return await logNotification(
      input,
      "failed",
      `WhatsApp API ${response.status}: ${errBody.slice(0, 300)}`,
    );
  } catch (err) {
    return await logNotification(
      input,
      "failed",
      err instanceof Error ? err.message : "WhatsApp fetch error",
    );
  }
}

// ---------------------------------------------------------------------------
// Notification log persistence
// ---------------------------------------------------------------------------

async function logNotification(
  input: SendNotificationInput,
  status: "sent" | "failed",
  errorDetail?: string,
): Promise<NotificationResult> {
  let id = "unlogged";

  if (prisma) {
    try {
      const record = await prisma.notificationLog.create({
        data: {
          userId: input.userId ?? null,
          channel: input.channel,
          recipient: input.recipient,
          subject: input.subject ?? null,
          body: input.body.slice(0, 10_000),
          status,
          errorDetail: errorDetail ?? null,
          sentBy: input.sentBy ?? null,
        },
      });
      id = record.id;
    } catch (e) {
      console.error("[NotificationLog] Failed to persist log:", e);
    }
  }

  return {
    id,
    success: status === "sent",
    error: errorDetail,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a notification through any channel.
 */
export async function sendNotification(
  input: SendNotificationInput,
): Promise<NotificationResult> {
  switch (input.channel) {
    case "email":
      return sendEmailNotification(input);
    case "sms":
      return sendSmsNotification(input);
    case "whatsapp":
      return sendWhatsAppNotification(input);
    default:
      return { id: "", success: false, error: `Unknown channel: ${input.channel}` };
  }
}

/**
 * Send a notification to multiple channels at once.
 */
export async function sendMultiChannelNotification(
  inputs: SendNotificationInput[],
): Promise<NotificationResult[]> {
  return Promise.all(inputs.map(sendNotification));
}
