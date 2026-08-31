import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// ---- Nuclear font loading strategy ----
// Three fallback layers so icons ALWAYS render in standalone APKs:
//   1. useFonts() (expo-font hook) — the standard way
//   2. Asset.downloadAsync() + Font.loadAsync() — forces download
//   3. Ionicons.loadFont() — @expo/vector-icons' own loader
async function loadAllFonts() {
  // Layer 1: Pre-download the font asset so it's cached natively
  const fontAsset = require('./assets/fonts/Ionicons.ttf');
  await Asset.fromModule(fontAsset).downloadAsync();

  // Layer 2: Load via expo-font with the correct family name
  await Font.loadAsync({
    ionicons: fontAsset,
  });

  // Layer 3: Also load via @expo/vector-icons' own method
  // This ensures the icon component's internal state is also updated
  const { Ionicons } = require('@expo/vector-icons');
  await Ionicons.loadFont();
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadAllFonts()
      .then(() => setFontsLoaded(true))
      .catch((err) => {
        console.error('CRITICAL: Font loading failed:', err);
        // Still show the app — icons won't render but at least
        // the user can see text labels and debug the issue.
        setFontsLoaded(true);
      });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Show splash while loading
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
