import django.db.models.deletion
from django.db import migrations, models


def assign_default_restaurant(apps, schema_editor):
    """Assign existing deliveries and delivery persons to the default restaurant."""
    Restaurant = apps.get_model("core", "Restaurant")
    Delivery = apps.get_model("delivery", "Delivery")
    DeliveryPerson = apps.get_model("delivery", "DeliveryPerson")

    default_restaurant = Restaurant.objects.filter(is_default=True).first()
    if default_restaurant is None:
        default_restaurant = Restaurant.objects.first()
    if default_restaurant is None:
        # No restaurant exists yet — nothing to assign
        return

    Delivery.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    DeliveryPerson.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_add_restaurant_public_id"),
        ("delivery", "0002_deliveryperson_delivery_assigned_person"),
    ]

    operations = [
        # Step 1: Add restaurant FK as nullable
        migrations.AddField(
            model_name="deliveryperson",
            name="restaurant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="delivery_persons",
                to="core.restaurant",
            ),
        ),
        migrations.AddField(
            model_name="delivery",
            name="restaurant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="deliveries",
                to="core.restaurant",
            ),
        ),
        # Step 2: Assign existing records to the default restaurant
        migrations.RunPython(
            assign_default_restaurant,
            reverse_code=migrations.RunPython.noop,
        ),
        # Step 3: Make the field non-nullable
        migrations.AlterField(
            model_name="deliveryperson",
            name="restaurant",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="delivery_persons",
                to="core.restaurant",
            ),
        ),
        migrations.AlterField(
            model_name="delivery",
            name="restaurant",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="deliveries",
                to="core.restaurant",
            ),
        ),
    ]

