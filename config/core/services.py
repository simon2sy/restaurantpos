"""Cross-cutting services: audit logging, settings, permission helpers."""

from datetime import date, datetime, time, timedelta


def get_client_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(user, action, object_repr="", metadata=None, request=None):
    """Record an audit-log entry. Best-effort; never raises into the caller."""
    from .models import AuditLog

    try:
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            object_repr=object_repr,
            metadata=metadata or {},
            ip_address=get_client_ip(request),
        )
    except Exception:
        # Audit logging must never break a primary business flow.
        pass


def get_restaurant_settings():
    from .models import RestaurantSettings

    return RestaurantSettings.get()


def today_range(days=1):
    """Return (start_dt, end_dt) for the current local day offset by `days`."""
    today = date.today()
    day = today - timedelta(days=days)
    start = datetime.combine(day, time.min)
    end = datetime.combine(day, time.max)
    return start, end


def default_context(request, extra=None):
    """Assemble the context shared by most page renders."""
    ctx = {"restaurant": get_restaurant_settings()}
    if extra:
        ctx.update(extra)
    return ctx