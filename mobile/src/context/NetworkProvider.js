import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext({ isOnline: true });

export const useNetwork = () => useContext(NetworkContext);

/**
 * Provides network connectivity state to the entire app.
 * Shows a dismissable "offline" banner when the device loses connection.
 */
export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const bannerOpacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);

      if (!online) {
        setShowBanner(true);
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else if (showBanner) {
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowBanner(false));
      }
    });

    return () => unsubscribe();
  }, [showBanner, bannerOpacity]);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
      {showBanner && (
        <Animated.View style={[styles.banner, { opacity: bannerOpacity }]}>
          <Text style={styles.bannerText}>
            ⚠️ No internet connection
          </Text>
        </Animated.View>
      )}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#e74c3c',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
