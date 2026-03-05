import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BACKEND_URL } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import ThemePicker from '../components/ThemePicker';

const COLUMNS = [
  { key: 'recruiter',    label: 'Recruiter',    emoji: '🤝', color: '#7B1FA2' },
  { key: 'applied',      label: 'Applied',      emoji: '📤', color: '#1565C0' },
  { key: 'phone_screen', label: 'Phone Screen', emoji: '📞', color: '#F57F17' },
  { key: 'interview',    label: 'Interview',    emoji: '🎯', color: '#2E7D32' },
  { key: 'offer',        label: 'Offer',        emoji: '🎉', color: '#00838F' },
  { key: 'rejected',     label: 'Rejected',     emoji: '❌', color: '#B71C1C' },
];

const STATUS_TRANSITIONS = {
  recruiter:    ['applied', 'rejected'],
  applied:      ['phone_screen', 'rejected'],
  phone_screen: ['interview', 'rejected'],
  interview:    ['offer', 'rejected'],
  offer:        [],
  rejected:     [],
};

export default function JobsScreen() {
  const { theme } = useTheme();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchJobs(); }, []));

  async function fetchJobs() {
    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/jobs`);
      if (resp.ok) setJobs(await resp.json());
    } catch {}
    setLoading(false);
  }

  async function moveJob(job, newStatus) {
    try {
      await fetch(`${BACKEND_URL}/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    } catch {
      Alert.alert('Error', 'Failed to update job status.');
    }
  }

  function confirmMove(job, newStatus) {
    const label = COLUMNS.find(c => c.key === newStatus)?.label || newStatus;
    if (Platform.OS === 'web') {
      if (window.confirm(`Move to ${label}?`)) moveJob(job, newStatus);
    } else {
      Alert.alert('Move', `Move to ${label}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move', onPress: () => moveJob(job, newStatus) },
      ]);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.titleColor }]}>💼 Jobs</Text>
        <ThemePicker />
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: theme.headerText }]}>No applications yet</Text>
          <Text style={[styles.emptySub, { color: theme.subtitleColor }]}>
            Send /check in your Telegram bot to scan{'\n'}your Gmail for job-related emails.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.board}>
          {COLUMNS.map(col => {
            const colJobs = jobs.filter(j => j.status === col.key);
            const transitions = STATUS_TRANSITIONS[col.key] || [];
            return (
              <View key={col.key} style={[styles.column, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.colHeader, { borderBottomColor: col.color }]}>
                  <Text style={[styles.colEmoji]}>{col.emoji}</Text>
                  <Text style={[styles.colLabel, { color: col.color }]}>{col.label}</Text>
                  <Text style={[styles.colCount, { color: col.color }]}>{colJobs.length}</Text>
                </View>
                <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
                  {colJobs.length === 0 && (
                    <Text style={[styles.colEmpty, { color: theme.subtitleColor }]}>—</Text>
                  )}
                  {colJobs.map(job => (
                    <View key={job.id} style={[styles.card, { borderLeftColor: col.color, backgroundColor: theme.bg }]}>
                      <Text style={[styles.cardCompany, { color: theme.headerText }]} numberOfLines={1}>
                        {job.company}
                      </Text>
                      {!!job.role && (
                        <Text style={[styles.cardRole, { color: theme.subtitleColor }]} numberOfLines={1}>
                          {job.role}
                        </Text>
                      )}
                      <Text style={[styles.cardDate, { color: theme.subtitleColor }]}>
                        {new Date(job.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      {transitions.length > 0 && (
                        <View style={styles.cardActions}>
                          {transitions.map(t => {
                            const tc = COLUMNS.find(c => c.key === t);
                            return (
                              <TouchableOpacity
                                key={t}
                                style={[styles.moveBtn, { backgroundColor: tc.color + '22', borderColor: tc.color }]}
                                onPress={() => confirmMove(job, t)}
                              >
                                <Text style={[styles.moveBtnText, { color: tc.color }]}>
                                  {tc.emoji} {tc.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  board: { flex: 1, paddingHorizontal: 8 },
  column: { width: 200, marginHorizontal: 6, borderRadius: 12, marginBottom: 16, maxHeight: '90%' },
  colHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 2, gap: 6 },
  colEmoji: { fontSize: 16 },
  colLabel: { fontWeight: '700', fontSize: 13, flex: 1 },
  colCount: { fontWeight: '700', fontSize: 13 },
  colScroll: { padding: 8 },
  colEmpty: { textAlign: 'center', marginTop: 12, fontSize: 13 },
  card: { borderRadius: 8, padding: 10, marginBottom: 8, borderLeftWidth: 3 },
  cardCompany: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  cardRole: { fontSize: 12, marginBottom: 4 },
  cardDate: { fontSize: 10, marginBottom: 6 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  moveBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  moveBtnText: { fontSize: 11, fontWeight: '600' },
});
