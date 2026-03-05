import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import TodoScreen from './screens/TodoScreen';
import DeadlinesScreen from './screens/DeadlinesScreen';
import BoardScreen from './screens/BoardScreen';
import JobsScreen from './screens/JobsScreen';
import ResumeScreen from './screens/ResumeScreen';

const Tab = createBottomTabNavigator();

function Tabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ size }) => {
          const icons = { Todos: '✅', Deadlines: '📅', Board: '📋', Jobs: '💼', Resume: '📄' };
          return <Text style={{ fontSize: size - 4 }}>{icons[route.name]}</Text>;
        },
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: { paddingBottom: 4, backgroundColor: theme.tabBar },
      })}
    >
      <Tab.Screen name="Todos" component={TodoScreen} />
      <Tab.Screen name="Deadlines" component={DeadlinesScreen} />
      <Tab.Screen name="Board" component={BoardScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Resume" component={ResumeScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Tabs />
      </NavigationContainer>
    </ThemeProvider>
  );
}
