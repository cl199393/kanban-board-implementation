import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../constants/config';

const CACHE_KEY = 'deadlines_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

function todoToDeadline(t) {
  const dueTime = t.dueTime || '23:59';
  return {
    id: `todo-${t.id}`,
    source: 'todo',
    title: t.text,
    due_at: t.dueDate ? `${t.dueDate}T${dueTime}:00` : null,
    course: t.location || null,
    isTodo: true,
    todoId: t.id,
    done: t.done,
  };
}

export default function useDeadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const loadCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        setDeadlines(data);
        setLastFetched(timestamp);
        return { data, timestamp };
      }
    } catch {}
    return null;
  }, []);

  const fetchDeadlines = useCallback(async (forceTriggerSync = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceTriggerSync) {
        await fetch(`${BACKEND_URL}/sync`, { method: 'POST' }).catch(() => {});
      }

      // Fetch deadlines and todos in parallel
      const [dlResp, todoResp] = await Promise.all([
        fetch(`${BACKEND_URL}/deadlines?days=30`),
        fetch(`${BACKEND_URL}/todos`),
      ]);
      if (!dlResp.ok) throw new Error(`Server error: ${dlResp.status}`);

      const dlData = await dlResp.json();
      const todoData = todoResp.ok ? await todoResp.json() : [];

      // Merge: todos with a dueDate become pseudo-deadlines
      const todoItems = todoData
        .filter(t => !t.done && t.dueDate)
        .map(todoToDeadline);

      const merged = [...dlData, ...todoItems].sort(
        (a, b) => new Date(a.due_at) - new Date(b.due_at)
      );

      const timestamp = Date.now();
      setDeadlines(merged);
      setLastFetched(timestamp);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp }));
    } catch (err) {
      setError(err.message);
      await loadCache();
    } finally {
      setLoading(false);
    }
  }, [loadCache]);

  useEffect(() => {
    loadCache().then(cached => {
      const age = cached ? Date.now() - cached.timestamp : Infinity;
      if (age > CACHE_TTL_MS) fetchDeadlines();
    });
    const interval = setInterval(() => fetchDeadlines(), CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchDeadlines, loadCache]);

  const dismiss = useCallback(async (id) => {
    try {
      // Check if this is a todo item
      const item = deadlines.find(d => d.id === id);
      if (item?.isTodo) {
        await fetch(`${BACKEND_URL}/todos/${item.todoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: true }),
        });
      } else {
        await fetch(`${BACKEND_URL}/deadlines/${encodeURIComponent(id)}/dismiss`, {
          method: 'POST',
        });
      }
      setDeadlines(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }, [deadlines]);

  return { deadlines, loading, error, refresh: () => fetchDeadlines(true), dismiss };
}
