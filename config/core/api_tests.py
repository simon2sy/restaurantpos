from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import EmployeeProfile
from menu.models import Category, Ingredient, MenuItem, RecipeItem
from orders.models import Order, OrderBatch, OrderItem, Table, Cabin
from orders.services import create_order, create_order_batch, complete_payment


def _make_user(username, password="Strong-Passw0rd!", **kwargs):
    user = User.objects.create_user(username=username, password=password, first_name=username.title())
    role = kwargs.pop("role", EmployeeProfile.Role.WAITER)
    EmployeeProfile.objects.create(user=user, role=role, **kwargs)
    return user


def _jwt_login(client, username, password="Strong-Passw0rd!"):
    """Login via JWT and return tokens."""
    resp = client.post("/api/v1/auth/login/", {"username": username, "password": password}, format="json")
    if resp.status_code == 200 and resp.data.get("data"):
        return resp.data["data"]
    return None


def _auth_header(token):
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


# ============================================================
# AUTH TESTS
# ============================================================


class AuthLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = _make_user("alice")

    def test_login_success(self):
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"username": "alice", "password": "Strong-Passw0rd!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.assertIn("access", resp.data["data"])
        self.assertIn("refresh", resp.data["data"])
        self.assertEqual(resp.data["data"]["user"]["username"], "alice")
        self.assertEqual(resp.data["data"]["user"]["role"], "WAITER")

    def test_login_wrong_password(self):
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"username": "alice", "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_login_missing_fields(self):
        resp = self.client.post("/api/v1/auth/login/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"username": "alice", "password": "Strong-Passw0rd!"},
            format="json",
        )
        # Django authenticate returns None for inactive users -> 401
        self.assertIn(resp.status_code, [401, 403])

    def test_login_disabled_employee(self):
        self.user.employee_profile.is_active = False
        self.user.employee_profile.save()
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"username": "alice", "password": "Strong-Passw0rd!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_me_endpoint(self):
        data = _jwt_login(self.client, "alice")
        self.assertIsNotNone(data)
        resp = self.client.get("/api/v1/auth/me/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["data"]["username"], "alice")
        self.assertEqual(resp.data["data"]["role"], "WAITER")

    def test_me_requires_auth(self):
        resp = self.client.get("/api/v1/auth/me/")
        self.assertEqual(resp.status_code, 401)

    def test_customer_registration(self):
        resp = self.client.post(
            "/api/v1/auth/register/",
            {
                "full_name": "Test Customer",
                "username": "cust123",
                "password": "Strong-Passw0rd!",
                "password2": "Strong-Passw0rd!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["success"])
        self.assertEqual(resp.data["data"]["user"]["role"], None)
        self.assertFalse(resp.data["data"]["user"]["is_employee"])

    def test_password_change(self):
        data = _jwt_login(self.client, "alice")
        resp = self.client.post(
            "/api/v1/auth/password/change/",
            {"old_password": "Strong-Passw0rd!", "new_password": "NewStrong123!"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])

    def test_logout(self):
        data = _jwt_login(self.client, "alice")
        resp = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh": data["refresh"]},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)


# ============================================================
# EMPLOYEE MANAGEMENT TESTS
# ============================================================


class EmployeeAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.manager = _make_user("manager1", role=EmployeeProfile.Role.MANAGER)
        self.waiter = _make_user("waiter1", role=EmployeeProfile.Role.WAITER)

    def test_admin_can_list_employees(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.get("/api/v1/accounts/employees/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)

    def test_waiter_cannot_list_employees(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get("/api/v1/accounts/employees/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_create_employee(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            "/api/v1/accounts/employees/",
            {
                "first_name": "New",
                "last_name": "Staff",
                "username": "newstaff2",
                "phone": "0300-1234567",
                "role": "KITCHEN",
            },
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["success"])

    def test_waiter_cannot_create_employee(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.post(
            "/api/v1/accounts/employees/",
            {"first_name": "X", "username": "xstaff", "role": "KITCHEN"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_toggle_employee(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            f"/api/v1/accounts/employees/{self.waiter.employee_profile.id}/toggle/",
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        self.waiter.employee_profile.refresh_from_db()
        self.assertFalse(self.waiter.employee_profile.is_active)

    def test_duplicate_username_rejected(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            "/api/v1/accounts/employees/",
            {"first_name": "Dup", "username": "waiter1", "role": "WAITER"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 400)

    def test_manager_can_list_employees(self):
        data = _jwt_login(self.client, "manager1")
        resp = self.client.get("/api/v1/accounts/employees/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)


# ============================================================
# MENU API TESTS
# ============================================================


class MenuAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.waiter = _make_user("waiter1", role=EmployeeProfile.Role.WAITER)
        self.category = Category.objects.create(name="Mains")
        self.item = MenuItem.objects.create(
            category=self.category, name="Burger", price=500, is_available=True
        )

    def test_staff_can_list_menu(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get("/api/v1/menu/items/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)

    def test_admin_can_create_category(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            "/api/v1/menu/categories/",
            {"name": "Drinks", "description": "Cold drinks"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)

    def test_menu_items_filter_by_category(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get(
            f"/api/v1/menu/items/?category={self.category.id}",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)

    def test_ingredient_stock_adjust(self):
        ingredient = Ingredient.objects.create(name="Flour", unit="kg", current_stock=10)
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            "/api/v1/menu/stock/adjust/",
            {"ingredient_id": ingredient.id, "quantity": "5", "movement_type": "STOCK_IN", "note": "Restock"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        ingredient.refresh_from_db()
        self.assertEqual(ingredient.current_stock, 15)


# ============================================================
# ORDER API TESTS
# ============================================================


class OrderAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.waiter = _make_user("waiter1", role=EmployeeProfile.Role.WAITER)
        self.kitchen = _make_user("kitchen1", role=EmployeeProfile.Role.KITCHEN)
        self.table = Table.objects.create(number=1, status=Table.Status.AVAILABLE)
        self.category = Category.objects.create(name="Mains")
        self.item = MenuItem.objects.create(
            category=self.category, name="Burger", price=500, is_available=True
        )

    def test_seating_dashboard(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get("/api/v1/orders/seating/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("tables", resp.data["data"])

    def test_create_order(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.post(
            "/api/v1/orders/",
            {"order_type": "DINE_IN", "table_id": self.table.id},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["success"])

    def test_add_items_to_order(self):
        data = _jwt_login(self.client, "waiter1")
        # Create order
        order_resp = self.client.post(
            "/api/v1/orders/",
            {"order_type": "DINE_IN", "table_id": self.table.id},
            format="json",
            **_auth_header(data["access"]),
        )
        order_id = order_resp.data["data"]["id"]

        # Add items
        resp = self.client.post(
            f"/api/v1/orders/{order_id}/add-items/",
            {"items": [{"menu_item_id": self.item.id, "quantity": 2, "notes": "extra cheese"}]},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)

    def test_kitchen_cannot_create_order(self):
        data = _jwt_login(self.client, "kitchen1")
        resp = self.client.post(
            "/api/v1/orders/",
            {"order_type": "DINE_IN", "table_id": self.table.id},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 403)

    def test_payment(self):
        data = _jwt_login(self.client, "waiter1")
        # Create order with items
        order = create_order(user=self.waiter, table=self.table)
        create_order_batch(order=order, items=[{"menu_item": self.item, "quantity": 1, "notes": ""}])

        resp = self.client.post(
            f"/api/v1/orders/{order.id}/payment/",
            {"payment_method": "CASH"},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.table.refresh_from_db()
        self.assertEqual(self.table.status, Table.Status.AVAILABLE)

    def test_cancel_order(self):
        data = _jwt_login(self.client, "waiter1")
        order = create_order(user=self.waiter, table=self.table)
        create_order_batch(order=order, items=[{"menu_item": self.item, "quantity": 1, "notes": ""}])

        resp = self.client.delete(
            f"/api/v1/orders/{order.id}/",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)

    def test_unauthenticated_cannot_access_orders(self):
        resp = self.client.get("/api/v1/orders/")
        self.assertEqual(resp.status_code, 401)


# ============================================================
# KITCHEN API TESTS
# ============================================================


class KitchenAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.kitchen = _make_user("kitchen1", role=EmployeeProfile.Role.KITCHEN)
        self.waiter = _make_user("waiter1", role=EmployeeProfile.Role.WAITER)
        self.table = Table.objects.create(number=1)
        self.category = Category.objects.create(name="Mains")
        self.item = MenuItem.objects.create(category=self.category, name="Tea", price=50, is_available=True)

    def test_kitchen_dashboard(self):
        data = _jwt_login(self.client, "kitchen1")
        resp = self.client.get("/api/v1/kitchen/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)

    def test_waiter_cannot_access_kitchen(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get("/api/v1/kitchen/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 403)

    def test_start_and_ready_batch(self):
        order = create_order(user=self.waiter, table=self.table)
        batch = create_order_batch(order=order, items=[{"menu_item": self.item, "quantity": 1, "notes": ""}])

        data = _jwt_login(self.client, "kitchen1")
        # Start batch
        resp = self.client.post(
            f"/api/v1/kitchen/batch/{batch.id}/start/",
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        batch.refresh_from_db()
        self.assertEqual(batch.status, OrderBatch.Status.PREPARING)

        # Mark ready
        resp = self.client.post(
            f"/api/v1/kitchen/batch/{batch.id}/ready/",
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 200)
        batch.refresh_from_db()
        self.assertEqual(batch.status, OrderBatch.Status.READY)


# ============================================================
# REPORTS API TESTS
# ============================================================


class ReportsAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.waiter = _make_user("waiter1", role=EmployeeProfile.Role.WAITER)

    def test_admin_can_access_reports(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.get("/api/v1/reports/sales/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("summary", resp.data["data"])

    def test_waiter_cannot_access_reports(self):
        data = _jwt_login(self.client, "waiter1")
        resp = self.client.get("/api/v1/reports/sales/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 403)

    def test_dashboard_stats(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.get("/api/v1/reports/dashboard/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("orders_today", resp.data["data"])

    def test_reports_with_date_filter(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.get("/api/v1/reports/sales/?period=today", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)


# ============================================================
# DELIVERY API TESTS
# ============================================================


class DeliveryAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin = User.objects.create_superuser("admin", password="Strong-Passw0rd!")
        self.delivery_person_user = _make_user("deliver1", role=EmployeeProfile.Role.DELIVERY)
        self.category = Category.objects.create(name="Mains")
        self.item = MenuItem.objects.create(category=self.category, name="Burger", price=500, is_available=True)

    def test_create_delivery_order(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.post(
            "/api/v1/delivery/",
            {
                "customer_name": "Ali",
                "customer_phone": "0300-1234567",
                "address": "House 5",
                "landmark": "",
                "delivery_fee": 100,
                "items": [{"menu_item_id": self.item.id, "quantity": 2}],
            },
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)

    def test_delivery_list(self):
        data = _jwt_login(self.client, "admin")
        resp = self.client.get("/api/v1/delivery/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)

    def test_delivery_person_crud(self):
        data = _jwt_login(self.client, "admin")
        # Create
        resp = self.client.post(
            "/api/v1/delivery/persons/",
            {"name": "Rider 1", "phone": "0300-1111111", "is_active": True},
            format="json",
            **_auth_header(data["access"]),
        )
        self.assertEqual(resp.status_code, 201)
        person_id = resp.data["id"]

        # List
        resp = self.client.get("/api/v1/delivery/persons/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)

        # Detail
        resp = self.client.get(f"/api/v1/delivery/persons/{person_id}/", **_auth_header(data["access"]))
        self.assertEqual(resp.status_code, 200)
