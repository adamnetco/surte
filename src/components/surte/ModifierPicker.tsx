import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

export type SelectedModifier = {
  groupId: string;
  groupName: string;
  optionId: string;
  displayName: string;
  linkedProductId: string | null;
  linkedProductName: string | null;
  priceAdjustment: number;
  quantity: number;
};

interface ModifierPickerProps {
  productId: string;
  onModifiersChange: (modifiers: SelectedModifier[], totalAdjustment: number, isValid: boolean) => void;
}

const ModifierPicker = ({ productId, onModifiersChange }: ModifierPickerProps) => {
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  // { [groupId]: { [optionId]: quantity } }

  const { data: groups } = useQuery({
    queryKey: ["product-modifier-groups", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const { data: allOptions } = useQuery({
    queryKey: ["product-modifier-options", productId],
    queryFn: async () => {
      if (!groups || groups.length === 0) return [];
      const groupIds = groups.map((g) => g.id);
      const { data, error } = await supabase
        .from("modifier_options")
        .select("*")
        .in("modifier_group_id", groupIds)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!groups && groups.length > 0,
  });

  // Linked product names
  const linkedIds = allOptions?.filter((o) => o.linked_product_id).map((o) => o.linked_product_id!) || [];
  const { data: linkedProducts } = useQuery({
    queryKey: ["linked-products", linkedIds.join(",")],
    queryFn: async () => {
      if (linkedIds.length === 0) return [];
      const { data, error } = await supabase.from("products").select("id, name, stock, image_url").in("id", linkedIds);
      if (error) throw error;
      return data;
    },
    enabled: linkedIds.length > 0,
  });

  const getLinked = (id: string | null) => linkedProducts?.find((p) => p.id === id);

  // Build flat modifier list + validation
  useEffect(() => {
    if (!groups || !allOptions) return;

    const modifiers: SelectedModifier[] = [];
    let totalAdj = 0;
    let valid = true;

    for (const group of groups) {
      const groupSel = selections[group.id] || {};
      const opts = allOptions.filter((o) => o.modifier_group_id === group.id);
      let selectedCount = 0;
      const pricingMode = (group as any).pricing_mode || "sum";
      let groupAdjustments: number[] = [];

      for (const opt of opts) {
        const qty = groupSel[opt.id] || 0;
        if (qty > 0) {
          selectedCount += qty;
          const linked = getLinked(opt.linked_product_id);
          modifiers.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            displayName: opt.display_name,
            linkedProductId: opt.linked_product_id,
            linkedProductName: linked?.name || null,
            priceAdjustment: opt.price_adjustment * qty,
            quantity: qty,
          });
          groupAdjustments.push(opt.price_adjustment * qty);
        }
      }

      // Apply pricing mode
      if (pricingMode === "max_price" && groupAdjustments.length > 0) {
        totalAdj += Math.max(...groupAdjustments);
      } else {
        totalAdj += groupAdjustments.reduce((s, v) => s + v, 0);
      }

      if (group.is_required && selectedCount < (group.min_selections || 1)) {
        valid = false;
      }
      if (group.selection_type === "multiple" && group.max_selections > 0 && selectedCount > group.max_selections) {
        valid = false;
      }
    }

    onModifiersChange(modifiers, totalAdj, valid);
  }, [selections, groups, allOptions, linkedProducts]);

  if (!groups || groups.length === 0) return null;

  const toggleSingle = (groupId: string, optionId: string) => {
    setSelections((prev) => {
      const current = prev[groupId] || {};
      if (current[optionId]) {
        // Deselect
        const { [optionId]: _, ...rest } = current;
        return { ...prev, [groupId]: rest };
      }
      // Select only this one
      return { ...prev, [groupId]: { [optionId]: 1 } };
    });
  };

  const toggleMultiple = (groupId: string, optionId: string, maxSelections: number) => {
    setSelections((prev) => {
      const current = prev[groupId] || {};
      if (current[optionId]) {
        // Deselect
        const { [optionId]: _, ...rest } = current;
        return { ...prev, [groupId]: rest };
      }
      // Check max
      const currentCount = Object.values(current).reduce((s, v) => s + v, 0);
      if (maxSelections > 0 && currentCount >= maxSelections) return prev;
      return { ...prev, [groupId]: { ...current, [optionId]: 1 } };
    });
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const opts = allOptions?.filter((o) => o.modifier_group_id === group.id) || [];
        const groupSel = selections[group.id] || {};
        const selectedCount = Object.values(groupSel).reduce((s, v) => s + v, 0);
        const isSingle = group.selection_type === "single";

        const minNeeded = group.is_required ? Math.max(group.min_selections || 1, 1) : 0;
        const isIncomplete = group.is_required && selectedCount < minNeeded;

        return (
          <div key={group.id} className="bg-muted/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-heading font-bold text-foreground">{group.display_label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {isSingle ? "Elige uno" : `Elige ${group.min_selections || 0} a ${group.max_selections}`}
                  {group.is_required && <span className="text-destructive ml-1">*</span>}
                  {(group as any).pricing_mode === "max_price" && (
                    <span className="text-accent ml-1">· Se cobra el de mayor valor</span>
                  )}
                </p>
              </div>
              {isIncomplete && (
                <span className="text-[9px] text-destructive font-medium flex items-center gap-0.5">
                  <AlertCircle size={10} /> Requerido
                </span>
              )}
              {!isIncomplete && selectedCount > 0 && (
                <span className="text-[9px] text-secondary font-medium bg-secondary/10 px-1.5 py-0.5 rounded-full">
                  {selectedCount} elegido{selectedCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {opts.map((opt) => {
                const isSelected = !!groupSel[opt.id];
                const linked = getLinked(opt.linked_product_id);
                const outOfStock = linked && linked.stock <= 0;

                return (
                  <motion.button
                    key={opt.id}
                    whileTap={{ scale: 0.98 }}
                    disabled={!!outOfStock}
                    onClick={() => {
                      if (isSingle) toggleSingle(group.id, opt.id);
                      else toggleMultiple(group.id, opt.id, group.max_selections);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all border ${
                      outOfStock
                        ? "opacity-40 cursor-not-allowed border-border bg-muted"
                        : isSelected
                        ? "border-accent bg-accent/10 shadow-sm"
                        : "border-transparent bg-card hover:border-border"
                    }`}
                  >
                    {/* Checkbox/Radio */}
                    <div className={`w-5 h-5 rounded-${isSingle ? "full" : "md"} border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "bg-accent border-accent" : "border-muted-foreground/30 bg-card"
                    }`}>
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Check size={12} className="text-accent-foreground" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Option info */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                        {opt.display_name}
                      </span>
                      {linked && (
                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                          {linked.name}
                          {outOfStock && <span className="text-destructive ml-1">· Agotado</span>}
                        </p>
                      )}
                    </div>

                    {/* Price adjustment */}
                    {opt.price_adjustment !== 0 && (
                      <span className={`text-[11px] font-semibold flex-shrink-0 ${opt.price_adjustment > 0 ? "text-accent" : "text-secondary"}`}>
                        {opt.price_adjustment > 0 ? "+" : ""}{formatPrice(opt.price_adjustment)}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ModifierPicker;
