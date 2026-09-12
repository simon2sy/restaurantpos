from django.db import models

from orders.models import Order


class DeliveryPerson(models.Model):
    """A delivery staff member who can be assigned to deliveries.

    Each delivery person belongs to a specific restaurant (tenant).
    """

    restaurant = models.ForeignKey(
        "core.Restaurant",
        on_delete=models.CASCADE,
        related_name="delivery_persons",
    )

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.restaurant.name})"


class Delivery(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ASSIGNED = "ASSIGNED", "Assigned"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for Delivery"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"

    restaurant = models.ForeignKey(
        "core.Restaurant",
        on_delete=models.CASCADE,
        related_name="deliveries",
    )

    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="delivery",
    )

    customer_name = models.CharField(
        max_length=150,
    )

    customer_phone = models.CharField(
        max_length=20,
    )

    address = models.TextField()

    landmark = models.CharField(
        max_length=255,
        blank=True,
    )

    delivery_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    assigned_person = models.ForeignKey(
        DeliveryPerson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deliveries",
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"Delivery #{self.id}"