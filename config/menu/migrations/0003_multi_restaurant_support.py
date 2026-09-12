# Multi-restaurant support: add restaurant FK and field alterations

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_multi_restaurant_support'),
        ('menu', '0002_ingredient_stockmovement_recipeitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='categories',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name='category',
            unique_together={('restaurant', 'name')},
        ),
        migrations.AlterField(
            model_name='category',
            name='name',
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name='menuitem',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='menu_items',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='ingredient',
            name='restaurant',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='ingredients',
                to='core.restaurant',
            ),
            preserve_default=False,
        ),
        migrations.AlterUniqueTogether(
            name='ingredient',
            unique_together={('restaurant', 'name')},
        ),
        migrations.AlterField(
            model_name='ingredient',
            name='name',
            field=models.CharField(max_length=150),
        ),
    ]
