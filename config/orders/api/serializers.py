from rest_framework import serializers

from orders.models import Cabin, Order, OrderBatch, OrderItem, Table


# ============================================================
# TABLE
# ============================================================


class TableSerializer(serializers.ModelSerializer):
    open_order_id = serializers.SerializerMethodField()
    open_order_number = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = ["id", "number", "capacity", "status", "is_active", "open_order_id", "open_order_number"]
        read_only_fields = ["id"]

    def get_open_order_id(self, obj):
        open_order = getattr(obj, "_open_order", None)
        return open_order.id if open_order else None

    def get_open_order_number(self, obj):
        open_order = getattr(obj, "_open_order", None)
        return open_order.order_number if open_order else None


class TableCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ["id", "number", "capacity", "status", "is_active"]


# ============================================================
# CABIN
# ============================================================


class CabinSerializer(serializers.ModelSerializer):
    open_order_id = serializers.SerializerMethodField()
    open_order_number = serializers.SerializerMethodField()

    class Meta:
        model = Cabin
        fields = ["id", "number", "capacity", "status", "is_active", "open_order_id", "open_order_number"]
        read_only_fields = ["id"]

    def get_open_order_id(self, obj):
        open_order = getattr(obj, "_open_order", None)
        return open_order.id if open_order else None

    def get_open_order_number(self, obj):
        open_order = getattr(obj, "_open_order", None)
        return open_order.order_number if open_order else None


class CabinCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cabin
        fields = ["id", "number", "capacity", "status", "is_active"]


# ============================================================
# ORDER ITEM
# ============================================================


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id", "batch", "menu_item", "menu_item_name", "quantity",
            "unit_price", "notes", "status", "line_total",
            "created_at",
        ]
        read_only_fields = ["id", "unit_price", "created_at"]


# ============================================================
# ORDER BATCH
# ============================================================


class OrderBatchSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = OrderBatch
        fields = [
            "id", "order", "batch_number", "status",
            "sent_to_kitchen_at", "started_at", "ready_at",
            "items", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ============================================================
# ORDER
# ============================================================


class OrderListSerializer(serializers.ModelSerializer):
    """Compact serializer for listing orders."""

    table_number = serializers.IntegerField(source="table.number", read_only=True, default=None)
    cabin_number = serializers.IntegerField(source="cabin.number", read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()
    delivery_customer_name = serializers.SerializerMethodField()
    batches_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "order_type", "status",
            "table", "table_number", "cabin", "cabin_number",
            "subtotal", "discount", "delivery_fee", "total",
            "payment_method", "payment_status", "paid_at",
            "created_by", "created_by_name",
            "delivery_customer_name", "batches_count",
            "created_at",
        ]
        read_only_fields = [
            "id", "order_number", "subtotal", "total",
            "payment_status", "paid_at", "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_delivery_customer_name(self, obj):
        delivery = getattr(obj, "delivery", None)
        return delivery.customer_name if delivery else None

    def get_batches_count(self, obj):
        return obj.batches.count()


class OrderDetailSerializer(serializers.ModelSerializer):
    """Full order detail with batches and items."""

    table_number = serializers.IntegerField(source="table.number", read_only=True, default=None)
    cabin_number = serializers.IntegerField(source="cabin.number", read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()
    batches = OrderBatchSerializer(many=True, read_only=True)
    delivery = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "order_type", "status",
            "table", "table_number", "cabin", "cabin_number",
            "subtotal", "discount", "delivery_fee", "total",
            "payment_method", "payment_status", "paid_at",
            "created_by", "created_by_name",
            "batches", "delivery",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "order_number", "subtotal", "total",
            "payment_status", "paid_at", "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_delivery(self, obj):
        delivery = getattr(obj, "delivery", None)
        if delivery:
            return {
                "id": delivery.id,
                "customer_name": delivery.customer_name,
                "customer_phone": delivery.customer_phone,
                "address": delivery.address,
                "landmark": delivery.landmark,
                "delivery_fee": str(delivery.delivery_fee),
                "status": delivery.status,
                "assigned_person": delivery.assigned_person_id,
            }
        return None


# ============================================================
# CREATE ORDER
# ============================================================


class CreateOrderSerializer(serializers.Serializer):
    """Create a new order (dine-in or delivery)."""

    order_type = serializers.ChoiceField(
        choices=Order.OrderType.choices, default=Order.OrderType.DINE_IN
    )
    table_id = serializers.IntegerField(required=False, allow_null=True)
    cabin_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        order_type = attrs.get("order_type")
        table_id = attrs.get("table_id")
        cabin_id = attrs.get("cabin_id")

        if order_type == Order.OrderType.DELIVERY:
            if table_id or cabin_id:
                raise serializers.ValidationError("A delivery order cannot have a table or cabin.")
        elif order_type == Order.OrderType.DINE_IN:
            if table_id and cabin_id:
                raise serializers.ValidationError("An order cannot have both table and cabin.")
            if not table_id and not cabin_id:
                raise serializers.ValidationError("A dine-in order requires a table or cabin.")

            if table_id:
                try:
                    table = Table.objects.get(pk=table_id, is_active=True)
                    if table.status != Table.Status.AVAILABLE:
                        raise serializers.ValidationError("Table is not available.")
                except Table.DoesNotExist:
                    raise serializers.ValidationError("Table not found.")

            if cabin_id:
                try:
                    cabin = Cabin.objects.get(pk=cabin_id, is_active=True)
                    if cabin.status != Cabin.Status.AVAILABLE:
                        raise serializers.ValidationError("Cabin is not available.")
                except Cabin.DoesNotExist:
                    raise serializers.ValidationError("Cabin not found.")

        return attrs


# ============================================================
# ADD ITEMS TO ORDER
# ============================================================


class AddOrderItemSerializer(serializers.Serializer):
    """Add items to an existing order (new batch)."""

    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class AddItemsToOrderSerializer(serializers.Serializer):
    """Wrap multiple items for batch creation."""

    items = AddOrderItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value


# ============================================================
# PAYMENT
# ============================================================


class PaymentSerializer(serializers.Serializer):
    """Complete payment for an order."""

    payment_method = serializers.ChoiceField(
        choices=[("CASH", "Cash"), ("COD", "Cash on Delivery"), ("ONLINE", "Online")]
    )
