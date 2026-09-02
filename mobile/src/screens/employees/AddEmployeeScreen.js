import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { employeeApi } from '../../services/employeeApi';

const ROLES = [
  { key: 'WAITER', label: 'Waiter', icon: 'people-outline' },
  { key: 'CASHIER', label: 'Cashier', icon: 'card-outline' },
  { key: 'KITCHEN', label: 'Kitchen', icon: 'flame-outline' },
  { key: 'DELIVERY', label: 'Delivery', icon: 'bicycle-outline' },
  { key: 'MANAGER', label: 'Manager', icon: 'shield-outline' },
];

export default function AddEmployeeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '', phone: '', role: 'WAITER',
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      Alert.alert('Missing info', 'First name is required.');
      return;
    }
    if (!form.username.trim()) {
      Alert.alert('Missing info', 'Username is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await employeeApi.create({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        role: form.role,
      });
      Alert.alert(
        'Employee added',
        res?.message || `${form.first_name} was created successfully. They can sign in with their QR code.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Could not add employee', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ram"
            placeholderTextColor={COLORS.textMuted}
            value={form.first_name}
            onChangeText={(v) => set('first_name', v)}
          />
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Shrestha"
            placeholderTextColor={COLORS.textMuted}
            value={form.last_name}
            onChangeText={(v) => set('last_name', v)}
          />
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 98XXXXXXXX"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Login</Text>
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ram_w1"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            value={form.username}
            onChangeText={(v) => set('username', v)}
          />
          <Text style={styles.hint}>
            New employees sign in with a QR code — no password needed. Generate it
            from the employee's detail page after adding.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Role</Text>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleRow, form.role === r.key && styles.roleRowActive]}
              onPress={() => set('role', r.key)}
            >
              <Ionicons
                name={r.icon}
                size={20}
                color={form.role === r.key ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.roleLabel, form.role === r.key && styles.roleLabelActive]}>
                {r.label}
              </Text>
              {form.role === r.key && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <Text style={styles.saveText}>Saving…</Text>
        ) : (
          <>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.saveText}>Add Employee</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: COLORS.textPrimary, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 17 },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: RADIUS.sm, marginBottom: 4,
  },
  roleRowActive: { backgroundColor: COLORS.primary + '15' },
  roleLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  roleLabelActive: { fontWeight: '700', color: COLORS.primary },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, margin: SPACING.md, marginTop: 0,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});