import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../constants/config';

const TODOS_KEY = 'todos';
const DEADLINES_CACHE_KEY = 'deadlines_cache';
const BOARD_COLUMNS_KEY = 'board_columns';

function defaultColumn(card) {
  if (card.type === 'todo') return card._done ? 'done' : 'backlog';
  return 'todo'; // deadlines default to To Do
}

function buildCards(todos, deadlines, columnMap) {
  const cards = [];

  for (const t of todos) {
    const cardId = `todo-${t.id}`;
    const col = columnMap[cardId] ?? defaultColumn({ type: 'todo', _done: t.done });
    cards.push({
      cardId,
      type: 'todo',
      title: t.text,
      subtitle: null,
      sourceColor: null,
      sourceLabel: null,
      dueAt: t.dueDate ? t.dueDate + 'T23:59:00' : null, // treat as end-of-day
      dueDate: t.dueDate || null,   // YYYY-MM-DD for day-exact filtering
      column: col,
      originalId: t.id,
    });
  }

  for (const d of deadlines) {
    const cardId = `deadline-${d.id}`;
    const col = columnMap[cardId] ?? 'todo';
    const sourceColors = {
      canvas_gt: '#B3A369',
      canvas_ucf: '#FFC904',
      microsoft: '#0078D4',
      gmail: '#EA4335',
    };
    cards.push({
      cardId,
      type: 'deadline',
      title: d.title,
      subtitle: d.course || null,
      sourceColor: sourceColors[d.source] || '#888',
      sourceLabel: d.source,
      dueAt: d.due_at || null,
      column: col,
      originalId: d.id,
    });
  }

  return cards;
}

export default function useBoardState() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const columnMapRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todosRaw, deadlinesCacheRaw, columnMapRaw] = await Promise.all([
        AsyncStorage.getItem(TODOS_KEY),
        AsyncStorage.getItem(DEADLINES_CACHE_KEY),
        AsyncStorage.getItem(BOARD_COLUMNS_KEY),
      ]);

      const todos = todosRaw ? JSON.parse(todosRaw) : [];
      const deadlines = deadlinesCacheRaw ? JSON.parse(deadlinesCacheRaw).data || [] : [];
      const columnMap = columnMapRaw ? JSON.parse(columnMapRaw) : {};
      columnMapRef.current = columnMap;

      setCards(buildCards(todos, deadlines, columnMap));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveCard = useCallback(async (cardId, newColumn) => {
    // Update columnMap
    const newMap = { ...columnMapRef.current, [cardId]: newColumn };
    columnMapRef.current = newMap;
    await AsyncStorage.setItem(BOARD_COLUMNS_KEY, JSON.stringify(newMap));

    // Update card state
    setCards(prev => prev.map(c => c.cardId === cardId ? { ...c, column: newColumn } : c));

    // Side effects
    const card = cards.find(c => c.cardId === cardId);
    if (!card) return;

    const movingToDone = newColumn === 'done';
    const movingFromDone = card.column === 'done' && newColumn !== 'done';

    if (card.type === 'todo') {
      const todosRaw = await AsyncStorage.getItem(TODOS_KEY);
      const todos = todosRaw ? JSON.parse(todosRaw) : [];
      const updated = todos.map(t =>
        t.id === card.originalId ? { ...t, done: movingToDone } : t
      );
      await AsyncStorage.setItem(TODOS_KEY, JSON.stringify(updated));
    } else if (card.type === 'deadline') {
      if (movingToDone) {
        fetch(`${BACKEND_URL}/deadlines/${encodeURIComponent(card.originalId)}/dismiss`, {
          method: 'POST',
        }).catch(() => {});
      }
    }
  }, [cards]);

  return { cards, loading, reload: load, moveCard };
}
