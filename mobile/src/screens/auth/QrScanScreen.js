import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';

// Extracts the UUID token whether the QR holds a raw token
// or the full web login URL (…/accounts/login/qr/<uuid>/).
const extractToken = (data) => {
  if (!data) return null;
  const match = data.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return match ? match[0] : data.trim();
};

export default function QrScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const { qrLogin } = useAuth();

  const handleScan = useCallback(
    async ({ data }) => {
      if (busy) return;
      setBusy(true);
      const token = extractToken(data);
      if (!token) {
        setBusy(false);
        Alert.alert('Invalid QR', 'This code is not a restaurant login code.');
        return;
      }
      try {
        await qrLogin(token);
        // AuthProvider flips isLoggedIn -> navigates automatically.
      } catch (err) {
        Alert.alert('Login Failed', err.message || 'Invalid or expired QR code.');
        setBusy(false);
      }
    },
    [busy, qrLogin]
  );

  if (!permission) {
    return <View style={styles.center}><Text style={styles.info}>Loading camera…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={56} color={COLORS.textMuted} />
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.info}>Allow camera to scan your staff QR code.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.ghostText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : handleScan}
      />
      {/* Framing overlay */}
      <View style={styles.overlay}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>Point at your {`\n`}staff QR code</Text>
        {busy && (
          <View style={styles.busyBadge}>
            <Text style={styles.busyText}>Signing you in…</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, padding: SPACING.xl,
  },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 250, height: 250,
    justifyContent: 'center', alignItems: 'center',
  },
  corner: { position: 'absolute', width: 42, height: 42, borderColor: '#fff' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  hint: {
    color: '#fff', fontSize: 15, textAlign: 'center',
    marginTop: 28, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 6,
  },
  busyBadge: {
    marginTop: SPACING.md, backgroundColor: COLORS.success,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill,
    ...SHADOW.float,
  },
  busyText: { color: '#fff', fontWeight: '700' },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.md },
  info: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 30, paddingVertical: 14, marginTop: SPACING.lg,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghostBtn: { marginTop: SPACING.sm, padding: 10 },
  ghostText: { color: COLORS.primary, fontWeight: '600' },
  closeButton: {
    position: 'absolute', top: 46, right: 20,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },
});
