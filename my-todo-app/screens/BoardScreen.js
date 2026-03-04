import { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useBoardState from '../hooks/useBoardState';
import KanbanBoard from '../components/board/KanbanBoard';
import CalendarPicker from '../components/board/CalendarPicker';
import DayView from '../components/board/DayView';

export default function BoardScreen() {
  const { cards, loading, reload, moveCard } = useBoardState();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Reload whenever this tab comes into focus so new todos appear immediately
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Board</Text>

      <CalendarPicker selected={selectedDate} onSelect={setSelectedDate} />

      <DayView cards={cards} selectedDate={selectedDate} />

      {loading ? (
        <ActivityIndicator style={styles.spinner} size="large" color="#4CAF50" />
      ) : (
        <KanbanBoard cards={cards} onMoveCard={moveCard} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#333',
  },
  spinner: {
    flex: 1,
    alignSelf: 'center',
  },
});
