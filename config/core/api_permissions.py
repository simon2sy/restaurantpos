from rest_framework.permissions import BasePermission


class IsSuperUser(BasePermission):
    """Allow access only to superusers."""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


class IsPlatformAdmin(BasePermission):
    """Allow access to platform admins and superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return profile is not None and profile.is_active and profile.role == "PLATFORM_ADMIN"


class IsManager(BasePermission):
    """Allow access to managers, restaurant admins, platform admins and superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


class IsAdminOrManager(BasePermission):
    """Allow access to managers, restaurant admins, platform admins and superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


class IsCashierRole(BasePermission):
    """Allow WAITER, CASHIER, MANAGER, RESTAURANT_ADMIN roles plus superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("WAITER", "CASHIER", "MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


class IsKitchenRole(BasePermission):
    """Allow KITCHEN, MANAGER, RESTAURANT_ADMIN roles plus superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("KITCHEN", "MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


class IsDeliveryRole(BasePermission):
    """Allow DELIVERY, MANAGER, RESTAURANT_ADMIN roles plus superusers."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("DELIVERY", "MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


class IsAnyStaff(BasePermission):
    """Any active employee (any role) or superuser."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return profile is not None and profile.is_active


class IsCustomer(BasePermission):
    """Only customers (authenticated users without a staff profile)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return False
        return not hasattr(request.user, "employee_profile")


class IsSuperUserOrManager(BasePermission):
    """Superuser, platform admin, restaurant admin, or MANAGER role."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "employee_profile", None)
        return (
            profile is not None
            and profile.is_active
            and profile.role in ("MANAGER", "RESTAURANT_ADMIN", "PLATFORM_ADMIN")
        )


def require_role(user, *roles):
    """Raise PermissionDenied unless the user has one of the given roles.
    Superusers and platform admins always pass."""
    from rest_framework.exceptions import PermissionDenied

    if not user.is_authenticated:
        raise PermissionDenied("Authentication required.")

    if user.is_superuser:
        return

    profile = getattr(user, "employee_profile", None)
    if not profile or not profile.is_active:
        raise PermissionDenied("No active employee profile.")

    # Platform admins bypass role checks
    if profile.role == "PLATFORM_ADMIN":
        return

    if profile.role not in roles:
        raise PermissionDenied("You do not have permission to perform this action.")
