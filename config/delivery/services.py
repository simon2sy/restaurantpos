"""Delivery business logic."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from orders.models import Order
from orders.services import (
    complete_payment,
    transition_order_status,
)

from .models import Delivery

# Valid delivery status transitions.
VALID_DELIVERY_TRANSITIONS = {
    Delivery.Status.PENDING: [
        Delivery.Status.ASSIGNED,
        Delivery.Status.CANCELLED,
    ],
    Delivery.Status.ASSIGNED: [
        Delivery.Status.OUT_FOR_DELIVERY,
        Delivery.Status.CANCELLED,
    ],
    Delivery.Status.OUT_FOR_DELIVERY: [
        Delivery.Status.DELIVERED,
        Delivery.Status.CANCELLED,
    ],
    Delivery.Status.DELIVERED: [],
    Delivery.Status.CANCELLED: [],
}


def can_transition(current, new):
    return new in VALID_DELIVERY_TRANSITIONS.get(current, [])


@transaction.atomic
def assign_delivery(delivery, person):
    if delivery.status not in (
        Delivery.Status.PENDING,
        Delivery.Status.ASSIGNED,
    ):
        raise ValueError(
            "Only pending or assigned deliveries can be (re)assigned."
        )
    if not person.is_active:
        raise ValueError("Cannot assign an inactive delivery person.")

    delivery.assigned_person = person
    delivery.status = Delivery.Status.ASSIGNED
    delivery.save(update_fields=["assigned_person", "status"])

    transition_order_status(delivery.order, Order.Status.READY)

    return delivery


def change_delivery_status(delivery, new_status):
    """Advance a delivery along its allowed status path."""
    if delivery.status == Delivery.Status.CANCELLED:
        raise ValueError("Cancelled deliveries are terminal.")
    if delivery.status == Delivery.Status.DELIVERED:
        raise ValueError("Delivered deliveries are terminal.")

    if not can_transition(delivery.status, new_status):
        raise ValueError(
            f"Invalid delivery transition from "
            f"{delivery.status} to {new_status}."
        )

    if new_status == Delivery.Status.DELIVERED:
        delivery.delivered_at = timezone.now()

    delivery.status = new_status
    delivery.save(update_fields=["status", "delivered_at"])

    return delivery


@transaction.atomic
def confirm_delivery(delivery):
    """Mark a delivery as DELIVERED and record COD payment."""
    if delivery.status != Delivery.Status.OUT_FOR_DELIVERY:
        raise ValueError(
            "Only out-for-delivery orders can be marked delivered."
        )

    order = delivery.order
    if order.payment_status == Order.PaymentStatus.PAID:
        raise ValueError("This order has already been paid.")

    delivery.delivered_at = timezone.now()
    delivery.status = Delivery.Status.DELIVERED
    delivery.save(update_fields=["delivered_at", "status"])

    # COD payment completes automatically on delivery.
    complete_payment(
        order=order,
        payment_method=Order.PaymentMethod.COD,
    )

    return delivery


def get_due_deliveries():
    """Deliveries that are not yet delivered or cancelled."""
    return Delivery.objects.select_related(
        "order", "assigned_person"
    ).filter(
        status__in=[
            Delivery.Status.PENDING,
            Delivery.Status.ASSIGNED,
            Delivery.Status.OUT_FOR_DELIVERY,
        ]
    ).order_by("-created_at")