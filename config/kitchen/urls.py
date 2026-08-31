from django.urls import path

from . import views


app_name = "kitchen"


urlpatterns = [

    path(
        "",
        views.kitchen_dashboard,
        name="dashboard",
    ),
    

    path(
        "batch/<int:batch_id>/start/",
        views.start_batch_view,
        name="start_batch",
    ),

    path(
        "batch/<int:batch_id>/ready/",
        views.ready_batch_view,
        name="ready_batch",
    ),

]