from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import EmployeeProfile
from core.api_permissions import IsSuperUser, IsManager, IsSuperUserOrManager, IsAnyStaff
from menu.models import Category, Ingredient, MenuItem, RecipeItem, StockMovement
from orders.services import deduct_inventory

from .serializers import (
    CategorySerializer,
    IngredientSerializer,
    MenuItemCreateSerializer,
    MenuItemSerializer,
    RecipeItemSerializer,
    StockAdjustSerializer,
    StockMovementSerializer,
)


# ============================================================
# CATEGORY
# ============================================================


class CategoryListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/menu/categories/"""

    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Category.objects.prefetch_related("items").order_by("display_order", "name")


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/menu/categories/<pk>/"""

    queryset = Category.objects.prefetch_related("items")
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUser()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]


# ============================================================
# MENU ITEM
# ============================================================


class MenuItemListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/menu/items/"""

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MenuItemCreateSerializer
        return MenuItemSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        qs = MenuItem.objects.select_related("category").order_by("category__display_order", "display_order", "name")
        # Filter by category if provided
        category_id = self.request.query_params.get("category")
        if category_id:
            qs = qs.filter(category_id=category_id)
        # Filter by availability
        available = self.request.query_params.get("available")
        if available is not None:
            qs = qs.filter(is_available=available.lower() in ("true", "1"))
        return qs


class MenuItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/menu/items/<pk>/"""

    queryset = MenuItem.objects.select_related("category")
    serializer_class = MenuItemSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUser()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]


# ============================================================
# INGREDIENT
# ============================================================


class IngredientListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/menu/ingredients/"""

    serializer_class = IngredientSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]

    def get_queryset(self):
        return Ingredient.objects.order_by("name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class IngredientDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/menu/ingredients/<pk>/"""

    queryset = Ingredient.objects.all()
    serializer_class = IngredientSerializer

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsSuperUser()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsSuperUserOrManager()]
        return [IsAnyStaff()]


# ============================================================
# STOCK ADJUSTMENT
# ============================================================


class StockAdjustView(APIView):
    """POST /api/v1/menu/stock/adjust/

    Adjust stock for an ingredient. Manager/Superuser only.
    """

    permission_classes = [IsSuperUserOrManager]

    def post(self, request):
        serializer = StockAdjustSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid data.", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        ingredient = Ingredient.objects.get(pk=data["ingredient_id"])
        quantity = data["quantity"]
        movement_type = data["movement_type"]
        note = data.get("note", "")

        if movement_type == "STOCK_IN":
            ingredient.current_stock += quantity
        elif movement_type == "ADJUSTMENT":
            ingredient.current_stock = quantity

        ingredient.save(update_fields=["current_stock"])

        StockMovement.objects.create(
            ingredient=ingredient,
            movement_type=movement_type,
            quantity=quantity,
            note=note,
            by_user=request.user if request.user.is_authenticated else None,
        )

        return Response(
            {
                "success": True,
                "message": f"Stock adjusted for {ingredient.name}.",
                "data": IngredientSerializer(ingredient).data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# RECIPE
# ============================================================


class RecipeItemListView(generics.ListCreateAPIView):
    """GET/POST /api/v1/menu/recipes/"""

    serializer_class = RecipeItemSerializer
    permission_classes = [IsSuperUserOrManager]

    def get_queryset(self):
        qs = RecipeItem.objects.select_related("ingredient", "menu_item").order_by("menu_item__name", "ingredient__name")
        menu_item_id = self.request.query_params.get("menu_item")
        if menu_item_id:
            qs = qs.filter(menu_item_id=menu_item_id)
        return qs


class RecipeItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/menu/recipes/<pk>/"""

    queryset = RecipeItem.objects.select_related("ingredient", "menu_item")
    serializer_class = RecipeItemSerializer
    permission_classes = [IsSuperUserOrManager]


# ============================================================
# STOCK MOVEMENTS
# ============================================================


class StockMovementListView(generics.ListAPIView):
    """GET /api/v1/menu/stock/movements/"""

    serializer_class = StockMovementSerializer
    permission_classes = [IsSuperUserOrManager]

    def get_queryset(self):
        qs = StockMovement.objects.select_related("ingredient", "by_user").order_by("-created_at")
        ingredient_id = self.request.query_params.get("ingredient")
        if ingredient_id:
            qs = qs.filter(ingredient_id=ingredient_id)
        return qs
