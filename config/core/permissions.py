import functools

from django.core.exceptions import PermissionDenied


def require_role(user, *roles):

    if not user.is_authenticated:
        raise PermissionDenied

    if user.is_superuser:
        return

    employee = getattr(
        user,
        "employee_profile",
        None,
    )

    if not employee or not employee.is_active:
        raise PermissionDenied

    if employee.role not in roles:
        raise PermissionDenied


def role_required(*roles):
    """View decorator enforcing that the logged-in employee has one of
    ``roles``. Superusers always pass through."""

    def decorator(view_func):

        @functools.wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            require_role(request.user, *roles)
            return view_func(request, *args, **kwargs)

        return _wrapped

    return decorator


# Roles allowed into back-of-house / management areas.
MANAGEMENT_ROLES = ("MANAGER",)
CASHIER_ROLES = ("WAITER", "CASHIER", "MANAGER")
KITCHEN_ROLES = ("KITCHEN", "MANAGER")