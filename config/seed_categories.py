"""One-off script: seed standard restaurant menu categories."""
from menu.models import Category, MenuItem

CATEGORIES = [
    # name, description, display_order
    ("Starters", "Appetizers and small bites to start the meal", 1),
    ("Soups", "Hot and comforting soups", 2),
    ("Salads", "Fresh and healthy salads", 3),
    ("Main Course", "Hearty main dishes — veg and non-veg", 4),
    ("Breads", "Freshly baked breads", 5),
    ("Rice & Biryani", "Rice dishes, pulao and biryani", 6),
    ("Chinese", "Indo-Chinese favourites — noodles, manchurian & more", 7),
    ("Tandoori & Grill", "Char-grilled delights from the tandoor", 8),
    ("Snacks", "Quick bites and finger foods", 9),
    ("Desserts", "Sweet endings to your meal", 10),
    ("Beverages", "Hot and cold drinks", 11),
    ("Combo Meals", "Value combos — save more", 12),
    ("Important", "High-demand items staffed prominently on the menu", 13),
]

created, existing = [], []
for name, desc, order in CATEGORIES:
    cat, was_created = Category.objects.get_or_create(
        name=name,
        defaults={"description": desc, "display_order": order, "is_active": True},
    )
    (created if was_created else existing).append(name)

important_cat = Category.objects.get(name="Important")
MenuItem.objects.get_or_create(
    name="Classic Burger",
    defaults={
        "category": important_cat,
        "description": "Juicy beef patty with lettuce, tomato, and mayo in a toasted brioche bun",
        "price": 250.00,
        "is_available": True,
        "display_order": 1,
    },
)

print("Created categories:", created)
print("Already existed:", existing)
print("Total categories:", Category.objects.count())
