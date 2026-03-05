import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { BACKEND_URL } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import ThemePicker from '../components/ThemePicker';

const STORAGE_KEY = 'todos';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NUM_DAYS = 60;

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

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function WebDateInput({ value, onChange }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', fontSize: 14,
        color: value ? '#333' : '#aaa', backgroundColor: '#f0f0f0', outline: 'none', cursor: 'pointer' }}
    />
  );
}

export default function TodoScreen() {
  const { theme } = useTheme();
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [dueDate, setDueDate] = useState(todayISO);
  const [dueTime, setDueTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  });
  const [location, setLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [timezone, setTimezone] = useState(null);
  const stripRef = useRef(null);
  const timerRef = useRef(null);

  function getNow(tz) {
    const now = tz
      ? new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
      : new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  // Auto-refresh time every minute while screen is focused
  useFocusEffect(useCallback(() => {
    setDueTime(getNow(timezone));
    timerRef.current = setInterval(() => setDueTime(getNow(timezone)), 60000);
    return () => clearInterval(timerRef.current);
  }, [timezone]));

  useEffect(() => { load(); }, []);

  async function detectLocation() {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocation(''); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) {
        const parts = [place.name, place.city || place.district, place.region].filter(Boolean);
        setLocation(parts.slice(0, 2).join(', '));
        if (place.timezone) {
          setTimezone(place.timezone);
          setDueTime(getNow(place.timezone));
        }
      }
    } catch {
      setLocation('');
    } finally {
      setLocationLoading(false);
    }
  }

  async function load() {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    const local = data ? JSON.parse(data) : [];
    try {
      const resp = await fetch(`${BACKEND_URL}/todos`);
      if (resp.ok) {
        const serverTodos = await resp.json();
        const localIds = new Set(local.map(t => String(t.id)));
        const newOnes = serverTodos.filter(t => !localIds.has(String(t.id)));
        if (newOnes.length > 0) {
          const merged = [...local, ...newOnes];
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          setTodos(merged);
          return;
        }
      }
    } catch {}
    setTodos(local);
  }

  async function save(updated) {
    setTodos(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function addTodo() {
    const text = input.trim();
    if (!text) return;
    const newTodo = {
      id: Date.now(),
      text,
      done: false,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      location: location.trim() || null,
    };
    save([...todos, newTodo]);
    setInput('');
    setDueDate(selectedDate);
    const now = new Date();
    setDueTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    // Sync to Apple Calendar in background
    if (newTodo.dueDate) {
      fetch(`${BACKEND_URL}/todos/${newTodo.id}/sync-calendar`, { method: 'POST' }).catch(() => {});
    }
  }

  function toggleDone(id) {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    save(updated);
    const todo = updated.find(t => t.id === id);
    if (todo) {
      fetch(`${BACKEND_URL}/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: todo.done }),
      }).catch(() => {});
    }
  }

  function deleteTodo(id) {
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this todo?')) save(todos.filter(t => t.id !== id));
    } else {
      Alert.alert('Delete', 'Remove this todo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => save(todos.filter(t => t.id !== id)) },
      ]);
    }
  }

  // When date strip selection changes, also update the add-form's due date
  function selectDate(iso) {
    setSelectedDate(iso);
    setDueDate(iso);
  }

  const filtered = todos.filter(t => t.dueDate === selectedDate);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.titleColor }]}>
          {theme.id === 'zootopia' ? '🦊 My Todo' : 'My Todo'}
        </Text>
        <ThemePicker />
      </View>

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
          const hasTask = todos.some(t => t.dueDate === day.iso && !t.done);
          return (
            <TouchableOpacity
              key={day.iso}
              onPress={() => selectDate(day.iso)}
              style={[styles.dayCell, isSelected && { backgroundColor: theme.primary }]}
            >
              {i === 0 || day.dayNum === 1
                ? <Text style={[styles.monthLabel, { color: isSelected ? '#fff' : theme.subtitleColor }]}>{day.month}</Text>
                : <Text style={styles.monthLabel}> </Text>}
              <Text style={[styles.dayName, { color: isSelected ? '#fff' : theme.subtitleColor }]}>
                {isToday ? 'Today' : day.dayName}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? '#fff' : theme.headerText }]}>
                {day.dayNum}
              </Text>
              {hasTask && <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : theme.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.dateLabel, { color: theme.subtitleColor }]}>
        {formatDate(selectedDate)}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id.toString()}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: theme.cardBorder !== 'transparent' ? 1 : 0 }]}>
            <TouchableOpacity onPress={() => toggleDone(item.id)} style={styles.check}>
              <Text style={[styles.checkText, { color: theme.primary }]}>{item.done ? '✓' : '○'}</Text>
            </TouchableOpacity>
            <View style={styles.textCol}>
              <Text style={[styles.todoText, { color: theme.headerText }, item.done && styles.done]}>{item.text}</Text>
              <View style={styles.metaRow}>
                {item.dueTime && (
                  <Text style={[styles.metaText, { color: theme.subtitleColor }]}>🕐 {item.dueTime}</Text>
                )}
                {item.location && (
                  <Text style={[styles.metaText, { color: theme.subtitleColor }]} numberOfLines={1}>📍 {item.location}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => deleteTodo(item.id)} style={styles.deleteBtn}>
              <Text style={styles.delete}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.subtitleColor }]}>No todos for this day.</Text>
        }
      />

      <View style={[styles.inputArea, { backgroundColor: theme.cardBg }]}>
        <View style={styles.inputRow}>
          <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.headerText }]}
            value={input} onChangeText={setInput} placeholder="Add a todo..."
            placeholderTextColor={theme.subtitleColor}
            onSubmitEditing={addTodo} returnKeyType="done" />
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]} onPress={addTodo}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel2, { color: theme.subtitleColor }]}>📅</Text>
          {Platform.OS === 'web'
            ? <WebDateInput value={dueDate} onChange={setDueDate} />
            : <Text style={[styles.dateNative, { color: theme.headerText }]}>{dueDate ? formatDate(dueDate) : 'No date'}</Text>
          }
          {dueDate ? (
            <TouchableOpacity onPress={() => setDueDate('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.dateLabel2, { color: theme.subtitleColor, marginLeft: 8 }]}>🕐</Text>
          {Platform.OS === 'web'
            ? <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 8px', fontSize: 14,
                  color: '#333', backgroundColor: '#f0f0f0', outline: 'none', cursor: 'pointer' }} />
            : <Text style={[styles.dateNative, { color: theme.headerText }]}>{dueTime || 'No time'}</Text>
          }
          {dueTime ? (
            <TouchableOpacity onPress={() => setDueTime('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.dateRow}>
          <Text style={[styles.dateLabel2, { color: theme.subtitleColor }]}>📍</Text>
          <TextInput
            style={[styles.locationInput, { backgroundColor: theme.bg, color: theme.headerText, flex: 1 }]}
            value={location} onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor={theme.subtitleColor}
          />
          <TouchableOpacity
            style={[styles.detectBtn, { backgroundColor: theme.primary }]}
            onPress={detectLocation}
            disabled={locationLoading}
          >
            <Text style={styles.detectBtnText}>{locationLoading ? '…' : 'Detect'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  strip: { maxHeight: 90, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  stripContent: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  dayCell: { alignItems: 'center', justifyContent: 'center', width: 52, borderRadius: 12, paddingVertical: 6 },
  monthLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', height: 13 },
  dayName: { fontSize: 11, marginBottom: 2 },
  dayNum: { fontSize: 18, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  dateLabel: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  list: { flex: 1, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  check: { marginRight: 12 },
  checkText: { fontSize: 20 },
  textCol: { flex: 1 },
  todoText: { fontSize: 16 },
  done: { textDecorationLine: 'line-through', color: '#aaa' },
  deleteBtn: { padding: 6 },
  delete: { fontSize: 18 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  inputArea: { borderTopWidth: 1, borderTopColor: '#eee' },
  inputRow: { flexDirection: 'row', padding: 16, paddingBottom: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 10 },
  addBtn: { borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  dateLabel2: { fontSize: 13 },
  dateNative: { fontSize: 13 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 12, color: '#f44336' },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  metaText: { fontSize: 11 },
  locationInput: { fontSize: 14, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  detectBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  detectBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
