"""Cross-cutting services: audit logging, settings, permission helpers."""

from datetime import date, datetime, time, timedelta

from .models import Restaurant, RestaurantSettings


def get_client_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(user, action, object_repr="", metadata=None, request=None, restaurant=None):
    """Record an audit-log entry. Best-effort; never raises into the caller."""
    from .models import AuditLog

    if restaurant is None and user and user.is_authenticated:
        profile = getattr(user, "employee_profile", None)
        if profile and profile.restaurant:
            restaurant = profile.restaurant

    try:
        AuditLog.objects.create(
            restaurant=restaurant,
            user=user if user and user.is_authenticated else None,
            action=action,
            object_repr=object_repr,
            metadata=metadata or {},
            ip_address=get_client_ip(request),
        )
    except Exception:
        # Audit logging must never break a primary business flow.
        pass


def get_restaurant_settings(restaurant=None):
    if restaurant is None:
        restaurant = Restaurant.get_default()
    return RestaurantSettings.get(restaurant)


def get_current_restaurant(request):
    """Get the restaurant for the current request.

    For authenticated employees, the restaurant is always taken from their
    profile. If an employee has no restaurant assigned, this is treated as
    a configuration error — we do NOT fall back to the default restaurant,
    because that would silently mix data between restaurants.
    """
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        profile = getattr(user, "employee_profile", None)
        if profile is not None:
            if profile.restaurant:
                return profile.restaurant
            # Employee exists but has no restaurant assigned.
            # Raise so callers can decide how to handle it.
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                f"Employee {user.get_full_name() or user.username} has no restaurant assigned."
            )
    # Non-employee (customer) or unauthenticated: fall back to default.
    return Restaurant.get_default()


def get_current_restaurant_from_user(user):
    """Get the restaurant for a user object (without request context).

    Same semantics as get_current_restaurant: employees must have a
    restaurant assigned; customers/unauthenticated users get the default.
    """
    if user and user.is_authenticated:
        profile = getattr(user, "employee_profile", None)
        if profile is not None:
            if profile.restaurant:
                return profile.restaurant
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                f"Employee {user.get_full_name() or user.username} has no restaurant assigned."
            )
    return Restaurant.get_default()


def today_range(days=1):
    """Return (start_dt, end_dt) for the current local day offset by `days`."""
    today = date.today()
    day = today - timedelta(days=days)
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


def default_context(request, extra=None):
    """Assemble the context shared by most page renders.

    Returns a safe context even when the employee has no restaurant
    assigned. Callers that need a real restaurant should call
    get_current_restaurant() directly and handle the exception.
    """
    from django.core.exceptions import ImproperlyConfigured

    try:
        restaurant = get_current_restaurant(request)
    except ImproperlyConfigured:
        return {"restaurant": None, "employee_missing_restaurant": True}

    ctx = {"restaurant": get_restaurant_settings(restaurant)}
    if extra:
        ctx.update(extra)
    return ctx