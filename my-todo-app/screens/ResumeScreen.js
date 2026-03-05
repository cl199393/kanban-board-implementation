import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BACKEND_URL } from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import ThemePicker from '../components/ThemePicker';

export default function ResumeScreen() {
  const { theme } = useTheme();
  const [jd, setJd] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function tailorResume() {
    if (!jd.trim()) return;
    setLoading(true);
    setResult('');
    setError('');
    try {
      const resp = await fetch(`${BACKEND_URL}/tailor-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jd }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Server error');
      setResult(data.result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.titleColor }]}>📄 Resume</Text>
        <ThemePicker />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: theme.subtitleColor }]}>
          Paste Job Description
        </Text>
        <TextInput
          style={[styles.jdInput, { backgroundColor: theme.cardBg, color: theme.headerText, borderColor: theme.cardBorder || '#ddd' }]}
          value={jd}
          onChangeText={setJd}
          placeholder="Paste the full job description here..."
          placeholderTextColor={theme.subtitleColor}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: loading ? theme.subtitleColor : theme.primary }]}
          onPress={tailorResume}
          disabled={loading || !jd.trim()}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>✨ Tailor My Resume</Text>
          }
        </TouchableOpacity>

        {!!error && (
          <Text style={styles.error}>{error}</Text>
        )}

        {!!result && (
          <View style={[styles.resultCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.resultTitle, { color: theme.titleColor }]}>AI Suggestions</Text>
            <Text style={[styles.resultText, { color: theme.headerText }]}>{result}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  jdInput: {
    minHeight: 180, borderRadius: 12, padding: 14, fontSize: 14,
    borderWidth: 1, marginBottom: 14, lineHeight: 20,
  },
  btn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#f44336', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  resultCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  resultTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  resultText: { fontSize: 13, lineHeight: 20 },
});
