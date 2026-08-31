from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Category(TimeStampedModel):
    name = models.CharField(
        max_length=100,
        unique=True,
    )

    description = models.TextField(
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
    )

    display_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        ordering = ["display_order", "name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class MenuItem(TimeStampedModel):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="items",
    )

    name = models.CharField(
        max_length=150,
    )

    description = models.TextField(
        blank=True,
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    image = models.ImageField(
        upload_to="menu/",
        blank=True,
        null=True,
    )

    is_available = models.BooleanField(
        default=True,
    )

    display_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        ordering = ["display_order", "name"]

    def __str__(self):
        return self.name


class Ingredient(TimeStampedModel):
    """A raw material tracked in basic inventory."""

    name = models.CharField(max_length=150, unique=True)
    unit = models.CharField(
        max_length=30,
        default="unit",
        help_text="e.g. kg, g, litre, unit",
    )
    current_stock = models.DecimalField(
        max_digits=12, decimal_places=3, default=0
    )
    minimum_stock = models.DecimalField(
        max_digits=12, decimal_places=3, default=0
    )
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_low_stock(self):
        return self.current_stock <= self.minimum_stock


class RecipeItem(TimeStampedModel):
    """Links a menu item to the ingredients it consumes."""

    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="recipe_items",
    )
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.PROTECT,
        related_name="recipe_items",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["menu_item", "ingredient"],
                name="unique_recipe_ingredient",
            )
        ]
        ordering = ["menu_item", "ingredient"]

    def __str__(self):
        return f"{self.menu_item.name} -> {self.ingredient.name} × {self.quantity}"


class StockMovement(TimeStampedModel):
    """A stock adjustment or stock-in record."""

    class MovementType(models.TextChoices):
        STOCK_IN = "STOCK_IN", "Stock In"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        DEDUCTION = "DEDUCTION", "Sale Deduction"

    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MovementType.choices,
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    note = models.CharField(max_length=255, blank=True)
    by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.movement_type} {self.quantity} {self.ingredient.name}"