from rest_framework import serializers

from menu.models import Category, Ingredient, MenuItem, RecipeItem, StockMovement


# ============================================================
# CATEGORY
# ============================================================


class CategorySerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "description", "is_active", "display_order", "items_count"]
        read_only_fields = ["id"]

    def get_items_count(self, obj):
        return obj.items.filter(is_available=True).count()


# ============================================================
# MENU ITEM
# ============================================================


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id", "category", "category_name", "name", "description",
            "price", "image", "image_url", "is_available", "display_order",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class MenuItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ["id", "category", "name", "description", "price", "image", "is_available", "display_order"]


# ============================================================
# INGREDIENT
# ============================================================


class IngredientSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ingredient
        fields = [
            "id", "name", "unit", "current_stock", "minimum_stock",
            "cost_per_unit", "is_active", "is_low_stock",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ============================================================
# RECIPE ITEM
# ============================================================


class RecipeItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)

    class Meta:
        model = RecipeItem
        fields = ["id", "menu_item", "ingredient", "ingredient_name", "ingredient_unit", "quantity"]
        read_only_fields = ["id"]


# ============================================================
# STOCK MOVEMENT
# ============================================================


class StockMovementSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    by_user_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id", "ingredient", "ingredient_name", "movement_type",
            "quantity", "note", "by_user", "by_user_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_by_user_name(self, obj):
        if obj.by_user:
            return obj.by_user.get_full_name() or obj.by_user.username
        return None


class StockAdjustSerializer(serializers.Serializer):
    """Adjust stock for an ingredient."""

    ingredient_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    movement_type = serializers.ChoiceField(
        choices=[("STOCK_IN", "Stock In"), ("ADJUSTMENT", "Adjustment")]
    )
    note = serializers.CharField(max_length=255, required=False, default="")

    def validate_ingredient_id(self, value):
        try:
            Ingredient.objects.get(pk=value)
        except Ingredient.DoesNotExist:
            raise serializers.ValidationError("Ingredient not found.")
        return value
