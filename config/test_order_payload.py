import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from orders.models import Table, Cabin
from orders.api.serializers import CreateOrderSerializer, AddItemsToOrderSerializer
from menu.models import MenuItem

print("TABLES:", [(t.id, t.number, t.status, t.is_active) for t in Table.objects.all()][:8])
print("CABINS:", [(c.id, c.number, c.status, c.is_active) for c in Cabin.objects.all()][:8])

t = Table.objects.first()
if t:
    s = CreateOrderSerializer(data={"order_type": "DINE_IN", "table_id": t.id})
    print("CREATE VALID:", s.is_valid())
    print("CREATE ERRORS:", s.errors)

item = MenuItem.objects.first()
print("ITEM:", (item.id if item else None))
if item:
    s2 = AddItemsToOrderSerializer(data={"items": [{"menu_item_id": item.id, "quantity": 2}]})
    print("ADDITEMS VALID:", s2.is_valid())
    print("ADDITEMS ERRORS:", s2.errors)
