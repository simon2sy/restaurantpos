/**
 * Pre-load Ionicons font from the project-local copy.
 *
 * On Android release builds the @expo/vector-icons fonts inside node_modules
 * are NOT embedded into the APK, making every <Ionicons> render blank.
 *
 * This module uses expo-asset + expo-font to load the local .ttf file
 * before any React tree renders.  It must be called (and awaited) before
 * the first <Ionicons /> component mounts.
 */
import * as Font from 'expo-font';

// Local copy of the Ionicons font.  On Android release builds the
// @expo/vector-icons fonts inside node_modules are NOT embedded into the
// APK, so we bundle our own copy and register it here.
const IONICONS_TTF = require('../../assets/fonts/ionicons.ttf');

let _loaded = false;

export async function preloadFonts() {
  if (_loaded) return;

  try {
    // Register under the exact lowercase family name 'ionicons' that
    // @expo/vector-icons / createIconSet uses internally.
    await Font.loadAsync({ ionicons: IONICONS_TTF });
    _loaded = true;
  } catch (err) {
    console.warn('[fonts] failed to preload Ionicons:', err);
  }
}
