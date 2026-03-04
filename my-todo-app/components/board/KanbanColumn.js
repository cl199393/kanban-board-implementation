import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';

const COLUMN_LABELS = {
  backlog: 'Backlog',
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done',
};

export default function KanbanColumn({ columnId, cards }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <View style={styles.column}>
      <Text style={styles.header}>{COLUMN_LABELS[columnId]}</Text>
      <View style={[styles.dropArea, isOver && styles.dropOver]} ref={setNodeRef}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {cards.map(card => (
            <KanbanCard key={card.cardId} card={card} />
          ))}
          {cards.length === 0 && (
            <Text style={styles.empty}>Drop here</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    marginHorizontal: 4,
  },
  header: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  dropArea: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dropOver: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9',
  },
  scroll: {
    flex: 1,
  },
  empty: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 20,
  },
});
