from django.contrib import admin

from .models import (
    AuditLog,
    DeviceToken,
    Notification,
    Restaurant,
    RestaurantSettings,
)


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    """Platform admin management of restaurants (tenants)."""

    list_display = (
        "name",
        "slug",
        "code",
        "phone",
        "is_active",
        "is_default",
        "subscription_plan",
        "employee_count",
        "created_at",
    )

    list_filter = (
        "is_active",
        "is_default",
        "subscription_plan",
    )

    search_fields = (
        "name",
        "slug",
        "code",
        "phone",
        "contact_email",
    )

    readonly_fields = (
        "public_id",
        "created_at",
        "updated_at",
    )

    prepopulated_fields = {"slug": ("name",)}

    fieldsets = (
        ("Identity", {
            "fields": ("name", "slug", "code", "public_id"),
        }),
        ("Contact", {
            "fields": ("address", "phone", "contact_email", "logo"),
        }),
        ("Operations", {
            "fields": (
                "opening_hours",
                "default_delivery_fee",
                "receipt_footer",
            ),
        }),
        ("Status & Subscription", {
            "fields": (
                "is_active",
                "is_default",
                "subscription_plan",
                "subscription_expires_at",
                "max_employees",
            ),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
        }),
    )

    def employee_count(self, obj):
        return obj.employee_count

    employee_count.short_description = "Active employees"


@admin.register(RestaurantSettings)
class RestaurantSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "restaurant",
        "name",
        "phone",
        "default_delivery_fee",
    )

    search_fields = (
        "restaurant__name",
        "restaurant__slug",
    )

    autocomplete_fields = ("restaurant",)


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "platform",
        "is_active",
        "created_at",
    )

    list_filter = (
        "platform",
        "is_active",
    )

    search_fields = (
        "user__username",
        "token",
    )

    readonly_fields = ("created_at", "updated_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "message",
        "restaurant",
        "notification_type",
        "dismissed",
        "created_at",
    )

    list_filter = (
        "notification_type",
        "dismissed",
    )

    search_fields = (
        "message",
        "order__order_number",
        "restaurant__name",
    )

    autocomplete_fields = ("restaurant", "order", "batch")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only audit log across the platform."""

    list_display = (
        "action",
        "restaurant",
        "user",
        "ip_address",
        "created_at",
    )

    list_filter = (
        "action",
        "restaurant",
    )

    search_fields = (
        "action",
        "object_repr",
        "user__username",
        "restaurant__name",
    )

    readonly_fields = (
        "restaurant",
        "user",
        "action",
        "object_repr",
        "metadata",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False