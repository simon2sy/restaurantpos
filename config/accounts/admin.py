from django.contrib import admin

from .models import EmployeeActivity, EmployeeProfile


class EmployeeActivityInline(admin.TabularInline):
    model = EmployeeActivity
    extra = 0
    can_delete = False
    readonly_fields = (
        "action",
        "detail",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):

    list_display = (
        "user",
        "phone",
        "role",
        "qr_active",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role",
        "is_active",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "phone",
    )

    readonly_fields = (
        "qr_token",
        "qr_token_expires_at",
    )

    inlines = [
        EmployeeActivityInline,
    ]

    @admin.display(boolean=True, description="QR active")
    def qr_active(self, obj):
        return obj.qr_token_valid


@admin.register(EmployeeActivity)
class EmployeeActivityAdmin(admin.ModelAdmin):

    list_display = (
        "employee",
        "action",
        "ip_address",
        "created_at",
    )

    list_filter = (
        "action",
    )

    search_fields = (
        "employee__user__username",
        "action",
    )

    readonly_fields = (
        "employee",
        "action",
        "detail",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False