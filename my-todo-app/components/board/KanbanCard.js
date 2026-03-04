import { View, Text, StyleSheet } from 'react-native';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

function urgencyColor(fraction) {
  // green → yellow → red
  if (fraction < 0.5) {
    // green to yellow
    const t = fraction * 2;
    const r = Math.round(0x4C + (0xFF - 0x4C) * t);
    const g = Math.round(0xAF + (0xC1 - 0xAF) * t);
    const b = Math.round(0x50 + (0x07 - 0x50) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    // yellow to red
    const t = (fraction - 0.5) * 2;
    const r = Math.round(0xFF + (0xe5 - 0xFF) * t);
    const g = Math.round(0xC1 + (0x39 - 0xC1) * t);
    const b = Math.round(0x07 + (0x35 - 0x07) * t);
    return `rgb(${r},${g},${b})`;
  }
}

function computeUrgencyFraction(dueAt) {
  if (!dueAt) return null;
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const start = due - windowMs;
  const elapsed = now - start;
  return Math.min(1, Math.max(0, elapsed / windowMs));
}

export default function KanbanCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.cardId,
    data: { card },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    userSelect: 'none',
  };

  const urgencyFraction = card.type === 'deadline' ? computeUrgencyFraction(card.dueAt) : null;
  const barColor = urgencyFraction !== null ? urgencyColor(urgencyFraction) : null;

  const dueLabel = card.dueAt
    ? new Date(card.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <View style={styles.card}>
        {card.sourceColor && (
          <View style={styles.headerRow}>
            <View style={[styles.sourceDot, { backgroundColor: card.sourceColor }]} />
            <Text style={styles.sourceLabel}>{card.sourceLabel}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
        {card.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text>}
        {dueLabel && <Text style={styles.due}>Due {dueLabel}</Text>}
        {barColor && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${urgencyFraction * 100}%`, backgroundColor: barColor }]} />
          </View>
        )}
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  sourceLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  due: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  barTrack: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});
