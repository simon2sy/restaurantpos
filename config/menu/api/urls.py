from django.urls import path

from . import views

app_name = "menu_api"

urlpatterns = [
    path("categories/", views.CategoryListCreateView.as_view(), name="category_list"),
    path("categories/<int:pk>/", views.CategoryDetailView.as_view(), name="category_detail"),
    path("items/", views.MenuItemListCreateView.as_view(), name="item_list"),
    path("items/<int:pk>/", views.MenuItemDetailView.as_view(), name="item_detail"),
    path("ingredients/", views.IngredientListCreateView.as_view(), name="ingredient_list"),
    path("ingredients/<int:pk>/", views.IngredientDetailView.as_view(), name="ingredient_detail"),
    path("stock/adjust/", views.StockAdjustView.as_view(), name="stock_adjust"),
    path("stock/movements/", views.StockMovementListView.as_view(), name="stock_movements"),
    path("recipes/", views.RecipeItemListView.as_view(), name="recipe_list"),
    path("recipes/<int:pk>/", views.RecipeItemDetailView.as_view(), name="recipe_detail"),
    path("stock/check-low/", views.LowStockCheckView.as_view(), name="stock_check_low"),
    path("items/<int:pk>/stock/", views.MenuItemStockView.as_view(), name="item_stock"),
]
