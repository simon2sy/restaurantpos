from django.urls import path

from . import views

app_name = "reports_api"

urlpatterns = [
    path("sales/", views.SalesReportView.as_view(), name="sales_report"),
    path("dashboard/", views.DashboardStatsView.as_view(), name="dashboard_stats"),
    path("expenses/", views.ExpenseListCreateView.as_view(), name="expense_list"),
    path("expenses/summary/", views.ExpenseSummaryView.as_view(), name="expense_summary"),
]
