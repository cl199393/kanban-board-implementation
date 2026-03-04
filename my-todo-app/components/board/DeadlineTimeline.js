import { useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

const DAY_WIDTH = 60;
const DAYS_BEFORE = 7;   // days before today shown on left
const DAYS_AFTER = 30;   // days after today shown on right
const NUM_DAYS = DAYS_BEFORE + DAYS_AFTER;
const TOTAL_WIDTH = DAY_WIDTH * NUM_DAYS;
const TODAY_X = DAYS_BEFORE * DAY_WIDTH;

function urgencyColorForDue(dueAt) {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff < 0) return '#e53935';           // overdue
  if (diff < 1 * 24 * 3600 * 1000) return '#FF6D00'; // < 1 day
  if (diff < 3 * 24 * 3600 * 1000) return '#FFC107'; // < 3 days
  return '#4CAF50';
}

export default function DeadlineTimeline({ deadlines }) {
  const scrollRef = useRef(null);

  // Scroll so today is near the left edge
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, TODAY_X - 20), animated: false });
    }
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - DAYS_BEFORE);

  // Build day ticks every 3 days across the full range
  const ticks = [];
  for (let i = 0; i < NUM_DAYS; i += 3) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ticks.push({ i, label });
  }

  // Position deadlines relative to startDay
  const positioned = deadlines
    .filter(d => d.dueAt)
    .map(d => {
      const due = new Date(d.dueAt);
      due.setHours(0, 0, 0, 0);
      const dayOffset = (due.getTime() - startDay.getTime()) / (24 * 3600 * 1000);
      return { ...d, dayOffset };
    })
    .filter(d => d.dayOffset >= 0 && d.dayOffset < NUM_DAYS);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={{ width: TOTAL_WIDTH }}
      >
        {/* Day ticks */}
        {ticks.map(({ i, label }) => (
          <View key={i} style={[styles.tick, { left: i * DAY_WIDTH }]}>
            <View style={styles.tickLine} />
            <Text style={styles.tickLabel}>{label}</Text>
          </View>
        ))}

        {/* Today marker */}
        <View style={[styles.todayLine, { left: TODAY_X }]} />

        {/* Deadline markers */}
        {positioned.map((d, idx) => {
          const x = d.dayOffset * DAY_WIDTH;
          const color = d.sourceColor || urgencyColorForDue(d.dueAt);
          return (
            <View key={d.cardId || idx} style={[styles.marker, { left: Math.max(0, x) }]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.markerLabel} numberOfLines={1}>{d.title}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    backgroundColor: '#1e1e2e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  scroll: {
    flex: 1,
  },
  tick: {
    position: 'absolute',
    top: 0,
    height: '100%',
    alignItems: 'flex-start',
  },
  tickLine: {
    width: 1,
    height: 10,
    backgroundColor: '#555',
    marginTop: 4,
  },
  tickLabel: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
    width: 55,
  },
  todayLine: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  marker: {
    position: 'absolute',
    top: 22,
    alignItems: 'center',
    width: 50,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 2,
  },
  markerLabel: {
    fontSize: 8,
    color: '#ccc',
    width: 50,
    textAlign: 'center',
  },
});
