from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from .models import EmployeeActivity, EmployeeProfile, RestaurantEmployee


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
        "restaurant",
        "phone",
        "role",
        "qr_active",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role",
        "is_active",
        "restaurant",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "phone",
        "restaurant__name",
    )

    autocomplete_fields = ("user", "restaurant")

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


@admin.register(RestaurantEmployee)
class RestaurantEmployeeAdmin(admin.ModelAdmin):
    """Platform admin assigns staff to restaurants here."""

    list_display = (
        "user",
        "restaurant",
        "role",
        "is_active",
    )

    list_filter = (
        "role",
        "is_active",
        "restaurant",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "restaurant__name",
    )

    autocomplete_fields = ("user", "restaurant")


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


# ---------------------------------------------------------------------
# Extend Django's User admin so platform admins can create/assign staff.
# ---------------------------------------------------------------------

class EmployeeInline(admin.StackedInline):
    model = EmployeeProfile
    extra = 0
    can_delete = True


# Unregister the default User admin and re-register with employee inline.
admin.site.unregister(User)


@admin.register(User)
class UserAdminWithEmployeeProfile(UserAdmin):
    inlines = [EmployeeInline]
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "username",
                "password1",
                "password2",
                "first_name",
                "last_name",
                "email",
                "is_staff",
                "is_superuser",
            ),
        }),
    )