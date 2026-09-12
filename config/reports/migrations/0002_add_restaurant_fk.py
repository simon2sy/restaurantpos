import django.db.models.deletion
from django.db import migrations, models


def assign_default_restaurant(apps, schema_editor):
    """Assign existing expenses to the default restaurant."""
    Restaurant = apps.get_model("core", "Restaurant")
    Expense = apps.get_model("reports", "Expense")

    default_restaurant = Restaurant.objects.filter(is_default=True).first()
    if default_restaurant is None:
        default_restaurant = Restaurant.objects.first()
    if default_restaurant is None:
        return

    Expense.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_add_restaurant_public_id"),
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="expense",
            name="restaurant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="expenses",
                to="core.restaurant",
            ),
        ),
        migrations.RunPython(
            assign_default_restaurant,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="expense",
            name="restaurant",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="expenses",
                to="core.restaurant",
            ),
        ),
    ]

