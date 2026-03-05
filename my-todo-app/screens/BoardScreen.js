import { useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, PanResponder } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useBoardState from '../hooks/useBoardState';
import KanbanBoard from '../components/board/KanbanBoard';
import CalendarPicker from '../components/board/CalendarPicker';
import DayView from '../components/board/DayView';
import { useTheme } from '../contexts/ThemeContext';
import ThemePicker from '../components/ThemePicker';

const MIN_TOP = 0;
const MAX_TOP = 700;
const DEFAULT_TOP = 220;

export default function BoardScreen() {
  const { theme } = useTheme();
  const { cards, loading, reload, moveCard } = useBoardState();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [topHeight, setTopHeight] = useState(DEFAULT_TOP);
  const topHeightRef = useRef(DEFAULT_TOP);
  const dragStartHeight = useRef(DEFAULT_TOP);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  function updateHeight(h) {
    const clamped = Math.max(MIN_TOP, Math.min(MAX_TOP, h));
    topHeightRef.current = clamped;
    setTopHeight(clamped);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartHeight.current = topHeightRef.current;
      },
      onPanResponderMove: (_, gs) => {
        updateHeight(dragStartHeight.current + gs.dy);
      },
    })
  ).current;

  const selectedISO = selectedDate.toISOString().slice(0, 10);
  const filteredCards = cards.filter(c => {
    const dateStr = c.dueDate || (c.dueAt ? c.dueAt.slice(0, 10) : null);
    return dateStr === selectedISO;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.titleColor }]}>
          {theme.id === 'zootopia' ? '🦥 Board' : 'Board'}
        </Text>
        <ThemePicker />
      </View>

      <CalendarPicker selected={selectedDate} onSelect={setSelectedDate} />
      <DayView cards={filteredCards} selectedDate={selectedDate} height={topHeight} />

      {/* Draggable divider */}
      <View
        {...panResponder.panHandlers}
        style={[styles.divider, { backgroundColor: theme.cardBg, borderColor: theme.columnBorder || '#ddd' }]}
      >
        <View style={[styles.handle, { backgroundColor: theme.subtitleColor || '#ccc' }]} />
      </View>

      {loading
        ? <ActivityIndicator style={styles.spinner} size="large" color={theme.primary} />
        : <KanbanBoard cards={filteredCards} onMoveCard={moveCard} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  spinner: { flex: 1, alignSelf: 'center' },
  divider: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    cursor: 'row-resize',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
});
