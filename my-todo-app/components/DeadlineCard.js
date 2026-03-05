import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert, TextInput, Platform } from 'react-native';
import { useState } from 'react';
import { BACKEND_URL } from '../constants/config';

const SOURCE_COLORS = {
  canvas_gt:  '#B3A369',
  canvas_ucf: '#FFC904',
  microsoft:  '#0078D4',
  gmail:      '#EA4335',
  todo:       '#4CAF50',
  manual:     '#9C27B0',
};

const SOURCE_LABELS = {
  canvas_gt:  'GT Canvas',
  canvas_ucf: 'UCF Canvas',
  microsoft:  'Microsoft',
  gmail:      'Gmail',
  todo:       'Todo',
  manual:     'Manual',
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

function findLink(courseLinks, course, title) {
  const haystack = `${course || ''} ${title || ''}`.toLowerCase();
  const entry = Object.entries(courseLinks).find(([k]) =>
    haystack.includes(k.toLowerCase())
  );
  return entry?.[1] ?? null;
}

function linkLabel(url) {
  if (!url) return '🔗 Open';
  if (url.includes('overleaf.com')) return '📄 Overleaf';
  if (url.includes('openreview.net')) return '🔬 OpenReview';
  return '🔗 Open link';
}

function bestKey(course, title) {
  const match = title?.match(/\[([A-Z]{2,4}\d{4,5})\]/);
  if (match) return match[1];
  if (course) return course;
  return title?.slice(0, 30) || 'general';
}

function saveLink(key, url, onSaved) {
  fetch(`${BACKEND_URL}/overleaf-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course: key, url }),
  })
    .then(r => r.ok && onSaved())
    .catch(() => {});
}

export default function DeadlineCard({ item, onDismiss, overleafLinks = {}, onOverleafLinkAdded }) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const color = SOURCE_COLORS[item.source] || '#888';
  const label = SOURCE_LABELS[item.source] || item.source;
  const timer = countdown(item.due_at);
  const urgent = (new Date(item.due_at) - Date.now()) < 24 * 3_600_000;

  const overleafUrl = findLink(overleafLinks, item.course, item.title);
  const courseLinkLabel = linkLabel(overleafUrl);
  const canvasUrl = item.url || null;
  const key = bestKey(item.course, item.title);

  // Primary tap: open Overleaf if linked, else Canvas/office URL
  function onCardPress() {
    const target = overleafUrl || canvasUrl;
    if (target) Linking.openURL(target);
  }

  function promptLink() {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Link Overleaf Project',
        `Paste your Overleaf URL for "${key}". It will appear on all matching deadlines.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: url => {
              if (url?.trim()) saveLink(key, url.trim(), () => onOverleafLinkAdded?.());
            },
          },
        ],
        'plain-text',
        overleafUrl || '',
      );
    } else {
      setUrlDraft(overleafUrl || '');
      setShowLinkInput(v => !v);
    }
  }

  const hasLink = !!(overleafUrl || canvasUrl);

  return (
    <TouchableOpacity
      onPress={onCardPress}
      activeOpacity={hasLink ? 0.7 : 1}
      style={styles.card}
    >
      {/* Source badge */}
      <View style={[styles.sourceBadge, { backgroundColor: color }]}>
        <Text style={styles.sourceText}>{label}</Text>
      </View>

      {/* Main body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.course ? <Text style={styles.course}>{item.course}</Text> : null}

        {/* Link indicators */}
        <View style={styles.linkRow}>
          {overleafUrl ? (
            <Text style={styles.overleafTag}>{courseLinkLabel}</Text>
          ) : null}
          {canvasUrl && !overleafUrl ? (
            <Text style={styles.canvasTag}>🔗 Open assignment</Text>
          ) : null}
          {canvasUrl && overleafUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(canvasUrl)}>
              <Text style={styles.canvasTag}>🏫 Canvas</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Overleaf link management — non-todo items only */}
        {item.source !== 'todo' ? (
          <TouchableOpacity onPress={promptLink} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.addLinkText}>
              {overleafUrl ? '✏️ Edit link' : '+ Add link'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Inline URL input (Android/web fallback) */}
        {showLinkInput && (
          <View style={styles.inlineInput}>
            <TextInput
              style={styles.urlInput}
              value={urlDraft}
              onChangeText={setUrlDraft}
              placeholder="https://www.overleaf.com/project/..."
              autoFocus
              autoCapitalize="none"
            />
            <View style={styles.inputBtns}>
              <TouchableOpacity onPress={() => setShowLinkInput(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (urlDraft.trim()) {
                  saveLink(key, urlDraft.trim(), () => {
                    setShowLinkInput(false);
                    onOverleafLinkAdded?.();
                  });
                }
              }}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Right: countdown + dismiss */}
      <View style={styles.right}>
        <Text style={[styles.countdown, urgent && styles.urgent]}>{timer}</Text>
        <TouchableOpacity
          onPress={() => onDismiss(item.id)}
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dismissText}>{item.isTodo ? '✓' : '✕'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  sourceText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#222' },
  course: { fontSize: 12, color: '#888', marginTop: 2 },
  linkRow: { flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  overleafTag: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  canvasTag: { fontSize: 12, color: '#1565C0', fontWeight: '500' },
  addLinkText: { fontSize: 11, color: '#bbb', marginTop: 4 },
  right: { alignItems: 'flex-end', marginLeft: 8 },
  countdown: { fontSize: 14, fontWeight: '700', color: '#555' },
  urgent: { color: '#e53935' },
  dismissBtn: { marginTop: 6 },
  dismissText: { color: '#bbb', fontSize: 14 },
  inlineInput: { marginTop: 6 },
  urlInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, fontSize: 12,
  },
  inputBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelText: { fontSize: 12, color: '#999' },
  saveText: { fontSize: 12, color: '#4CAF50', fontWeight: '700' },
});
