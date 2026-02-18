/**
 * Lenco Mobile Money Payment Service
 * Handles payment collection via Lenco API
 */

import { env } from "../config.js";

const LENCO_API_BASE = env.LENCO_API_BASE_URL || "https://api.lenco.co/access/v2";

export interface InitiateMobileMoneyPaymentInput {
  amount: number; // in ZMW
  currency: string;
  phone: string;
  country: string; // e.g., "ZM" for Zambia
  reference: string; // unique reference
  bearer: "merchant" | "customer";
  metadata?: Record<string, any>;
}

export interface MobileMoneyPaymentResponse {
  status: boolean;
  message: string;
  data: {
    id: string;
    initiatedAt: string;
    completedAt: string | null;
    amount: string;
    fee: string | null;
    bearer: "merchant" | "customer";
    currency: string;
    reference: string;
    lencoReference: string;
    type: "mobile-money";
    status: "pending" | "successful" | "failed" | "pay-offline";
    source: "api";
    reasonForFailure: string | null;
    settlementStatus: "pending" | "settled" | null;
    settlement: null;
    mobileMoneyDetails: {
      country: string;
      phone: string;
      operator: string;
      accountName: string | null;
      operatorTransactionId: string | null;
    } | null;
    bankAccountDetails: null;
    cardDetails: null;
  };
}

export interface VerifyPaymentResponse {
  status: boolean;
  message: string;
  data: MobileMoneyPaymentResponse["data"];
}

/**
 * Initiate mobile money collection from customer
 */
export async function initiateMobileMoneyPayment(
  input: InitiateMobileMoneyPaymentInput
): Promise<MobileMoneyPaymentResponse> {
  const payload = {
    amount: input.amount.toFixed(2),
    currency: input.currency,
    phone: input.phone,
    country: input.country,
    reference: input.reference,
    bearer: input.bearer,
    metadata: input.metadata,
  };

  // Log the payload for debugging
  console.log("Lenco API Request:", JSON.stringify(payload, null, 2));

  const response = await fetch(`${LENCO_API_BASE}/collections/mobile-money`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LENCO_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({ message: "Unknown error" }));
  
  // Log the response for debugging
  console.log("Lenco API Response:", JSON.stringify(responseData, null, 2));

  if (!response.ok) {
    throw new Error(
      `Lenco API error: ${response.status} - ${(responseData as any).message || response.statusText}`
    );
  }

  return responseData as MobileMoneyPaymentResponse;
}

/**
 * Verify payment status
 */
export async function verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
  const response = await fetch(`${LENCO_API_BASE}/collections/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.LENCO_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(
      `Lenco API error: ${response.status} - ${(errorData as any).message || response.statusText}`
    );
  }

  return response.json() as Promise<VerifyPaymentResponse>;
}

/**
 * Generate unique payment reference
 */
export function generatePaymentReference(userId: string, type: "subscription" | "payg"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EDU-${type.toUpperCase()}-${userId.substring(0, 8)}-${timestamp}-${random}`;
}
