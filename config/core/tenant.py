"""
Multi-tenant SaaS infrastructure for the Restaurant POS system.

This module provides the core tenant isolation utilities:
- TenantAwareManager / TenantAwareQuerySet: automatic restaurant filtering
- TenantScopedMixin: DRF view mixin for tenant-scoped querysets
- get_tenant: resolve the current tenant from request/user
- enforce_tenant_access: verify a user can access a specific object
"""

from django.db import models
from rest_framework.exceptions import PermissionDenied
from channels.db import database_sync_to_async


# ---------------------------------------------------------------------------
# Tenant resolution helpers
# ---------------------------------------------------------------------------

def get_tenant(request):
    """Resolve the restaurant for the current request.

    For authenticated employees, the restaurant is ALWAYS taken from their
    server-side profile relationship. Never from request body, query params,
    URL kwargs, or JWT claims supplied by the client.
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None

    profile = getattr(user, "employee_profile", None)
    if profile is not None and profile.restaurant and profile.is_active:
        return profile.restaurant

    return None


def get_tenant_id(request):
    """Return the restaurant ID for the current request, or None."""
    tenant = get_tenant(request)
    return tenant.id if tenant else None


def get_tenant_from_user(user):
    """Resolve the restaurant for a user object (no request context)."""
    if not user or not user.is_authenticated:
        return None
    profile = getattr(user, "employee_profile", None)
    if profile is not None and profile.restaurant and profile.is_active:
        return profile.restaurant
    return None


# ---------------------------------------------------------------------------
# Tenant enforcement
# ---------------------------------------------------------------------------

def enforce_tenant_access(request, obj):
    """Raise PermissionDenied if the request's tenant does not own ``obj``.

    ``obj`` must have a ``restaurant`` attribute (FK to Restaurant).
    Superusers bypass this check.
    """
    user = getattr(request, "user", None)
    if user and user.is_superuser:
        return True

    tenant = get_tenant(request)
    obj_restaurant = getattr(obj, "restaurant", None)

    if tenant is None:
        raise PermissionDenied("No restaurant assigned to your account.")

    if obj_restaurant is None:
        raise PermissionDenied("Access denied.")

    if obj_restaurant.id != tenant.id:
        raise PermissionDenied("You do not have access to this resource.")

    return True


def enforce_same_tenant(*objects):
    """Ensure all given objects belong to the same restaurant.

    Used to prevent cross-restaurant foreign key assignments.
    """
    restaurants = set()
    for obj in objects:
        r = getattr(obj, "restaurant", None)
        if r is not None:
            restaurants.add(r.id)

# ---------------------------------------------------------------------------
# Tenant-aware QuerySet & Manager
# ---------------------------------------------------------------------------

class TenantAwareQuerySet(models.QuerySet):
    """QuerySet that can be scoped by restaurant."""

    def for_tenant(self, restaurant):
        if restaurant is None:
            return self.none()
        return self.filter(restaurant=restaurant)


class TenantAwareManager(models.Manager.from_queryset(TenantAwareQuerySet)):
    """Manager providing ``for_tenant()``."""

    def for_tenant(self, restaurant):
        return self.get_queryset().for_tenant(restaurant)


# ---------------------------------------------------------------------------
# DRF View Mixin
# ---------------------------------------------------------------------------

class TenantScopedMixin:
    """DRF view mixin that automatically scopes querysets to the tenant.

    The tenant is resolved from ``request.user.employee_profile.restaurant``.
    Superusers bypass filtering and see all data (across all restaurants).
    """

    def _get_tenant(self, request):
        return get_tenant(request)

    def get_queryset(self):
        qs = super().get_queryset()
        request = getattr(self, "request", None)
        if request is None:
            return qs

        user = request.user
        if user.is_superuser:
            return qs

        tenant = self._get_tenant(request)
        if tenant is None:
            return qs.none() if hasattr(qs, "none") else qs.filter(pk__in=[])

        model = qs.model
        if hasattr(model, "restaurant"):
            return qs.filter(restaurant=tenant)

        return qs

    def perform_create(self, serializer):
        """Automatically assign the tenant on creation."""
        user = self.request.user
        tenant = self._get_tenant(self.request)

        if "restaurant" in serializer.fields:
            serializer.validated_data.pop("restaurant", None)
            if tenant is not None:
                serializer.validated_data["restaurant"] = tenant
            elif user.is_superuser:
                if not serializer.validated_data.get("restaurant"):
                    raise PermissionDenied(
                        "Superuser must specify a restaurant."
                    )

        super().perform_create(serializer)


# ---------------------------------------------------------------------------
# WebSocket tenant helpers
# ---------------------------------------------------------------------------

@database_sync_to_async
def get_ws_tenant(scope):
    """Resolve the tenant from a WebSocket scope's authenticated user."""
    user = scope.get("user")
    if not user or not hasattr(user, "is_authenticated") or not user.is_authenticated:
        return None

    if user.is_superuser:
        return None

    profile = getattr(user, "employee_profile", None)
    if profile is not None and profile.restaurant and profile.is_active:
        return profile.restaurant

    return None


def ws_tenant_group(restaurant, suffix):
    """Return a tenant-scoped WebSocket group name.

    Example:
        ws_tenant_group(restaurant, "kitchen")  -> "restaurant_5_kitchen"
    """
    return f"restaurant_{restaurant.id}_{suffix}"

