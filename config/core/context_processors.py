from .services import get_restaurant_settings


def restaurant_settings(request):
    """Expose restaurant settings to every template as `restaurant`."""
    from django.core.cache import cache

    cached = cache.get("restaurant_settings")
    if cached is None:
        cached = get_restaurant_settings()
        cache.set("restaurant_settings", cached, 300)
    return {"restaurant": cached}


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