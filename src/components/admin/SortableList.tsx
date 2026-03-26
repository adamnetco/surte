import { ReactNode, useCallback, useState } from "react";
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
  const [localItems, setLocalItems] = useState<any[] | null>(null);
  const displayItems = localItems ?? items;

  // Reset local state when items change from outside
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setLocalItems(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentItems = localItems ?? items;
    const oldIndex = currentItems.findIndex((i) => i.id === active.id);
    const newIndex = currentItems.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentItems, oldIndex, newIndex);

    // Optimistic local update (immediate visual feedback)
    setLocalItems(reordered);

    try {
      // Persist new sort_order values
      const updates = reordered.map((item, idx) =>
        supabase.from(table as any).update({ sort_order: idx } as any).eq("id", item.id)
      );
      await Promise.all(updates);

      // Invalidate queries to refetch from DB
      queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: [qk] }));
      toast.success("Orden actualizado");
    } catch (err) {
      // Revert on error
      setLocalItems(null);
      toast.error("Error al actualizar el orden");
    }
  }, [items, localItems, table, queryKeys, queryClient]);

  if (!displayItems?.length) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={displayItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {displayItems.map((item) => (
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