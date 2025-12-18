'use client';

import React, { useState, useEffect } from 'react';

export interface BillingData {
  totalCost: number;
  totalTokens?: number;
  usageHistory: Array<{
    timestamp: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  }>;
}

// Create a context for billing data so it can be shared across components
const BillingContext = React.createContext<{
  billingData: BillingData | null;
  refetch: () => Promise<void>;
} | null>(null);

// Hook to fetch billing data - uses context if available, otherwise creates its own state
export function useBilling() {
  const context = React.useContext(BillingContext);

  // If context exists, use it
  if (context) {
    return context;
  }

  // Otherwise, create local state (for backward compatibility)
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  const fetchBilling = async () => {
    try {
      const response = await fetch('/api/billing');
      const data = await response.json();
      setBillingData(data);
    } catch (e) {
      console.error('Failed to fetch billing data', e);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  return { billingData, refetch: fetchBilling };
}

// Provider component to share billing state
export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  const fetchBilling = async () => {
    try {
      const response = await fetch('/api/billing');
      const data = await response.json();
      setBillingData(data);
    } catch (e) {
      console.error('Failed to fetch billing data', e);
    }
  };

  useEffect(() => {
    fetchBilling();
    // Billing data is refetched automatically after AI requests complete
    // via refetch() calls in useAIChat and other components
  }, []);

  return (
    <BillingContext.Provider value={{ billingData, refetch: fetchBilling }}>
      {children}
    </BillingContext.Provider>
  );
}

