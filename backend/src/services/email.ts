/**
 * Email Service
 * Handles all email notifications using Microsoft 365/Outlook SMTP or other providers
 */

import { env } from "../config.js";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { getSetting } from "./system-settings.js";

let transporter: Transporter | null = null;
let prismaClient: PrismaClient | null = null;

/**
 * Set Prisma client for settings lookup
 */
export function setEmailPrismaClient(prisma: PrismaClient) {
  prismaClient = prisma;
}

/**
 * Get email configuration from database or environment
 */
async function getEmailConfig() {
  if (!prismaClient) {
    // Fallback to environment variables
    return {
      enabled: env.EMAIL_ENABLED,
      from: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME || "EduNurse",
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
      smtpSecure: env.SMTP_SECURE,
      smtpUser: env.SMTP_USER,
      smtpPass: env.SMTP_PASS,
    };
  }

  // Get from database settings
  const [enabled, from, fromName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass] = await Promise.all([
    getSetting(prismaClient, "EMAIL_ENABLED"),
    getSetting(prismaClient, "EMAIL_FROM"),
    getSetting(prismaClient, "EMAIL_FROM_NAME"),
    getSetting(prismaClient, "SMTP_HOST"),
    getSetting(prismaClient, "SMTP_PORT"),
    getSetting(prismaClient, "SMTP_SECURE"),
    getSetting(prismaClient, "SMTP_USER"),
    getSetting(prismaClient, "SMTP_PASS"),
  ]);

  return {
    enabled: enabled === "true",
    from: from || env.EMAIL_FROM,
    fromName: fromName || env.EMAIL_FROM_NAME || "EduNurse",
    smtpHost: smtpHost || env.SMTP_HOST,
    smtpPort: parseInt(smtpPort || String(env.SMTP_PORT)),
    smtpSecure: (smtpSecure || String(env.SMTP_SECURE)) === "true",
    smtpUser: smtpUser || env.SMTP_USER,
    smtpPass: smtpPass || env.SMTP_PASS,
  };
}

/**
 * Initialize email transporter based on configuration
 */
async function getTransporter(): Promise<Transporter | null> {
  const config = await getEmailConfig();

  if (!config.enabled) {
    return null;
  }

  // Reset transporter if configuration might have changed
  transporter = null;

  // Microsoft 365 / Outlook SMTP configuration
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure, // true for 465, false for other ports
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false, // For self-signed certificates
      },
    });

    console.log(`[Email] Initialized SMTP transporter: ${config.smtpHost}:${config.smtpPort}`);
  }

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface WelcomeEmailData {
  userName: string;
  freeGenerations: number;
}

