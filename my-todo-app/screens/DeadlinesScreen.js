import { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl,
  StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import useDeadlines from '../hooks/useDeadlines';
import useNotifications from '../hooks/useNotifications';
import DeadlineCard from '../components/DeadlineCard';
import { useTheme } from '../contexts/ThemeContext';
import ThemePicker from '../components/ThemePicker';
import { BACKEND_URL } from '../constants/config';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NUM_DAYS = 60; // show 60 days starting today

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDays() {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < NUM_DAYS; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push({
      iso: toISO(d),
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
    });
  }
  return days;
}

const DAYS = buildDays();

function formatSelectedDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function DeadlinesScreen() {
  const { theme } = useTheme();
  const { deadlines, loading, error, refresh, dismiss } = useDeadlines();
  useNotifications(deadlines);
  const [overleafLinks, setOverleafLinks] = useState({});

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const stripRef = useRef(null);

  function refreshOverleafLinks() {
    fetch(`${BACKEND_URL}/overleaf-links`)
      .then(r => r.ok ? r.json() : {})
      .then(setOverleafLinks)
      .catch(() => {});
  }

  useEffect(() => { refreshOverleafLinks(); }, []);

  // Scroll to today on mount
  useEffect(() => {
    if (stripRef.current) {
      setTimeout(() => stripRef.current?.scrollTo({ x: 0, animated: false }), 100);
    }
  }, []);

  const filtered = deadlines.filter(d => d.due_at && d.due_at.slice(0, 10) === selectedDate);

  if (loading && deadlines.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.subtitleColor }]}>Loading deadlines...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.titleColor }]}>
          {theme.id === 'zootopia' ? '🐰 Deadlines' : 'Deadlines'}
        </Text>
        <ThemePicker />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Offline — showing cached data</Text>
        </View>
      ) : null}

      {/* Date strip */}
      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.strip, { backgroundColor: theme.cardBg }]}
        contentContainerStyle={styles.stripContent}
      >
        {DAYS.map((day, i) => {
          const isSelected = day.iso === selectedDate;
          const isToday = day.iso === todayISO;
          return (
            <TouchableOpacity
              key={day.iso}
              onPress={() => setSelectedDate(day.iso)}
              style={[
                styles.dayCell,
                isSelected && { backgroundColor: theme.primary },
              ]}
            >
              {i === 0 || day.dayNum === 1 ? (
                <Text style={[styles.monthLabel, { color: isSelected ? '#fff' : theme.subtitleColor }]}>
                  {day.month}
                </Text>
              ) : <Text style={styles.monthLabel}> </Text>}
              <Text style={[styles.dayName, { color: isSelected ? '#fff' : theme.subtitleColor }]}>
                {isToday ? 'Today' : day.dayName}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? '#fff' : theme.headerText }]}>
                {day.dayNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected date label */}
      <Text style={[styles.dateLabel, { color: theme.subtitleColor }]}>
        {formatSelectedDate(selectedDate)}
      </Text>

      {/* Deadline list for selected date */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DeadlineCard
            item={item}
            onDismiss={dismiss}
            overleafLinks={overleafLinks}
            onOverleafLinkAdded={refreshOverleafLinks}
          />
        )}}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.primary} />}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: theme.headerText }]}>No deadlines</Text>
            <Text style={[styles.emptySubtext, { color: theme.subtitleColor }]}>
              Nothing due on this day
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20,
  },
  title: { fontSize: 32, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  loadingText: { marginTop: 12, fontSize: 15 },
  emptyText: { fontSize: 18, fontWeight: '600' },
  emptySubtext: { fontSize: 13, marginTop: 6 },
  errorBanner: {
    backgroundColor: '#fff3e0', paddingVertical: 8, paddingHorizontal: 16,
    marginHorizontal: 16, borderRadius: 8, marginBottom: 8,
  },
  errorText: { color: '#e65100', fontSize: 13, textAlign: 'center' },
  strip: { maxHeight: 90, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  stripContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  dayCell: {
    alignItems: 'center', justifyContent: 'center',
    width: 52, borderRadius: 12, paddingVertical: 6,
  },
  monthLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', height: 13 },
  dayName: { fontSize: 11, marginBottom: 2 },
  dayNum: { fontSize: 18, fontWeight: '700' },
  dateLabel: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});
