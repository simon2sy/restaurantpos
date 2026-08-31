from rest_framework import serializers

from reports.models import Expense


class SalesSummarySerializer(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    total_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    discounts = serializers.DecimalField(max_digits=12, decimal_places=2)
    delivery_fees = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_orders = serializers.IntegerField()
    paid_orders = serializers.IntegerField()
    unpaid_orders = serializers.IntegerField()
    cash = serializers.DecimalField(max_digits=12, decimal_places=2)
    cod = serializers.DecimalField(max_digits=12, decimal_places=2)
    dine_in_orders = serializers.IntegerField()
    delivery_orders = serializers.IntegerField()
    average_order_value = serializers.DecimalField(max_digits=12, decimal_places=2)


class TopItemSerializer(serializers.Serializer):
    menu_item__name = serializers.CharField()
    quantity = serializers.IntegerField()


class SalesBucketSerializer(serializers.Serializer):
    bucket = serializers.DateField()
    sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    count = serializers.IntegerField()


class PaymentMethodBreakdownSerializer(serializers.Serializer):
    payment_method = serializers.CharField(allow_null=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class ReportQuerySerializer(serializers.Serializer):
    """Query parameters for report filtering."""

    period = serializers.CharField(required=False, default="today")
    from_date = serializers.DateField(required=False, source="from")
    to_date = serializers.DateField(required=False, source="to")


class ExpenseSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(
        source="recorded_by.username", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Expense
        fields = [
            "id", "title", "amount", "category", "category_display",
            "note", "spent_on", "recorded_by", "recorded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "recorded_by", "created_at"]
