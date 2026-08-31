from django.db import models

from core.models import TimeStampedModel
from django.conf import settings


class Expense(TimeStampedModel):
    """A business expense record (supplies, rent, salaries, utilities...)."""

    class Category(models.TextChoices):
        SUPPLIES = "SUPPLIES", "Supplies"
        RENT = "RENT", "Rent"
        SALARIES = "SALARIES", "Salaries"
        UTILITIES = "UTILITIES", "Utilities"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        MARKETING = "MARKETING", "Marketing"
        OTHER = "OTHER", "Other"

    title = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    note = models.CharField(max_length=255, blank=True)
    spent_on = models.DateField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses_recorded",
    )

    class Meta:
        ordering = ["-spent_on", "-created_at"]

    def __str__(self):
        return f"{self.title} — {self.amount}"
