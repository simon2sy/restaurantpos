from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Cash"
    COD = "COD", "Cash on Delivery"


class Table(TimeStampedModel):

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        OCCUPIED = "OCCUPIED", "Occupied"
        RESERVED = "RESERVED", "Reserved"

    number = models.PositiveIntegerField(unique=True)

    capacity = models.PositiveIntegerField(default=4)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Table {self.number}"


class Cabin(TimeStampedModel):

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        OCCUPIED = "OCCUPIED", "Occupied"
        RESERVED = "RESERVED", "Reserved"

    number = models.PositiveIntegerField(unique=True)

    capacity = models.PositiveIntegerField(default=6)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Cabin {self.number}"


class Order(TimeStampedModel):
   
        
    
    class OrderType(models.TextChoices):
        DINE_IN = "DINE_IN", "Dine In"
        DELIVERY = "DELIVERY", "Delivery"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        PREPARING = "PREPARING", "Preparing"
        READY = "READY", "Ready"
        SERVED = "SERVED", "Served"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PAID = "PAID", "Paid"

    order_number = models.PositiveIntegerField(
        unique=True,
        editable=False,
    )

    order_type = models.CharField(
        max_length=20,
        choices=OrderType.choices,
        default=OrderType.DINE_IN,
    )

    table = models.ForeignKey(
        Table,
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )

    cabin = models.ForeignKey(
        Cabin,
        on_delete=models.PROTECT,
        related_name="orders",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_orders",
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    discount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    delivery_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        null=True,
        blank=True,
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    
    def __str__(self):
        return f"Order #{self.order_number}"

    class Meta:
        indexes = [
            models.Index(fields=["order_type", "status"]),
            models.Index(fields=["status"]),
            models.Index(fields=["payment_status"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            last_order = (
                Order.objects
                .order_by("-order_number")
                .first()
            )

            self.order_number = (
                last_order.order_number + 1
                if last_order
                else 1001
            )

        super().save(*args, **kwargs)


class OrderBatch(TimeStampedModel):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PREPARING = "PREPARING", "Preparing"
        READY = "READY", "Ready"
        COMPLETED = "COMPLETED", "Completed"

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="batches",
    )

    batch_number = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    sent_to_kitchen_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    ready_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "batch_number"],
                name="unique_order_batch",
            )
        ]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return (
            f"Order #{self.order.order_number} "
            f"Batch #{self.batch_number}"
        )


class OrderItem(TimeStampedModel):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PREPARING = "PREPARING", "Preparing"
        READY = "READY", "Ready"
        SERVED = "SERVED", "Served"
        CANCELLED = "CANCELLED", "Cancelled"

    batch = models.ForeignKey(
        OrderBatch,
        on_delete=models.CASCADE,
        related_name="items",
    )

    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.PROTECT,
        related_name="order_items",
    )

    quantity = models.PositiveIntegerField()

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    notes = models.TextField(
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1),
                name="orderitem_quantity_positive",
            )
        ]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return (
            f"{self.menu_item.name} × {self.quantity}"
        )