import { View, StyleSheet } from 'react-native';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import confetti from 'canvas-confetti';
import KanbanColumn from './KanbanColumn';

const COLUMNS = ['backlog', 'todo', 'inprogress', 'done'];

function celebrate() {
  const duration = 2500;
  const end = Date.now() + duration;

  // Two cannons from bottom-left and bottom-right
  (function frame() {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 1 },
      colors: ['#4CAF50', '#FFC107', '#2196F3', '#E91E63', '#FF5722'],
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 1 },
      colors: ['#4CAF50', '#FFC107', '#2196F3', '#E91E63', '#FF5722'],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

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
    if (!COLUMNS.includes(newColumn)) return;

    const card = cards.find(c => c.cardId === cardId);
    const wasNotDone = card && card.column !== 'done';
    if (newColumn === 'done' && wasNotDone) celebrate();

    onMoveCard(cardId, newColumn);
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
