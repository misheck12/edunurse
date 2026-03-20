/**
 * Usage Context
 * Single source of truth for subscription usage data
 * Eliminates duplicate API calls across components
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getAuthToken } from "../services/backendApi";
import type { UsageLimits, UsageSummary } from "../types/subscription";

interface UsageContextValue {
  limits: UsageLimits | null;
  summary: UsageSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

interface UsageProviderProps {
  children: ReactNode;
}

export const UsageProvider: React.FC<UsageProviderProps> = ({ children }) => {
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/payments/usage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch usage data");
      }

      const data = await response.json();
      if (data.success) {
        setLimits(data.data.limits);
        setSummary(data.data.summary);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
      setError(err instanceof Error ? err.message : "Failed to load usage data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchUsage();
  }, [fetchUsage]);

  return (
    <UsageContext.Provider value={{ limits, summary, isLoading, error, refresh }}>
      {children}
    </UsageContext.Provider>
  );
};

/**
 * Hook to access usage data from context
 * Must be used within UsageProvider
 */
export function useUsage(): UsageContextValue {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error("useUsage must be used within UsageProvider");
  }
  return context;
}

/**
 * Hook to check if user can generate
 */
export function useCanGenerate(): { canGenerate: boolean; isLoading: boolean } {
  const { limits, isLoading } = useUsage();
  return {
    canGenerate: limits?.canGenerate ?? false,
    isLoading,
  };
}

/**
 * Hook to check if user can export
 */
export function useCanExport(): { canExport: boolean; isLoading: boolean } {
  const { limits, isLoading } = useUsage();
  return {
    canExport: limits?.canExport ?? false,
    isLoading,
  };
}

export default UsageContext;
