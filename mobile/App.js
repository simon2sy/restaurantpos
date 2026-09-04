import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkProvider';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PushNotificationProvider } from './src/context/PushNotificationProvider';

// Keep splash screen visible while fonts load.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ionicons: require('./assets/fonts/ionicons.ttf'),
  });

  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) {
      // GUARANTEE: Force 'ionicons' into expo-font's loaded-font cache.
      // On Android, the actual glyph rendering is handled natively by
      // Typeface.createFromAsset, which finds ionicons.ttf in
      // android/app/src/main/assets/fonts/ (placed there by the
      // expo-font plugin in app.json).  The JS-level Font.isLoaded()
      // check is only needed to pass the @expo/vector-icons gate that
      // renders <Text /> (blank) when the font appears unloaded.
      try {
        const { markLoaded } = require('expo-font/build/memory');
        markLoaded('ionicons');
      } catch (_) {
        // Non-critical: if import fails, icons may still render via
        // useFonts above
      }
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
