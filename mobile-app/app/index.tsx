import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken } from '../lib/auth';
import { useAppTheme } from '../lib/ThemeContext';

export default function Index() {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    getToken().then(token => {
      setHasToken(!!token);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary600} />
      </View>
    );
  }

  return <Redirect href={hasToken ? '/(tabs)/noten' : '/login'} />;
}
