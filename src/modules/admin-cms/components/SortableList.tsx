import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SortableItem from "./SortableItem";

interface SortableListProps {
  items: any[];
  table: string;
  queryKeys: string[];
  queryClient: any;
  renderItem: (item: any) => ReactNode;
}

const SortableList = ({ items, table, queryKeys, queryClient, renderItem }: SortableListProps) => {
  const [localItems, setLocalItems] = useState<any[]>(items || []);

  useEffect(() => {
    setLocalItems(items || []);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localItems, oldIndex, newIndex);

    // Optimistic local update (immediate visual feedback)
    setLocalItems(reordered);

    try {
      for (const [idx, item] of reordered.entries()) {
        const { error } = await supabase
          .from(table as any)
          .update({ sort_order: idx } as any)
          .eq("id", item.id);
        if (error) throw error;
      }

      // Invalidate queries to refetch from DB
      queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: [qk] }));
      toast.success("Orden actualizado");
    } catch (err) {
      // Revert on error
      setLocalItems(items || []);
      toast.error("Error al actualizar el orden");
    }
  }, [localItems, table, queryKeys, queryClient, items]);

  if (!localItems?.length) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {localItems.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              {renderItem(item)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortableList;