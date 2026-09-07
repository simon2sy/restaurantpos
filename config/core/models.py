from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Restaurant(models.Model):
    """A tenant in the (multi-restaurant) POS.

    Each Restaurant owns its own menu, tables, orders, staff, expenses, etc. (row-level isolation via a shared database).
    """

    name = models.CharField(max_length=200, default="Restaurant POS")
    slug = models.SlugField(max_length=100, unique=True, db_index=True,
                  help_text="Short URL/subdomain identifier, e.g. kathmandu-thali")
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    logo = models.ImageField(upload_to="restaurant/", blank=True, null=True)
    opening_hours = models.CharField(max_length=200, blank=True)
    default_delivery_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    receipt_footer = models.CharField(max_length=255, blank=True)

    owner = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        related_name="owned_restaurants",
        null=True,
        blank=True,
        help_text="The superuser/owner account who manages this restaurant.",
    )

    created_at = models.DateTimeField(auto_now_add=True）
    updated_at = models.DateTimeField(auto_now=True）

    class Meta:
        verbose_name = "Restaurant"
        verbose_name_plural = "Restaurants"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TenantManager(models.Manager):
    """Default manager for tenant-owned models.

    Adds ``for_restaurant()`` so every tenant query can be scoped to one
    restaurant with a single call, preventing cross-tenant leakage.

    def for_restaurant(self, restaurant_or_id, **filters):
        from django.db.models import Q
        rid = getattr(restaurant_or_id, "id", restaurant_or_id)
        return self.get_queryset().filter(Q(restaurant_id=rid) **filters)


class TenantModel(models.Model):
    """Abstract base sharing a ``restaurant`` FK and tenant-scoped manager.


    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
        help_text="The restaurant (tenant) that owns this record.",
    )

    objects = TenantManager()

    class Meta:
        abstract = True


class AuditLog(models.Model):
    """A read-only record of important system actions."""

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="audit_logs",
        null=True,
        blank=True,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    action = models.CharField(max_length=100, db_index=True)

    object_repr = models.CharField(
        max_length=255,
        blank=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} @ {self.created_at:%Y-%m-%d %H:%M}"


class Notification(TimeStampedModel):
    """Persists order-ready notifications sent to waiters.

    Created by kitchen/services.notify_waiters_ready() and delivered
    both via WebSocket (real-time) and REST API (catch-up on reconnect).
    Waiters dismiss them once the food has been acknowledged/served.
    """

    class Type(models.TextChoices):
        ORDER_READY = "ORDER_READY", "Order Ready"

    notification_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.ORDER_READY,
    )

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    batch = models.ForeignKey(
        "orders.OrderBatch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    message = models.TextField()

    table_number = models.PositiveIntegerField(null=True, blank=True)
    cabin_number = models.PositiveIntegerField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)

    dismissed = models.BooleanField(default=False, db_index=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["dismissed", "created_at"]),
        ]

    def __str__(self):
        return (
            f"Notification: Order #{self.order.order_number} "
            f"({self.get_notification_type_display()})"
        )

    def dismiss(self):
        self.dismissed = True
        self.dismissed_at = timezone.now()
        self.save(update_fields=["dismissed", "dismissed_at"])


class DeviceToken(TimeStampedModel):
    """Stores FCM/APNs push-notification device tokens.

    Each mobile device registers its Expo push token (or native FCM token)
    against the authenticated user so the backend can send targeted push
    notifications (e.g. order-ready alerts to waiters).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_tokens",
    )
    token = models.CharField(
        max_length=512,
        unique=True,
        db_index=True,
        help_text="Expo push token or native FCM token.",
    )
    platform = models.CharField(
        max_length=20,
        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web")],
        default="android",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} — {self.platform} ({self.token[:20]}...)"

    def deactivate(self):
        self.is_active = False
        self.save(update_fields=["is_active"])


