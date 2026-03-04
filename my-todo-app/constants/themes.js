export const THEMES = {
  default: {
    id: 'default',
    name: 'Default',
    icon: '⬜',
    bg: '#f5f5f5',
    cardBg: '#ffffff',
    cardBorder: 'transparent',
    columnBg: '#f0f0f0',
    columnBorder: 'transparent',
    columnDropOver: '#e8f5e9',
    columnDropBorder: '#4CAF50',
    headerText: '#333333',
    titleColor: '#333333',
    subtitleColor: '#666666',
    primary: '#4CAF50',
    tabActive: '#4CAF50',
    tabInactive: '#aaaaaa',
    tabBar: '#ffffff',
    calendarToday: '#4CAF50',
    calendarSelected: '#4CAF50',
    timelineBar: '#1e1e2e',
    characters: null,
  },

  zootopia: {
    id: 'zootopia',
    name: 'Zootopia',
    icon: '🦊',
    bg: '#E3F2FD',
    cardBg: '#FFF8E1',
    cardBorder: '#FFE082',
    columnBg: '#BBDEFB',
    columnBorder: '#90CAF9',
    columnDropOver: '#E8F5E9',
    columnDropBorder: '#FF8F00',
    headerText: '#0D47A1',
    titleColor: '#0D47A1',
    subtitleColor: '#1565C0',
    primary: '#FF8F00',
    tabActive: '#FF8F00',
    tabInactive: '#90CAF9',
    tabBar: '#E3F2FD',
    calendarToday: '#FF8F00',
    calendarSelected: '#FF8F00',
    timelineBar: '#0D47A1',
    characters: {
      // overdue or < 3h → Nick Wilde (sly, urgent)
      emergency: {
        image: require('../assets/characters/nick.png'),
        name: 'Nick',
        label: "Nick's on it!",
        color: '#BF360C',
        bg: '#FBE9E7',
      },
      // < 24h → Judy Hopps (determined)
      urgent: {
        image: require('../assets/characters/judy.png'),
        name: 'Judy',
        label: 'Judy says hurry!',
        color: '#6A1B9A',
        bg: '#F3E5F5',
      },
      // < 72h → Chief Bogo (watching)
      soon: {
        image: require('../assets/characters/bogo.png'),
        name: 'Chief Bogo',
        label: 'Bogo is watching',
        color: '#1565C0',
        bg: '#E3F2FD',
      },
      // ≥ 72h → Flash (slow, no rush)
      normal: {
        image: require('../assets/characters/flash.png'),
        name: 'Flash',
        label: 'Flash says relax~',
        color: '#2E7D32',
        bg: '#E8F5E9',
      },
    },
  },
};

export function getCharacter(dueAt, theme) {
  if (!theme.characters) return null;
  if (!dueAt) return theme.characters.normal;
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 3 * 3600 * 1000)  return theme.characters.emergency;
  if (diff < 24 * 3600 * 1000) return theme.characters.urgent;
  if (diff < 72 * 3600 * 1000) return theme.characters.soon;
  return theme.characters.normal;
}
