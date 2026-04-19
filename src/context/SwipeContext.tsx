import React, { createContext, useContext, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ProductSwipeOverlay from "@/components/surte/ProductSwipeOverlay";

interface SwipeFilter {
  categorySlug?: string | null;
  brand?: string | null;
  tag?: string | null;
  productId?: string | null;   // anchor product (optional)
}

interface SwipeContextValue {
  open: (filter: SwipeFilter) => void;
  close: () => void;
  isOpen: boolean;
}

const SwipeContext = createContext<SwipeContextValue | undefined>(undefined);

export const SwipeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [filter, setFilter] = useState<SwipeFilter | null>(null);
  const navigate = useNavigate();

  const open = useCallback((f: SwipeFilter) => setFilter(f), []);
  const close = useCallback(() => setFilter(null), []);

  const handleNavigate = useCallback((slug: string) => {
    setFilter(null);
    navigate(`/p/${slug}`);
  }, [navigate]);

  return (
    <SwipeContext.Provider value={{ open, close, isOpen: !!filter }}>
      {children}
      {filter && (
        <ProductSwipeOverlay
          currentProductId={filter.productId || ""}
          categorySlug={filter.categorySlug || null}
          brand={filter.brand || null}
          tag={filter.tag || null}
          onClose={close}
          onNavigate={handleNavigate}
        />
      )}
    </SwipeContext.Provider>
  );
};

export const useSwipe = () => {
  const ctx = useContext(SwipeContext);
  if (!ctx) throw new Error("useSwipe must be used within SwipeProvider");
  return ctx;
};
