from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("title", "amount", "category", "spent_on", "recorded_by")
    list_filter = ("category", "spent_on")
    search_fields = ("title", "note")
    date_hierarchy = "spent_on"
