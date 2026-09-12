import uuid

from django.db import migrations, models


def populate_public_id(apps, schema_editor):
    """Generate unique public_id values for existing restaurants."""
    Restaurant = apps.get_model("core", "Restaurant")
    for restaurant in Restaurant.objects.all():
        restaurant.public_id = uuid.uuid4()
        restaurant.save(update_fields=["public_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_add_restaurant_code"),
    ]

    operations = [
        # Step 1: Add the field as nullable, without unique constraint
        migrations.AddField(
            model_name="restaurant",
            name="public_id",
            field=models.UUIDField(
                blank=True,
                null=True,
                editable=False,
                db_index=True,
            ),
        ),
        # Step 2: Populate existing rows with unique UUIDs
        migrations.RunPython(
            populate_public_id,
            reverse_code=migrations.RunPython.noop,
        ),
        # Step 3: Make the field non-nullable and unique
        migrations.AlterField(
            model_name="restaurant",
            name="public_id",
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                unique=True,
                db_index=True,
                help_text="Public-facing unique identifier used in URLs and APIs.",
            ),
        ),
    ]
