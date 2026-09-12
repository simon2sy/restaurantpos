import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Restaurant(models.Model):
    """A restaurant location (tenant). Each restaurant has its own staff, menu, orders, etc.

    Tenant isolation is enforced at the application level: every restaurant-owned
    record has a FK to this model, and all queries are scoped to the authenticated
    user's restaurant via the tenant infrastructure in ``core.tenant``.
    """

    # Internal PK remains BigAutoField for compatibility with existing FKs.
    # Use `public_id` for all public-facing identifiers (URLs, APIs, mobile).
    public_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Public-facing unique identifier used in URLs and APIs.",
    )

    name = models.CharField(max_length=200, default="Restaurant POS")
    slug = models.SlugField(
        max_length=100,
        unique=True,
        default="restaurant",
        help_text="Unique identifier used for login and URLs (e.g., 'my-restaurant').",
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        help_text="Short internal code for the restaurant (e.g., 'R001').",
    )
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    contact_email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to="restaurants/logos/", blank=True, null=True)
    opening_hours = models.CharField(max_length=200, blank=True)
    default_delivery_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    receipt_footer = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text="If true, this restaurant is used as fallback for legacy data.",
    )
    subscription_plan = models.CharField(
        max_length=50,
        default="free",
        choices=[
            ("free", "Free Trial"),
            ("basic", "Basic"),
            ("pro", "Professional"),
            ("enterprise", "Enterprise"),
        ],
    )
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    max_employees = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restaurant"
        verbose_name_plural = "Restaurants"
        ordering = ["name"]

    def __str__(self):
        return self.name

    @classmethod
    def get_default(cls):
        """Get or create the default restaurant for backwards compatibility.

        Uses ``.first()`` instead of an implicit ``.get()`` so duplicate
        default rows can never crash the request (they are cleaned up here).
        """
        obj = cls.objects.filter(is_default=True).order_by("id").first()
        if obj is None:
            obj, _ = cls.objects.get_or_create(
                is_default=True,
                defaults={"name": "Main Restaurant", "slug": "main-restaurant"},
            )
        # Repair data drift: only one restaurant may be the default.
        if cls.objects.filter(is_default=True).exclude(pk=obj.pk).exists():
            cls.objects.exclude(pk=obj.pk).filter(is_default=True).update(
                is_default=False
            )
        return obj

    def save(self, *args, **kwargs):
        """Ensure only one restaurant is marked as the default."""
        if self.is_default:
            type(self).objects.exclude(pk=self.pk).filter(is_default=True).update(
                is_default=False
            )
        super().save(*args, **kwargs)

    @property
    def is_subscription_active(self):
        """Check if the restaurant's subscription is still valid."""
        if self.subscription_plan == "free":
            return True
        if self.subscription_expires_at is None:
            return True
        return timezone.now() < self.subscription_expires_at

    @property
    def employee_count(self):
        """Return the number of active employees for this restaurant."""
        return self.employees.filter(is_active=True).count()

    @property
    def can_add_employee(self):
        """Check if the restaurant can add more employees."""
        return self.employee_count < self.max_employees


class RestaurantSettings(models.Model):
    """Restaurant-specific settings. Linked to a Restaurant."""

    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="settings",
        primary_key=True,
    )
    name = models.CharField(max_length=200, default="Restaurant POS")
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    logo = models.ImageField(upload_to="restaurants/logos/", blank=True, null=True)
    opening_hours = models.CharField(max_length=200, blank=True)
    default_delivery_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    receipt_footer = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restaurant Settings"
        verbose_name_plural = "Restaurant Settings"

    def __str__(self):
        return f"Settings for {self.restaurant.name}"

    @classmethod
    def get(cls, restaurant):
        """Get settings for a specific restaurant."""
        obj, _ = cls.objects.get_or_create(restaurant=restaurant)
        return obj

    @classmethod
    def get_default_settings(cls):
        """For backwards compatibility: get settings for default restaurant."""
        default_restaurant = Restaurant.get_default()
        return cls.get(default_restaurant)


class AuditLog(models.Model):
    """A read-only record of important system actions."""

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
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

    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )

    class Type(models.TextChoices):
        ORDER_READY = "ORDER_READY", "Order Ready"

    notification_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.ORDER_READY,
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


