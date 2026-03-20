/**
 * System Settings Service
 * Manages database-stored configuration that can be updated via ops dashboard
 */

import { PrismaClient } from "@prisma/client";
import { env } from "../config.js";

export interface SystemSettingDefinition {
  key: string;
  category: string;
  description: string;
  defaultValue: string;
  isSecret: boolean;
}

// Define all configurable settings
export const SETTING_DEFINITIONS: SystemSettingDefinition[] = [
  // Email Settings
  {
    key: "EMAIL_ENABLED",
    category: "email",
    description: "Enable/disable email notifications",
    defaultValue: "true",
    isSecret: false,
  },
  {
    key: "EMAIL_FROM",
    category: "email",
    description: "From email address",
    defaultValue: "noreply@edunurse.com",
    isSecret: false,
  },
  {
    key: "EMAIL_FROM_NAME",
    category: "email",
    description: "From name displayed in emails",
    defaultValue: "EduNurse",
    isSecret: false,
  },
  {
    key: "SUPPORT_EMAIL",
    category: "email",
    description: "Support email address",
    defaultValue: "support@edunurse.com",
    isSecret: false,
  },
  {
    key: "SMTP_HOST",
    category: "email",
    description: "SMTP server hostname (e.g., smtp.office365.com)",
    defaultValue: "",
    isSecret: false,
  },
  {
    key: "SMTP_PORT",
    category: "email",
    description: "SMTP server port (587 for STARTTLS, 465 for SSL)",
    defaultValue: "587",
    isSecret: false,
  },
  {
    key: "SMTP_SECURE",
    category: "email",
    description: "Use SSL/TLS (true for port 465, false for port 587)",
    defaultValue: "false",
    isSecret: false,
  },
  {
    key: "SMTP_USER",
    category: "email",
    description: "SMTP username/email",
    defaultValue: "",
    isSecret: false,
  },
  {
    key: "SMTP_PASS",
    category: "email",
    description: "SMTP password or app password",
    defaultValue: "",
    isSecret: true,
  },
  // Application Settings
  {
    key: "FRONTEND_URL",
    category: "application",
    description: "Frontend application URL",
    defaultValue: "http://localhost:3000",
    isSecret: false,
  },
  {
    key: "WHATSAPP_GROUP_LINK",
    category: "application",
    description: "WhatsApp support group link",
    defaultValue: "",
    isSecret: false,
  },
  // SMS Settings (Africa's Talking)
  {
    key: "SMS_ENABLED",
    category: "sms",
    description: "Enable/disable SMS notifications",
    defaultValue: "false",
    isSecret: false,
  },
  {
    key: "AT_API_KEY",
    category: "sms",
    description: "Africa's Talking API key",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "AT_USERNAME",
    category: "sms",
    description: "Africa's Talking username (use 'sandbox' for testing)",
    defaultValue: "sandbox",
    isSecret: false,
  },
  {
    key: "AT_SENDER_ID",
    category: "sms",
    description: "SMS Sender ID (e.g. EduNurse). Leave blank for default.",
    defaultValue: "",
    isSecret: false,
  },
  // WhatsApp Settings (Meta Cloud API)
  {
    key: "WHATSAPP_ENABLED",
    category: "whatsapp",
    description: "Enable/disable WhatsApp messaging",
    defaultValue: "false",
    isSecret: false,
  },
  {
    key: "WHATSAPP_PHONE_NUMBER_ID",
    category: "whatsapp",
    description: "Meta WhatsApp Business phone number ID",
    defaultValue: "",
    isSecret: false,
  },
  {
    key: "WHATSAPP_ACCESS_TOKEN",
    category: "whatsapp",
    description: "Meta WhatsApp Business permanent access token",
    defaultValue: "",
    isSecret: true,
  },
  {
    key: "WHATSAPP_API_VERSION",
    category: "whatsapp",
    description: "Meta Graph API version (e.g. v21.0)",
    defaultValue: "v21.0",
    isSecret: false,
  },
];

/**
 * Get a system setting value
 * Falls back to environment variable if not in database
 */
export async function getSetting(
  prisma: PrismaClient,
  key: string
): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  if (setting?.value) {
    return setting.value;
  }

  // Fallback to environment variable
  return (env as Record<string, unknown>)[key] as string | null;
}

/**
 * Get multiple settings by category
 */
export async function getSettingsByCategory(
  prisma: PrismaClient,
  category: string
): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany({
    where: { category },
    select: { key: true, value: true },
  });

  const result: Record<string, string> = {};
  
  for (const setting of settings) {
    if (setting.value) {
      result[setting.key] = setting.value;
    }
  }

  // Add environment fallbacks for missing settings
  const categoryDefs = SETTING_DEFINITIONS.filter((def) => def.category === category);
  for (const def of categoryDefs) {
    if (!result[def.key]) {
      const envValue = (env as Record<string, unknown>)[def.key];
      if (envValue) {
        result[def.key] = String(envValue);
      }
    }
  }

  return result;
}

/**
 * Set a system setting value
 */
export async function setSetting(
  prisma: PrismaClient,
  key: string,
  value: string,
  updatedBy?: string
): Promise<void> {
  const definition = SETTING_DEFINITIONS.find((def) => def.key === key);
  
  if (!definition) {
    throw new Error(`Unknown setting key: ${key}`);
  }

  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      category: definition.category,
      description: definition.description,
      isSecret: definition.isSecret,
      updatedBy,
    },
    update: {
      value,
      updatedBy,
    },
  });
}

/**
 * Get all settings grouped by category
 */
export async function getAllSettings(
  prisma: PrismaClient
): Promise<Record<string, Array<{ key: string; value: string; description: string; isSecret: boolean }>>> {
  const settings = await prisma.systemSetting.findMany({
    select: { key: true, value: true, category: true, description: true, isSecret: true },
  });

  const result: Record<string, Array<{ key: string; value: string; description: string; isSecret: boolean }>> = {};

  // Group by category
  for (const def of SETTING_DEFINITIONS) {
    if (!result[def.category]) {
      result[def.category] = [];
    }

    const dbSetting = settings.find((s) => s.key === def.key);
    const value = dbSetting?.value || (env as Record<string, unknown>)[def.key] as string || def.defaultValue;

    result[def.category].push({
      key: def.key,
      value: def.isSecret && value ? "********" : value,
      description: def.description,
      isSecret: def.isSecret,
    });
  }

  return result;
}

/**
 * Initialize default settings in database
 */
export async function initializeSettings(prisma: PrismaClient): Promise<void> {
  for (const def of SETTING_DEFINITIONS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: def.key },
    });

    if (!existing) {
      const envValue = (env as Record<string, unknown>)[def.key];
      const value = envValue ? String(envValue) : def.defaultValue;

      await prisma.systemSetting.create({
        data: {
          key: def.key,
          value,
          category: def.category,
          description: def.description,
          isSecret: def.isSecret,
        },
      });
    }
  }
}
