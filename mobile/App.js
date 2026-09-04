import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkProvider';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PushNotificationProvider } from './src/context/PushNotificationProvider';

// Keep splash screen visible while fonts load.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Load Ionicons from the project-local copy (assets/fonts/ionicons.ttf).
  // On Android release builds the @expo/vector-icons fonts inside node_modules
  // are NOT embedded into the APK, which makes every <Ionicons> render blank.
  // We register the local copy under the exact family name "Ionicons" (capital I)
  // that the Ionicons component expects — no spread of Ionicons.font.
  const [fontsLoaded, fontError] = useFonts({
    Ionicons: require('./assets/fonts/ionicons.ttf'),
  });

  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  const onLayoutRootView = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <ErrorBoundary>
      <NetworkProvider>
        <SafeAreaProvider onLayout={onLayoutRootView}>
          <AuthProvider>
            <PushNotificationProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </PushNotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
