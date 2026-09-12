from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_add_restaurant_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="code",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=20,
                unique=True,
                help_text="Short internal code for the restaurant (e.g., 'R001').",
            ),
        ),
    ]
