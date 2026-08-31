from django.db.models.signals import post_save
from django.dispatch import receiver

from core.realtime import broadcast_dashboard_update


@receiver(post_save, sender="reports.Expense")
def broadcast_expense_change(sender, instance, **kwargs):
    broadcast_dashboard_update(reason="expense")