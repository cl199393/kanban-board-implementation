import { View, Text, Image, StyleSheet } from 'react-native';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTheme } from '../../contexts/ThemeContext';
import { getCharacter } from '../../constants/themes';

function urgencyColor(fraction) {
  if (fraction < 0.5) {
    const t = fraction * 2;
    return `rgb(${Math.round(0x4C + (0xFF - 0x4C) * t)},${Math.round(0xAF + (0xC1 - 0xAF) * t)},${Math.round(0x50 + (0x07 - 0x50) * t)})`;
  } else {
    const t = (fraction - 0.5) * 2;
    return `rgb(${Math.round(0xFF + (0xe5 - 0xFF) * t)},${Math.round(0xC1 + (0x39 - 0xC1) * t)},${Math.round(0x07 + (0x35 - 0x07) * t)})`;
  }
}

function computeUrgencyFraction(dueAt) {
  if (!dueAt) return null;
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  return Math.min(1, Math.max(0, (now - (due - windowMs)) / windowMs));
}

export default function KanbanCard({ card }) {
  const { theme } = useTheme();
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

  const character = card.type === 'deadline'
    ? getCharacter(card.dueAt, theme)
    : (card.dueDate ? getCharacter(card.dueDate + 'T23:59:00', theme) : getCharacter(null, theme));

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: theme.cardBorder !== 'transparent' ? 1 : 0 }]}>

        {/* Zootopia character headshot */}
        {character && (
          <View style={[styles.characterRow, { backgroundColor: character.bg }]}>
            <Image source={character.image} style={styles.characterImg} />
            <Text style={[styles.characterLabel, { color: character.color }]}>{character.label}</Text>
          </View>
        )}

        {card.sourceColor && (
          <View style={styles.headerRow}>
            <View style={[styles.sourceDot, { backgroundColor: card.sourceColor }]} />
            <Text style={[styles.sourceLabel, { color: theme.subtitleColor }]}>{card.sourceLabel}</Text>
          </View>
        )}

        <Text style={[styles.title, { color: theme.headerText }]} numberOfLines={2}>{card.title}</Text>
        {card.subtitle && <Text style={[styles.subtitle, { color: theme.subtitleColor }]} numberOfLines={1}>{card.subtitle}</Text>}
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
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  characterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  characterImg: { width: 32, height: 32, borderRadius: 16, marginRight: 2 },
  characterLabel: { fontSize: 10, fontWeight: '700', flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 10, paddingTop: 8 },
  sourceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  sourceLabel: { fontSize: 10, textTransform: 'capitalize' },
  title: { fontSize: 13, fontWeight: '600', marginBottom: 2, paddingHorizontal: 10 },
  subtitle: { fontSize: 11, marginBottom: 2, paddingHorizontal: 10 },
  due: { fontSize: 10, color: '#999', marginTop: 2, paddingHorizontal: 10, paddingBottom: 6 },
  barTrack: { height: 4, backgroundColor: '#eee', overflow: 'hidden' },
  barFill: { height: 4 },
});
