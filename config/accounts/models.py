import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


# How long a generated employee QR token remains valid, in seconds.
QR_TOKEN_VALIDITY_SECONDS = 7 * 24 * 3600  # 7 days


class EmployeeProfile(TimeStampedModel):

    class Role(models.TextChoices):
        PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"
        RESTAURANT_ADMIN = "RESTAURANT_ADMIN", "Restaurant Admin"
        MANAGER = "MANAGER", "Manager"
        WAITER = "WAITER", "Waiter"
        KITCHEN = "KITCHEN", "Kitchen"
        DELIVERY = "DELIVERY", "Delivery"
        CASHIER = "CASHIER", "Cashier"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )

    restaurant = models.ForeignKey(
        "core.Restaurant",
        on_delete=models.CASCADE,
        related_name="employees",
        null=True,
        blank=True,
        help_text="The restaurant this employee belongs to. Null for platform admins.",
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )

    # A value of None means "no QR issued".
    qr_token = models.UUIDField(
        null=True,
        blank=True,
        unique=False,
        editable=False,
    )

    qr_token_expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username

    # ------------------------------------------------------------
    # QR token lifecycle
    # ------------------------------------------------------------

    @property
    def qr_token_valid(self):
        """True if the employee has a QR token that is not expired."""
        if not self.is_active or not self.user.is_active:
            return False
        if self.qr_token is None:
            return False
        if self.qr_token_expires_at is None:
            return False
        return timezone.now() < self.qr_token_expires_at

    def rotate_qr_token(self):
        """Generate a new QR token with a fresh expiry. Returns the token."""
        self.qr_token = uuid.uuid4()
        self.qr_token_expires_at = timezone.now() + timedelta(
            seconds=QR_TOKEN_VALIDITY_SECONDS
        )
        self.save(update_fields=["qr_token", "qr_token_expires_at"])
        return self.qr_token

    def revoke_qr_token(self):
        """Invalidate any existing QR token immediately."""
        self.qr_token = None
        self.qr_token_expires_at = None
        self.save(update_fields=["qr_token", "qr_token_expires_at"])

    @property
    def role_display(self):
        return self.get_role_display()


class EmployeeActivity(TimeStampedModel):
    """A lightweight activity trail for an employee (QR ops, logins...)."""

    employee = models.ForeignKey(
        EmployeeProfile,
        on_delete=models.CASCADE,
        related_name="activities",
    )

    action = models.CharField(max_length=100)

    detail = models.CharField(
        max_length=255,
        blank=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee} — {self.action}"


class RestaurantEmployee(models.Model):
    """Links a User to a Restaurant as an employee."""

    restaurant = models.ForeignKey(
        "core.Restaurant",
        on_delete=models.CASCADE,
        related_name="restaurant_employees",
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="restaurant_assignments",
    )

    role = models.CharField(
        max_length=20,
        choices=EmployeeProfile.Role.choices,
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [["restaurant", "user"]]
        verbose_name = "Restaurant Employee"
        verbose_name_plural = "Restaurant Employees"

    def __str__(self):
        return f"{self.user.username} @ {self.restaurant.name}"