from django import forms
from django.contrib.auth.models import User

from .models import EmployeeProfile, QR_TOKEN_VALIDITY_SECONDS


class EmployeeCreateForm(forms.Form):
    """Fast onboarding of a new employee.

    Employees authenticate via QR code, so no permanent password is required.
    """

    first_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )

    last_name = forms.CharField(
        max_length=150,
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )

    username = forms.CharField(
        max_length=150,
        required=True,
        help_text="Unique username for this employee.",
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )

    phone = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )

    role = forms.ChoiceField(
        choices=EmployeeProfile.Role.choices,
        initial=EmployeeProfile.Role.WAITER,
        widget=forms.Select(attrs={"class": "form-control"}),
    )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError(
                "An account with that username already exists."
            )
        return username

    def save(self):
        data = self.cleaned_data

        user = User.objects.create_user(
            username=data["username"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )
        # Employees sign in via QR - no usable password by default.
        user.set_unusable_password()
        user.save()

        return EmployeeProfile.objects.create(
            user=user,
            phone=data["phone"],
            role=data["role"],
        )


class EmployeeQRForm(forms.Form):
    """Actions available on the employee QR page."""

    ACTION_CHOICES = [
        ("generate", "Generate QR"),
        ("regenerate", "Regenerate QR"),
        ("revoke", "Revoke QR"),
    ]

    action = forms.ChoiceField(
        choices=ACTION_CHOICES,
        widget=forms.HiddenInput,
    )


class QRValidityForm(forms.Form):
    """Nothing but a marker - used to render the validity window label."""
    validity_seconds = forms.IntegerField(
        initial=QR_TOKEN_VALIDITY_SECONDS,
        widget=forms.HiddenInput,
    )