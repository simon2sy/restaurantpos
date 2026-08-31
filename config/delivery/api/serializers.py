from rest_framework import serializers

from delivery.models import Delivery, DeliveryPerson


class DeliveryPersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryPerson
        fields = ["id", "name", "phone", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class DeliverySerializer(serializers.ModelSerializer):
    order_number = serializers.IntegerField(source="order.order_number", read_only=True)
    assigned_person_name = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            "id", "order", "order_number",
            "customer_name", "customer_phone", "address", "landmark",
            "delivery_fee", "assigned_person", "assigned_person_name",
            "status", "created_at", "delivered_at",
        ]
        read_only_fields = ["id", "created_at", "delivered_at"]

    def get_assigned_person_name(self, obj):
        if obj.assigned_person:
            return obj.assigned_person.name
        return None


class CreateDeliveryOrderSerializer(serializers.Serializer):
    """Create a delivery order (staff flow or customer flow)."""

    customer_name = serializers.CharField(max_length=150)
    customer_phone = serializers.CharField(max_length=20)
    address = serializers.CharField()
    landmark = serializers.CharField(max_length=255, required=False, default="", allow_blank=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Items
    items = serializers.ListField(child=serializers.DictField(), min_length=1)

    def validate_items(self, value):
        for item in value:
            if "menu_item_id" not in item:
                raise serializers.ValidationError("Each item must have menu_item_id.")
            if "quantity" not in item:
                raise serializers.ValidationError("Each item must have quantity.")
            qty = item["quantity"]
            if not isinstance(qty, int) or qty < 1:
                raise serializers.ValidationError("Quantity must be a positive integer.")
        return value


class AssignDeliverySerializer(serializers.Serializer):
    """Assign a delivery person to a delivery."""

    delivery_person_id = serializers.IntegerField()


class DeliveryStatusSerializer(serializers.Serializer):
    """Change delivery status."""

    status = serializers.ChoiceField(choices=Delivery.Status.choices)
