/**
 * Pre-load Ionicons font from the project-local copy.
 *
 * Uses two strategies:
 * 1. expo-font Font.loadAsync (registers with ExpoFontLoader native module)
 * 2. Fallback: the font file at android/app/src/main/assets/fonts/ionicons.ttf
 *    is also available to Android's native Typeface system by file name.
 *
 * The @expo/vector-icons wrapper renders <Text /> (blank) until
 * Font.isLoaded('ionicons') returns true, so strategy 1 MUST succeed.
 */
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';

const IONICONS_ASSET = require('../../assets/fonts/ionicons.ttf');

let _loaded = false;

export async function preloadFonts() {
  if (_loaded) return;

  try {
    // Strategy 1: Load via expo-font (registers in ExpoFontLoader native module)
    const asset = Asset.fromModule(IONICONS_ASSET);
    // Force download — in release builds the file is already local in the
    // APK bundle, but downloadAsync ensures localUri is populated.
    await asset.downloadAsync();

    if (asset.localUri) {
      await Font.loadAsync({ ionicons: asset.localUri });
    } else {
      // localUri can be null for bundled assets on some Expo versions.
      // Fall back to passing the asset object directly.
      await Font.loadAsync({ ionicons: asset });
    }

    _loaded = true;
  } catch (err) {
    console.warn('[fonts] Strategy 1 failed:', err?.message || err);

    // Strategy 2: Try with the raw require() number — expo-font handles
    // numeric sources via Asset.fromModule internally.
    try {
      await Font.loadAsync({ ionicons: IONICONS_ASSET });
      _loaded = true;
    } catch (err2) {
      console.warn('[fonts] Strategy 2 failed:', err2?.message || err2);
    }
  }
}
