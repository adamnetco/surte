import React, { createContext, useContext, useState, useCallback } from "react";
import { addBusinessDays } from "date-fns";

export interface AgentCustomer {
  profileId: string;
  userId: string;
  customerCode: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  businessType: string;
  businessName: string | null;
}

interface AgentContextType {
  customer: AgentCustomer | null;
  setCustomer: (c: AgentCustomer | null) => void;
  deliveryDate: Date;
  setDeliveryDate: (d: Date) => void;
  defaultDeliveryDate: Date;
  clearAgent: () => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const getDefaultDeliveryDate = () => addBusinessDays(new Date(), 2);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<AgentCustomer | null>(null);
  const defaultDeliveryDate = getDefaultDeliveryDate();
  const [deliveryDate, setDeliveryDate] = useState<Date>(defaultDeliveryDate);

  const clearAgent = useCallback(() => {
    setCustomer(null);
    setDeliveryDate(getDefaultDeliveryDate());
  }, []);

  return (
    <AgentContext.Provider value={{ customer, setCustomer, deliveryDate, setDeliveryDate, defaultDeliveryDate, clearAgent }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
};
