# Transform RestaurantSettings to use restaurant FK as primary key

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_multi_restaurant_support'),
    ]

    operations = [
        # Transform RestaurantSettings: remove _singleton, remove id, add restaurant as PK
        migrations.RemoveField(
            model_name='restaurantsettings',
            name='_singleton',
        ),
        migrations.RemoveField(
            model_name='restaurantsettings',
            name='id',
        ),
        migrations.AddField(
            model_name='restaurantsettings',
            name='restaurant',
            field=models.OneToOneField(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                primary_key=True,
                related_name='settings',
                serialize=False,
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='restaurantsettings',
            name='logo',
            field=models.ImageField(blank=True, null=True, upload_to='restaurants/logos/'),
        ),
    ]
