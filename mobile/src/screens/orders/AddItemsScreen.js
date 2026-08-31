import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { orderApi } from '../../services/orderApi';
import { menuApi } from '../../services/menuApi';
import { toList } from '../../utils/data';

export default function AddItemsScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [categories, setCategories] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

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

  const handleSubmit = async () => {
    if (!hasItems) { Alert.alert('Error', 'Select at least one item.'); return; }
    setSubmitting(true);
    try {
      const items = Object.entries(selectedItems).map(([id, qty]) => ({
        menu_item_id: parseInt(id), quantity: qty, notes: '',
      }));
      await orderApi.addItems(orderId, items);
      Alert.alert('Success', 'Items added!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add items.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categorySection}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.items?.map((item) => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>Rs. {item.price}</Text>
                </View>
                <View style={styles.quantityRow}>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.id, -1)}>
                    <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{selectedItems[item.id] || 0}</Text>
                  <TouchableOpacity style={[styles.qtyButton, styles.qtyButtonActive]} onPress={() => updateQuantity(item.id, 1)}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      {hasItems && (
        <View style={styles.submitBar}>
          <Text style={styles.submitSummary}>{Object.values(selectedItems).reduce((a, b) => a + b, 0)} items</Text>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitText}>{submitting ? 'Adding...' : 'Add to Order'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 100 },
  categorySection: { marginBottom: SPACING.lg },
  categoryName: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.xs },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  itemPrice: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  qtyButtonActive: { backgroundColor: COLORS.primary },
  qtyText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, minWidth: 24, textAlign: 'center' },
  submitBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, paddingBottom: SPACING.lg },
  submitSummary: { color: COLORS.textSecondary, fontSize: 14 },
  submitButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.md },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
