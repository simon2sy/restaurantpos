from django.contrib import admin

from .models import (
    Cabin,
    Order,
    OrderBatch,
    OrderItem,
    Table,
)


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "capacity",
        "status",
        "is_active",
    )

    list_filter = (
        "status",
        "is_active",
    )


@admin.register(Cabin)
class CabinAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "capacity",
        "status",
        "is_active",
    )

    list_filter = (
        "status",
        "is_active",
    )


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class OrderBatchInline(admin.TabularInline):
    model = OrderBatch
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    list_display = (
        "order_number",
        "order_type",
        "table",
        "cabin",
        "status",
        "total",
        "created_by",
        "created_at",
    )

    list_filter = (
        "order_type",
        "status",
    )

    search_fields = (
        "order_number",
    )

    readonly_fields = (
        "order_number",
    )

    inlines = [
        OrderBatchInline,
    ]


@admin.register(OrderBatch)
class OrderBatchAdmin(admin.ModelAdmin):

    list_display = (
        "order",
        "batch_number",
        "sent_to_kitchen_at",
        "created_at",
    )

    inlines = [
        OrderItemInline,
    ]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):

    list_display = (
        "batch",
        "menu_item",
        "quantity",
        "unit_price",
        "status",
    )

    list_filter = (
        "status",
    )