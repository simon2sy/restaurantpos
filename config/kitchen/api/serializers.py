from rest_framework import serializers

from orders.models import OrderBatch, OrderItem


class KitchenOrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "menu_item", "menu_item_name", "quantity", "notes", "status"]
        read_only_fields = fields


class KitchenBatchSerializer(serializers.ModelSerializer):
    """Batch as seen on the kitchen dashboard."""

    order_number = serializers.IntegerField(source="order.order_number", read_only=True)
    order_type = serializers.CharField(source="order.order_type", read_only=True)
    table_number = serializers.IntegerField(source="order.table.number", read_only=True, default=None)
    cabin_number = serializers.IntegerField(source="order.cabin.number", read_only=True, default=None)
    delivery_customer_name = serializers.SerializerMethodField()
    delivery_customer_phone = serializers.SerializerMethodField()
    items = KitchenOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = OrderBatch
        fields = [
            "id", "batch_number", "status",
            "order_number", "order_type",
            "table_number", "cabin_number",
            "delivery_customer_name", "delivery_customer_phone",
            "items",
            "sent_to_kitchen_at", "started_at", "ready_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_delivery_customer_name(self, obj):
        order = obj.order
        delivery = getattr(order, "delivery", None)
        return delivery.customer_name if delivery else None

    def get_delivery_customer_phone(self, obj):
        order = obj.order
        delivery = getattr(order, "delivery", None)
        return delivery.customer_phone if delivery else None
