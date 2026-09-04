import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkProvider';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PushNotificationProvider } from './src/context/PushNotificationProvider';
import IoniconsFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';

// Keep splash screen visible while fonts load.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        // Load the ionicons font using the same asset that @expo/vector-icons uses
        // This ensures the font is properly loaded in release builds
        await Font.loadAsync({
          ionicons: IoniconsFont,
        });
        console.log('[fonts] Font loaded successfully from @expo/vector-icons package');
      } catch (err) {
        console.warn('[fonts] Font loading error:', err?.message || err);
        // Fallback: try loading from local assets
        try {
          await Font.loadAsync({
            ionicons: require('./assets/fonts/ionicons.ttf'),
          });
          console.log('[fonts] Font loaded successfully from local assets');
        } catch (err2) {
          console.warn('[fonts] Fallback font loading error:', err2?.message || err2);
        }
      } finally {
        // Check if font is loaded and log the result
        const isLoaded = Font.isLoaded('ionicons');
        console.log('[fonts] Font isLoaded check:', isLoaded);
        console.log('[fonts] Loaded fonts:', Font.getLoadedFonts());
        // Always set fontsLoaded to true, even if font loading fails
        // The font may still render via the expo-font config plugin
        setFontsLoaded(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }

    loadFonts();
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
