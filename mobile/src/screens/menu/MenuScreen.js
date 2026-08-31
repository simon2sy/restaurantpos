import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { menuApi } from '../../services/menuApi';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toList } from '../../utils/data';

function MenuCategory({ category }) {
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{category.name}</Text>
        <Text style={styles.categoryCount}>{category.items_count} items</Text>
      </View>
      {category.description ? <Text style={styles.categoryDesc}>{category.description}</Text> : null}
      <View style={styles.itemsContainer}>
        {category.items?.map((item) => (
          <View key={item.id} style={styles.menuItemCard}>
            <View style={styles.itemContent}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
              <Text style={styles.itemPrice}>Rs. {item.price}</Text>
            </View>
            {!item.is_available && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Unavailable</Text>
              </View>
            )}
          </View>
        ))}
        {(!category.items || category.items.length === 0) && (
          <Text style={styles.noItems}>No items in this category</Text>
        )}
      </View>
    </View>
  );
}

export default function MenuScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchMenu = useCallback(async () => {
    try {
      const cats = toList(await menuApi.listCategories());
      const safeCats = Array.isArray(cats) ? cats : [];
      const itemsResults = await Promise.all(
        safeCats.map((cat) =>
          menuApi.listItems({ category: cat.id }).then((r) => toList(r))
        )
      );
      setCategories(safeCats.map((cat, i) => ({ ...cat, items: toList(itemsResults[i]) })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMenu();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchMenu} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {categories.map((category) => (
        <MenuCategory key={category.id} category={category} />
      ))}
      {categories.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="restaurant-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No menu items available</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  categorySection: { marginBottom: SPACING.xl },
  categoryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryName: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  categoryCount: { fontSize: 13, color: COLORS.textMuted },
  categoryDesc: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  itemsContainer: { gap: SPACING.sm },
  menuItemCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  itemContent: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  itemDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginTop: 6 },
  unavailableBadge: {
    backgroundColor: COLORS.danger + '20', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8,
  },
  unavailableText: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  noItems: { fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16, marginTop: 12 },
});
