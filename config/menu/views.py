from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from delivery.views import is_customer
from .models import Category


@login_required
def menu_list(request):

    categories = (
        Category.objects
        .filter(
            is_active=True,
            items__is_available=True,
        )
        .prefetch_related("items")
        .distinct()
    )

    return render(
        request,
        "menu/menu_list.html",
        {
            "categories": categories,
            "is_customer": is_customer(request.user),
        },
    )