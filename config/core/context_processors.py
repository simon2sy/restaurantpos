from .services import get_restaurant_settings, get_current_restaurant


def restaurant_settings(request):
    """Expose restaurant settings to every template as `restaurant`.

    For employees with a restaurant assigned, this returns their restaurant.
    For customers and unauthenticated users, it falls back to the default
    restaurant. If an employee has no restaurant assigned, we raise so the
    view layer can handle it — this context processor should not be the one
    to crash the request.
    """
    from django.core.cache import cache
    from django.core.exceptions import ImproperlyConfigured

    try:
        current_restaurant = get_current_restaurant(request)
    except ImproperlyConfigured:
        # Employee with no restaurant — return a safe empty context.
        # The view layer (admin_dashboard etc.) will render its own error.
        return {
            "restaurant": None,
            "current_restaurant": None,
            "employee_missing_restaurant": True,
        }

    cache_key = f"restaurant_settings_{current_restaurant.id}"
    cached = cache.get(cache_key)
    if cached is None:
        cached = get_restaurant_settings(current_restaurant)
        cache.set(cache_key, cached, 300)
    return {"restaurant": cached, "current_restaurant": current_restaurant}


def cart_info(request):
    """Expose the customer's cart item count to every template."""
    user = getattr(request, "user", None)
    if (
        user is not None
        and user.is_authenticated
        and not user.is_superuser
        and not user.is_staff
        and not hasattr(user, "employee_profile")
    ):
        cart = request.session.get("cart", {})
        try:
            count = sum(int(q) for q in cart.values())
        except (TypeError, ValueError):
            count = 0
        return {"cart_count": count}
    return {"cart_count": 0}