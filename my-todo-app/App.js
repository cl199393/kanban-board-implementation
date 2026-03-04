import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import TodoScreen from './screens/TodoScreen';
import DeadlinesScreen from './screens/DeadlinesScreen';
import BoardScreen from './screens/BoardScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ size }) => {
            const icons = { Todos: '✅', Deadlines: '📅', Board: '📋' };
            return <Text style={{ fontSize: size - 4 }}>{icons[route.name]}</Text>;
          },
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: '#aaa',
          tabBarStyle: { paddingBottom: 4 },
        })}
      >
        <Tab.Screen name="Todos" component={TodoScreen} />
        <Tab.Screen name="Deadlines" component={DeadlinesScreen} />
        <Tab.Screen name="Board" component={BoardScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
