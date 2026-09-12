from django.db.models.signals import post_save
from django.dispatch import receiver

from core.realtime import broadcast_dashboard_update


@receiver(post_save, sender="orders.Order")
def broadcast_order_change(sender, instance, **kwargs):
    broadcast_dashboard_update(restaurant=instance.restaurant, reason="order")


@receiver(post_save, sender="orders.OrderItem")
def broadcast_order_item_change(sender, instance, **kwargs):
    # OrderItem has a restaurant FK directly
    broadcast_dashboard_update(restaurant=instance.restaurant, reason="order_item")
