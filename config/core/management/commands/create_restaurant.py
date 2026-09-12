"""create_restaurant — Create a new restaurant with an admin user.

Usage:
    python manage.py create_restaurant --name "My Restaurant" --slug "my-restaurant" \\
        --username "admin" --password "SecurePass123" --first-name "John" --last-name "Doe"

Or interactively:
    python manage.py create_restaurant
"""

import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from accounts.models import EmployeeProfile
from core.models import Restaurant


class Command(BaseCommand):
    help = "Create a new restaurant with an admin user."

    def add_arguments(self, parser):
        parser.add_argument('--name', type=str, help='Restaurant name')
        parser.add_argument('--slug', type=str, help='Restaurant identifier (for login)')
        parser.add_argument('--username', type=str, help='Admin username')
        parser.add_argument('--password', type=str, help='Admin password')
        parser.add_argument('--first-name', type=str, help='Admin first name')
        parser.add_argument('--last-name', type=str, help='Admin last name (optional)')
        parser.add_argument('--email', type=str, help='Admin email (optional)')
        parser.add_argument('--phone', type=str, help='Restaurant phone (optional)')
        parser.add_argument('--address', type=str, help='Restaurant address (optional)')
        parser.add_argument('--plan', type=str, default='free',
                            choices=['free', 'basic', 'pro', 'enterprise'],
                            help='Subscription plan (default: free)')
        parser.add_argument('--max-employees', type=int, default=10,
                            help='Max employees allowed (default: 10)')

    def handle(self, *args, **options):
        # Get values from args or prompt interactively
        name = options['name'] or input('Restaurant name: ').strip()
        slug = options['slug'] or input('Restaurant identifier (slug): ').strip().lower()
        username = options['username'] or input('Admin username: ').strip()
        password = options['password'] or input('Admin password (min 8 chars): ').strip()
        first_name = options['first_name'] or input('Admin first name: ').strip()
        last_name = options['last_name'] or input('Admin last name (optional): ').strip()
        email = options['email'] or input('Admin email (optional): ').strip()
        phone = options['phone'] or input('Restaurant phone (optional): ').strip()
        address = options['address'] or input('Restaurant address (optional): ').strip()
        plan = options['plan']
        max_employees = options['max_employees']

        # Validate
        if not name:
            raise CommandError('Restaurant name is required.')
        if not slug:
            raise CommandError('Restaurant identifier is required.')
        if not username:
            raise CommandError('Admin username is required.')
        if not password or len(password) < 8:
            raise CommandError('Password must be at least 8 characters.')
        if not first_name:
            raise CommandError('Admin first name is required.')

        # Check uniqueness
        if Restaurant.objects.filter(slug=slug).exists():
            raise CommandError(f'A restaurant with identifier "{slug}" already exists.')
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f'Username "{username}" is already taken.')

        # Create restaurant
        restaurant = Restaurant.objects.create(
            name=name,
            slug=slug,
            phone=phone or '',
            address=address or '',
            contact_email=email or '',
            subscription_plan=plan,
            max_employees=max_employees,
        )

        # Create admin user
        admin_user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email=email or '',
        )

        # Create employee profile with MANAGER role
        EmployeeProfile.objects.create(
            user=admin_user,
            restaurant=restaurant,
            role=EmployeeProfile.Role.MANAGER,
        )

        self.stdout.write(self.style.SUCCESS(
            f'\nRestaurant "{name}" created successfully!'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Identifier: {slug}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Admin user: {username}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Login URL: http://192.168.100.38:8000/accounts/login/'
        ))
        self.stdout.write(self.style.NOTICE(
            f'\n  Mobile app login:'
        ))
        self.stdout.write(self.style.NOTICE(
            f'    Restaurant ID: {slug}'
        ))
        self.stdout.write(self.style.NOTICE(
            f'    Username: {username}'
        ))
        self.stdout.write(self.style.NOTICE(
            f'    Password: {password}'
        ))
