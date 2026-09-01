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
// Catch rejections — an unhandled one here can leave the app stuck on splash.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Canonical, reliable way to load @expo/vector-icons fonts so glyph icons
  // render in standalone APKs. `Ionicons.font` is { ionicons: <bundled ttf> } —
  // the EXACT asset + lowercase family name ("ionicons") that the <Ionicons/>
  // component uses internally. Using this single source avoids registering the
  // same TTF under a conflicting family name (which breaks icons on Android,
  // where font families are case-sensitive).
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  const ready = fontsLoaded || !!fontError;

  // Primary splash-hide path: fires whenever the app becomes ready,
  // regardless of whether a layout event happens to occur.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Backup path: hide on first layout too (harmless if already hidden).
  const onLayoutRootView = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Show splash while loading. If a font legitimately fails to load we still
  // proceed (fontError set) so the app isn't stuck on the splash screen.
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
