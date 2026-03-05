import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

const SOURCE_COLORS = {
  canvas_gt:  '#B3A369',
  canvas_ucf: '#FFC904',
  microsoft:  '#0078D4',
  gmail:      '#EA4335',
  todo:       '#4CAF50',
};

const SOURCE_LABELS = {
  canvas_gt:  'GT Canvas',
  canvas_ucf: 'UCF Canvas',
  microsoft:  'Microsoft',
  gmail:      'Gmail',
  todo:       'Todo',
};

function countdown(dueAt) {
  const diff = new Date(dueAt) - Date.now();
  if (diff <= 0) return 'Overdue';
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d}d`;
  if (d === 1) return '1d';
  if (h >= 1) return `${h}h`;
  return `${Math.floor(diff / 60_000)}m`;
}

export default function DeadlineCard({ item, onDismiss, overleafLinks = {} }) {
  const color = SOURCE_COLORS[item.source] || '#888';
  const label = SOURCE_LABELS[item.source] || item.source;
  const timer = countdown(item.due_at);
  const urgent = (new Date(item.due_at) - Date.now()) < 24 * 3_600_000;

  // Find Overleaf link: match by course name (substring match)
  const overleafUrl = item.course
    ? Object.entries(overleafLinks).find(([k]) =>
        item.course.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(item.course.toLowerCase())
      )?.[1]
    : null;

  return (
    <View style={styles.card}>
      <View style={[styles.sourceBadge, { backgroundColor: color }]}>
        <Text style={styles.sourceText}>{label}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.course ? <Text style={styles.course}>{item.course}</Text> : null}
        {overleafUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(overleafUrl)} style={styles.overleafBtn}>
            <Text style={styles.overleafText}>📄 Open in Overleaf</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.countdown, urgent && styles.urgent]}>{timer}</Text>
        <TouchableOpacity onPress={() => onDismiss(item.id)} style={styles.dismissBtn}>
          <Text style={styles.dismissText}>{item.isTodo ? '✓' : '✕'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sourceBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 10,
    alignSelf: 'flex-start',
  },
  sourceText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#222' },
  course: { fontSize: 12, color: '#888', marginTop: 2 },
  overleafBtn: { marginTop: 6 },
  overleafText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  right: { alignItems: 'flex-end', marginLeft: 8 },
  countdown: { fontSize: 14, fontWeight: '700', color: '#555' },
  urgent: { color: '#e53935' },
  dismissBtn: { marginTop: 6 },
  dismissText: { color: '#bbb', fontSize: 14 },
});
