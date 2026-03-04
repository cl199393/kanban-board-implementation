import { View, StyleSheet } from 'react-native';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';

const COLUMNS = ['backlog', 'todo', 'inprogress', 'done'];

export default function KanbanBoard({ cards, onMoveCard }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const cardId = active.id;
    const newColumn = over.id;
    if (COLUMNS.includes(newColumn)) {
      onMoveCard(cardId, newColumn);
    }
  }

  const cardsByColumn = {};
  for (const col of COLUMNS) {
    cardsByColumn[col] = cards.filter(c => c.column === col);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <View style={styles.row}>
        {COLUMNS.map(col => (
          <KanbanColumn key={col} columnId={col} cards={cardsByColumn[col]} />
        ))}
      </View>
    </DndContext>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
  },
});