export interface PaymentConfirmationData {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface LowCreditsWarningData {
  userName: string;
  generationsRemaining: number;
}

export interface SubscriptionRenewalData {
  userName: string;
  renewalDate: string;
  amount: number;
  currency: string;
}

export interface ExportReadyData {
  userName: string;
  documentTitle: string;
  format: string;
  downloadUrl: string;
}

/**
 * Send email using configured provider
 */
async function sendEmail(options: EmailOptions): Promise<void> {
  if (!env.EMAIL_ENABLED) {
    console.log("[Email] Disabled - would send:", options.subject, "to", options.to);
    return;
  }

  const transport = await getTransporter();

  // Development mode - log emails
  if (env.NODE_ENV === "development" && !transport) {
    console.log("\n=== EMAIL ===");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("Body:", options.text || options.html.substring(0, 200) + "...");
    console.log("=============\n");
    return;
  }

  // Send via SMTP (Microsoft 365/Outlook or other)
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: `"${env.EMAIL_FROM_NAME || 'EduNurse'}" <${env.EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log(`[Email] Sent to ${options.to}: ${info.messageId}`);
    } catch (error) {
      console.error("[Email] Failed to send:", error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return;
  }

  // Fallback: log warning if no provider configured
  console.warn("[Email] No email provider configured. Email not sent:", options.subject);
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  data: WelcomeEmailData
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .bonus-box { background: #dcfce7; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to EduNurse!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          
          <p>Welcome to EduNurse - your AI-powered lesson planning assistant for nursing education!</p>
          
          <div class="bonus-box">
            <h2 style="margin-top: 0; color: #16a34a;">🎁 Your Welcome Bonus</h2>
            <p style="font-size: 18px; margin: 10px 0;">
              <strong>${data.freeGenerations} FREE lesson plan generations</strong>
            </p>
            <p style="margin-bottom: 0;">
              No payment required - start creating professional lesson plans right away!
            </p>
          </div>
          
          <h3>What You Can Do:</h3>
          <ul>
            <li>✅ Generate curriculum-aligned lesson plans</li>
            <li>✅ Export to PDF, DOCX, or PowerPoint</li>
            <li>✅ Access nursing education templates</li>
            <li>✅ Get AI-powered content suggestions</li>
          </ul>
          
          <p style="text-align: center;">
            <a href="${env.FRONTEND_URL}/dashboard" class="cta-button">
              Create Your First Lesson Plan
            </a>
          </p>
          
          <h3>Need Help?</h3>
          <p>Check out our <a href="${env.FRONTEND_URL}/help">Help Center</a> or reply to this email with any questions.</p>
          
          <p>Happy teaching!</p>
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
          <p>You received this email because you signed up for EduNurse.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to EduNurse!

Hi ${data.userName},

Welcome to EduNurse - your AI-powered lesson planning assistant!

YOUR WELCOME BONUS:
${data.freeGenerations} FREE lesson plan generations - no payment required!

What You Can Do:
- Generate curriculum-aligned lesson plans
- Export to PDF, DOCX, or PowerPoint
- Access nursing education templates
- Get AI-powered content suggestions

Get started: ${env.FRONTEND_URL}/dashboard

Happy teaching!
The EduNurse Team
  `;

  await sendEmail({
    to: email,
    subject: "🎉 Welcome to EduNurse - Your Free Trial Awaits!",
    html,
    text,
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  data: PaymentConfirmationData
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .receipt-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .total-row { font-weight: bold; font-size: 18px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Payment Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          
          <p>Thank you for your payment! Your subscription is now active.</p>
          
          <div class="receipt-box">
            <h3 style="margin-top: 0;">Payment Receipt</h3>
            <div class="receipt-row">
              <span>Plan:</span>
              <span><strong>${data.planName}</strong></span>
            </div>
            <div class="receipt-row total-row">
              <span>Amount Paid:</span>
              <span>${data.currency} ${data.amount.toFixed(2)}</span>
            </div>
            <div class="receipt-row">
              <span>Reference:</span>
              <span>${data.reference}</span>
            </div>
          </div>
          
          <p>You can now enjoy all the benefits of your ${data.planName}!</p>
          
          <p style="text-align: center;">
            <a href="${env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Go to Dashboard
            </a>
          </p>
          
          <p>Need help? Contact us at ${env.SUPPORT_EMAIL}</p>
          
          <p>Thank you for choosing EduNurse!</p>
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "✅ Payment Confirmed - EduNurse",
    html,
    text: `Payment Confirmed!\n\nHi ${data.userName},\n\nThank you for your payment!\n\nPlan: ${data.planName}\nAmount: ${data.currency} ${data.amount}\nReference: ${data.reference}\n\nYour subscription is now active.\n\nThe EduNurse Team`,
  });
}

/**
 * Send low credits warning email
 */
export async function sendLowCreditsWarningEmail(
  email: string,
  data: LowCreditsWarningData
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .warning-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Running Low on Credits</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          
          <div class="warning-box">
            <h2 style="margin-top: 0; color: #f59e0b;">
              You have ${data.generationsRemaining} generation${data.generationsRemaining !== 1 ? 's' : ''} left
            </h2>
            <p style="margin-bottom: 0;">
              Don't let your lesson planning stop! Get more credits or upgrade to unlimited.
            </p>
          </div>
          
          <h3>Choose Your Plan:</h3>
          <ul>
            <li><strong>Monthly Subscription (K99)</strong> - Unlimited generations & exports</li>
            <li><strong>Pay As You Go (K40)</strong> - 2 more generations & exports</li>
          </ul>
          
          <p style="text-align: center;">
            <a href="${env.FRONTEND_URL}/subscribe" class="cta-button">
              Get More Credits
            </a>
          </p>
          
          <p>Questions? Reply to this email or visit our <a href="${env.FRONTEND_URL}/help">Help Center</a>.</p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `⚠️ Only ${data.generationsRemaining} Generation${data.generationsRemaining !== 1 ? 's' : ''} Left - EduNurse`,
    html,
    text: `Running Low on Credits\n\nHi ${data.userName},\n\nYou have ${data.generationsRemaining} generation${data.generationsRemaining !== 1 ? 's' : ''} remaining.\n\nGet more credits: ${env.FRONTEND_URL}/subscribe\n\nThe EduNurse Team`,
  });
}

/**
 * Send subscription renewal reminder
 */
