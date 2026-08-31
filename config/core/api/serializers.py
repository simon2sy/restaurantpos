from rest_framework import serializers

from core.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    order_number = serializers.IntegerField(
        source="order.order_number", read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "order_number",
            "message",
            "table_number",
            "cabin_number",
            "ready_at",
            "dismissed",
            "dismissed_at",
            "created_at",
        ]
        read_only_fields = fields
