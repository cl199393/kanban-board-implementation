import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CalendarPicker({ selected, onSelect }) {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selected.getMonth());

  const numDays = daysInMonth(viewYear, viewMonth);
  const startDow = firstDayOfMonth(viewYear, viewMonth);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(d);
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const rows = [];
  for (let r = 0; r < cells.length / 7; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }

  return (
    <View style={styles.container}>
      {/* Month nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.row}>
        {DAYS.map(d => (
          <Text key={d} style={styles.dow}>{d}</Text>
        ))}
      </View>

      {/* Date grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.cell} />;
            const date = new Date(viewYear, viewMonth, day);
            const isToday = isSameDay(date, today);
            const isSel = isSameDay(date, selected);
            return (
              <TouchableOpacity
                key={ci}
                style={[styles.cell, isToday && styles.todayCell, isSel && styles.selectedCell]}
                onPress={() => onSelect(date)}
              >
                <Text style={[styles.dayText, isToday && styles.todayText, isSel && styles.selectedText]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Need React for useState
import React from 'react';

const CELL = 36;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  navBtn: { padding: 6 },
  navArrow: { fontSize: 22, color: '#555', lineHeight: 24 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  dow: {
    width: CELL,
    textAlign: 'center',
    fontSize: 11,
    color: '#aaa',
    fontWeight: '600',
  },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL / 2,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  selectedCell: {
    backgroundColor: '#4CAF50',
  },
  dayText: {
    fontSize: 13,
    color: '#333',
  },
  todayText: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  selectedText: {
    color: '#fff',
    fontWeight: '700',
  },
});
