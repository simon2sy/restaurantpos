import functools

from django.core.exceptions import PermissionDenied


def require_role(user, *roles):

    if not user.is_authenticated:
        raise PermissionDenied

    if user.is_superuser:
        return

    # Platform admins bypass role checks (they can do anything)
    employee = getattr(user, "employee_profile", None)
    if employee and employee.is_active and employee.role == "PLATFORM_ADMIN":
        return

    if not employee or not employee.is_active:
        raise PermissionDenied

    if employee.role not in roles:
        raise PermissionDenied


def role_required(*roles):
    """View decorator enforcing that the logged-in employee has one of
    ``roles``. Superusers and platform admins always pass through."""

    def decorator(view_func):

        @functools.wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            require_role(request.user, *roles)
            return view_func(request, *args, **kwargs)

        return _wrapped

    return decorator


# Roles allowed into back-of-house / management areas.
MANAGEMENT_ROLES = ("MANAGER", "RESTAURANT_ADMIN")
CASHIER_ROLES = ("WAITER", "CASHIER", "MANAGER", "RESTAURANT_ADMIN")
KITCHEN_ROLES = ("KITCHEN", "MANAGER", "RESTAURANT_ADMIN")