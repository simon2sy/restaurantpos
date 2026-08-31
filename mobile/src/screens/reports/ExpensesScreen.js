import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { reportApi } from '../../services/reportApi';
import { toList, toObject } from '../../utils/data';

const CATEGORIES = [
  { key: 'SUPPLIES', label: 'Supplies', icon: 'cube-outline', color: COLORS.info },
  { key: 'RENT', label: 'Rent', icon: 'home-outline', color: COLORS.primary },
  { key: 'SALARIES', label: 'Salaries', icon: 'people-outline', color: COLORS.success },
  { key: 'UTILITIES', label: 'Utilities', icon: 'bulb-outline', color: COLORS.warning },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: 'construct-outline', color: '#8b5cf6' },
  { key: 'MARKETING', label: 'Marketing', icon: 'megaphone-outline', color: '#ec4899' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal', color: COLORS.textMuted },
];

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState('0');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [note, setNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await reportApi.getExpenses();
      const data = toObject(res?.data ? res : res);
      setExpenses(toList(data.results ?? data));
      setTotal(data.total ?? '0');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load expenses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Enter a title.');
    if (!amount.trim() || isNaN(parseFloat(amount))) return Alert.alert('Error', 'Enter a valid amount.');
    setSaving(true);
    try {
      await reportApi.createExpense({
        title: title.trim(),
        amount: amount.trim(),
        category,
        note: note.trim(),
        spent_on: new Date().toISOString().slice(0, 10),
      });
      Alert.alert('Success', 'Expense recorded.');
      setModalVisible(false);
      setTitle(''); setAmount(''); setNote(''); setCategory('OTHER');
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save expense.');
    } finally {
      setSaving(false);
    }
  };

  const catInfo = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Expenses</Text>
        <Text style={styles.summaryValue}>Rs. {Number(total).toLocaleString()}</Text>
        <Text style={styles.summaryCount}>{expenses.length} record(s)</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No expenses recorded yet</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const cat = catInfo(item.category);
          return (
            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: cat.color + '1a' }]}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{cat.label} - {item.spent_on}</Text>
              </View>
              <Text style={styles.cardAmount}>Rs. {Number(item.amount).toLocaleString()}</Text>
            </View>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Record Expense</Text>

              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Vegetables purchase" placeholderTextColor={COLORS.textMuted} />

              <Text style={styles.label}>Amount (Rs.) *</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="e.g. 1500" keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />

              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catChip, category === cat.key && { backgroundColor: cat.color, borderColor: cat.color }]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Text style={[styles.catText, category === cat.key && styles.catTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Note</Text>
              <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor={COLORS.textMuted} />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Expense'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  summaryCard: {
    margin: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: '#7c3aed', borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: 'center', ...SHADOW.card,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  summaryValue: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 4 },
  summaryCount: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  list: { padding: SPACING.md, paddingBottom: 90 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card,
  },
  cardIcon: { width: 42, height: 42, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '800', color: COLORS.danger },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginTop: 12 },
  fab: {
    position: 'absolute', right: SPACING.lg, bottom: SPACING.xl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
  },
  modalContent: { padding: SPACING.lg, paddingBottom: 40 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: 14, fontSize: 15, color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  catText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: SPACING.sm },
  modalButton: { flex: 1, alignItems: 'center', padding: 15, borderRadius: RADIUS.md },
  cancelButton: { backgroundColor: COLORS.surfaceLight },
  saveButton: { backgroundColor: COLORS.primary },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
});
