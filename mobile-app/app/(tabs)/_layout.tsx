import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../lib/theme';
import { fetchMe } from '../../lib/auth';

export default function TabsLayout() {
  const [isBoard, setIsBoard] = useState(false);

  useEffect(() => {
    fetchMe().then(profile => {
      setIsBoard(profile?.role === 'ROLE_BOARD' || profile?.role === 'ROLE_ADMIN');
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: font.semiBold, fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary600,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="noten"
        options={{
          title: 'Noten',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="termine"
        options={{
          title: 'Termine',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="antraege"
        options={{
          title: 'Anträge',
          href: isBoard ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
