import { ReactNode, useCallback } from "react";
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    queryKeys.forEach((qk) => {
      queryClient.setQueryData([qk], reordered);
    });

    // Persist new order
    const updates = reordered.map((item, idx) =>
      supabase.from(table).update({ sort_order: idx }).eq("id", item.id)
    );
    await Promise.all(updates);
    queryKeys.forEach((qk) => queryClient.invalidateQueries({ queryKey: [qk] }));
    toast.success("Orden actualizado");
  }, [items, table, queryKeys, queryClient]);

  if (!items?.length) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
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
