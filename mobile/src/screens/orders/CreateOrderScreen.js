import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { orderApi } from '../../services/orderApi';
import { menuApi } from '../../services/menuApi';
import { toList, toObject } from '../../utils/data';

export default function CreateOrderScreen({ route, navigation }) {
  const { type, seatId } = route.params || {};
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const fetchMenu = useCallback(async () => {
    try {
      const cats = toList(await menuApi.listCategories());
      const itemsResults = await Promise.all(
        cats.map((cat) =>
          menuApi.listItems({ category: cat.id, available: 'true' }).then(toList)
        )
      );
      setCategories(cats.map((cat, i) => ({ ...cat, items: toList(itemsResults[i]) })));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const updateQuantity = (itemId, delta) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0;
      const newQty = Math.max(0, current + delta);
      const updated = { ...prev };
      if (newQty === 0) delete updated[itemId];
      else updated[itemId] = newQty;
      return updated;
    });
  };

  const hasItems = Object.keys(selectedItems).length > 0;

  // Live search across item names and prices
  const query = search.trim().toLowerCase();
  const visibleCategories = query
    ? categories
        .map((cat) => ({
          ...cat,
          items: (cat.items || []).filter(
            (item) =>
              item.name?.toLowerCase().includes(query) ||
              String(item.price ?? '').includes(query)
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : categories;

  const handleSubmit = async () => {
    if (!hasItems) {
      Alert.alert('Error', 'Select at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      // Create order
      const orderData = { order_type: 'DINE_IN' };
      if (type === 'table') orderData.table_id = seatId;
      else if (type === 'cabin') orderData.cabin_id = seatId;

      const orderResponse = await orderApi.create(orderData);
      const orderId = toObject(orderResponse)?.id;

      if (!orderId) throw new Error('Failed to create order.');

      const items = Object.entries(selectedItems).map(([menuItemId, quantity]) => ({
        menu_item_id: parseInt(menuItemId, 10),
        quantity,
        ...(notes[menuItemId] ? { notes: notes[menuItemId] } : {}),
      }));

      // Add items — if this fails, roll back the empty order so the
      // table/cabin is released instead of staying stuck as OCCUPIED.
      try {
        await orderApi.addItems(orderId, items);
      } catch (itemsErr) {
        try {
          await orderApi.cancel(orderId);
        } catch {
          // rollback best-effort
        }
        throw itemsErr;
      }

      Alert.alert('Success', 'Order created!', [
        {
          text: 'View Order',
          onPress: () => {
            navigation.popToTop();
            navigation.push('OrderDetail', { orderId });
          },
        },
        { text: 'New Another', style: 'cancel' },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search food by name or price…"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {visibleCategories.length === 0 && (
          <View style={styles.noResults}>
            <Ionicons name="sad-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.noResultsText}>No items match "{search}"</Text>
          </View>
        )}
        {visibleCategories.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.items?.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>Rs. {item.price}</Text>
                </View>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQuantity(item.id, -1)}
                  >
                    <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{selectedItems[item.id] || 0}</Text>
                  <TouchableOpacity
                    style={[styles.qtyButton, styles.qtyButtonActive]}
                    onPress={() => updateQuantity(item.id, 1)}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Submit Bar */}
      {hasItems && (
        <View style={styles.submitBar}>
          <Text style={styles.submitSummary}>
            {Object.values(selectedItems).reduce((a, b) => a + b, 0)} items selected
          </Text>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Creating...' : 'Create Order'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10,
    margin: SPACING.md, marginBottom: 0,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  noResults: { alignItems: 'center', paddingTop: 60, gap: 10 },
  noResultsText: { color: COLORS.textMuted, fontSize: 15 },
  content: { padding: SPACING.md, paddingBottom: 100 },
  categorySection: { marginBottom: SPACING.lg },
  categoryName: {
    fontSize: 18, fontWeight: '700', color: COLORS.primary,
    marginBottom: SPACING.sm, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm,
    padding: SPACING.md, marginBottom: SPACING.xs,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  itemPrice: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center',
  },
  qtyButtonActive: { backgroundColor: COLORS.primary },
  qtyText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, minWidth: 24, textAlign: 'center' },
  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.md, paddingBottom: SPACING.lg,
  },
  submitSummary: { color: COLORS.textSecondary, fontSize: 14 },
  submitButton: {
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