export async function sendSubscriptionRenewalEmail(
  email: string,
  data: SubscriptionRenewalData
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Subscription Renewal Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          
          <p>Your EduNurse subscription will renew soon.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0;">Renewal Details</h3>
            <p><strong>Renewal Date:</strong> ${data.renewalDate}</p>
            <p><strong>Amount:</strong> ${data.currency} ${data.amount.toFixed(2)}</p>
            <p style="margin-bottom: 0;"><strong>Payment Method:</strong> Mobile Money</p>
          </div>
          
          <p>Your subscription will automatically renew, and you'll continue enjoying unlimited access to EduNurse.</p>
          
          <p>Want to make changes? Visit your <a href="${env.FRONTEND_URL}/account/subscription">subscription settings</a>.</p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🔄 Your Subscription Renews Soon - EduNurse",
    html,
    text: `Subscription Renewal Reminder\n\nHi ${data.userName},\n\nYour subscription renews on ${data.renewalDate} for ${data.currency} ${data.amount}.\n\nManage subscription: ${env.FRONTEND_URL}/account/subscription\n\nThe EduNurse Team`,
  });
}

/**
 * Send export ready notification
 */
export async function sendExportReadyEmail(
  email: string,
  data: ExportReadyData
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📄 Your Export is Ready!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          
          <p>Your lesson plan export is ready to download:</p>
          
          <p><strong>${data.documentTitle}</strong> (${data.format.toUpperCase()})</p>
          
          <p style="text-align: center;">
            <a href="${data.downloadUrl}" class="cta-button">
              Download Now
            </a>
          </p>
          
          <p style="font-size: 12px; color: #6b7280;">
            Note: This download link will expire in 24 hours.
          </p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `📄 Export Ready: ${data.documentTitle} - EduNurse`,
    html,
    text: `Your Export is Ready!\n\nHi ${data.userName},\n\n${data.documentTitle} (${data.format.toUpperCase()}) is ready to download.\n\nDownload: ${data.downloadUrl}\n\nLink expires in 24 hours.\n\nThe EduNurse Team`,
  });
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedEmail(
  email: string,
  userName: string,
  reason: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Payment Failed</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          
          <p>We were unable to process your payment.</p>
          
          <p><strong>Reason:</strong> ${reason}</p>
          
          <p>Please try again or contact your mobile money provider for assistance.</p>
          
          <p style="text-align: center;">
            <a href="${env.FRONTEND_URL}/subscribe" class="cta-button">
              Try Again
            </a>
          </p>
          
          <p>Need help? Contact us at ${env.SUPPORT_EMAIL}</p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "❌ Payment Failed - EduNurse",
    html,
    text: `Payment Failed\n\nHi ${userName},\n\nWe were unable to process your payment.\n\nReason: ${reason}\n\nTry again: ${env.FRONTEND_URL}/subscribe\n\nThe EduNurse Team`,
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail(
  email: string,
  userName: string,
  verificationToken: string
): Promise<void> {
  const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .token-box { background: white; border: 2px dashed #cbd5e1; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; font-family: monospace; font-size: 18px; letter-spacing: 2px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          
          <p>Thank you for signing up for EduNurse! Please verify your email address to activate your account.</p>
          
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="cta-button">
              Verify Email Address
            </a>
          </p>
          
          <p style="font-size: 12px; color: #6b7280;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
          </p>
          
          <p style="font-size: 12px; color: #6b7280;">
            This verification link will expire in 24 hours.
          </p>
          
          <p>If you didn't create an account with EduNurse, you can safely ignore this email.</p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "📧 Verify Your Email - EduNurse",
    html,
    text: `Verify Your Email\n\nHi ${userName},\n\nPlease verify your email address by clicking this link:\n${verificationUrl}\n\nThis link expires in 24 hours.\n\nThe EduNurse Team`,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .warning-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          
          <p>We received a request to reset your password for your EduNurse account.</p>
          
          <p style="text-align: center;">
            <a href="${resetUrl}" class="cta-button">
              Reset Password
            </a>
          </p>
          
          <p style="font-size: 12px; color: #6b7280;">
            Or copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <div class="warning-box">
            <p style="margin: 0; font-size: 14px;">
              ⚠️ This password reset link will expire in 1 hour for security reasons.
            </p>
          </div>
          
          <p><strong>Didn't request a password reset?</strong></p>
          <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
          
          <p>For security, never share this link with anyone.</p>
          
          <p><strong>The EduNurse Team</strong></p>
        </div>
        <div class="footer">
          <p>EduNurse - AI-Powered Nursing Education</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "🔐 Reset Your Password - EduNurse",
    html,
    text: `Reset Your Password\n\nHi ${userName},\n\nWe received a request to reset your password.\n\nReset your password by clicking this link:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.\n\nThe EduNurse Team`,
  });
}
