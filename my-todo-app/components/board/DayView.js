import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

function isSameDay(isoString, date) {
  const d = new Date(isoString);
  return d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate();
}

function isEmergency(isoString) {
  const due = new Date(isoString).getTime();
  return due - Date.now() < 3 * 3600 * 1000; // overdue or < 3h
}

function relativeTime(isoString) {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return 'Overdue';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

function Section({ title, color, items, renderItem }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { backgroundColor: color + '18' }]}>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color }]}>{items.length}</Text>
      </View>
      {items.map(renderItem)}
    </View>
  );
}

function DeadlineItem({ card }) {
  const sourceColors = {
    canvas_gt: '#B3A369', canvas_ucf: '#FFC904', microsoft: '#0078D4', gmail: '#EA4335',
  };
  const color = sourceColors[card.sourceLabel] || '#888';
  return (
    <View style={styles.item}>
      <View style={[styles.itemDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{card.title}</Text>
        {card.subtitle && <Text style={styles.itemSub}>{card.subtitle}</Text>}
      </View>
      {card.dueAt && (
        <Text style={styles.itemTime}>{relativeTime(card.dueAt)}</Text>
      )}
    </View>
  );
}

function TodoItem({ card }) {
  const isDone = card.column === 'done';
  return (
    <View style={styles.item}>
      <Text style={styles.todoCheck}>{isDone ? '✓' : '○'}</Text>
      <Text style={[styles.itemTitle, isDone && styles.done]} numberOfLines={1}>{card.title}</Text>
      {!card.dueDate && (
        <Text style={styles.noDate}>no date</Text>
      )}
    </View>
  );
}

export default function DayView({ cards, selectedDate, height }) {
  const { theme } = useTheme();
  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const emergency = cards.filter(c =>
    c.type === 'deadline' && c.dueAt && isEmergency(c.dueAt)
  );

  const deadlinesToday = cards.filter(c =>
    c.type === 'deadline' && c.dueAt &&
    isSameDay(c.dueAt, selectedDate) &&
    !isEmergency(c.dueAt)
  );

  const selISO = selectedDate.toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday = selISO === todayISO;

  const todos = cards.filter(c => {
    if (c.type !== 'todo') return false;
    if (c.dueDate) return c.dueDate === selISO;  // dated todo: show on its due date
    return isToday;                               // undated todo: only show on today
  });

  const isEmpty = !emergency.length && !deadlinesToday.length && !todos.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderBottomColor: theme.columnBorder || '#eee', height: height ?? 220 }]}>
      <Text style={[styles.dateLabel, { color: theme.titleColor }]}>{dateLabel}</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section
          title="🚨 Emergency"
          color="#e53935"
          items={emergency}
          renderItem={c => <DeadlineItem key={c.cardId} card={c} />}
        />
        <Section
          title="📅 Deadlines"
          color="#1565C0"
          items={deadlinesToday}
          renderItem={c => <DeadlineItem key={c.cardId} card={c} />}
        />
        <Section
          title="✅ Todos"
          color="#388E3C"
          items={todos}
          renderItem={c => <TodoItem key={c.cardId} card={c} />}
        />
        {isEmpty && (
          <Text style={styles.empty}>Nothing scheduled for this day.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    overflow: 'hidden',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#444',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scroll: { flex: 1 },
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 11, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  itemTitle: { flex: 1, fontSize: 13, color: '#222' },
  itemSub: { fontSize: 11, color: '#888' },
  itemTime: { fontSize: 11, color: '#e53935', fontWeight: '600', marginLeft: 6 },
  todoCheck: { fontSize: 14, color: '#4CAF50', marginRight: 8 },
  noDate: { fontSize: 10, color: '#ccc', marginLeft: 6 },
  done: { textDecorationLine: 'line-through', color: '#aaa' },
  empty: { fontSize: 13, color: '#bbb', textAlign: 'center', padding: 20 },
});
