"""
Security middleware for the Restaurant POS application.

Provides additional security features:
- Content Security Policy headers
- Session timeout on inactivity
- Concurrent session control
- Security headers enhancement
"""

import time
from django.conf import settings
from django.contrib.auth import logout
from django.contrib.sessions.models import Session
from django.http import HttpResponseForbidden
from django.utils.deprecation import MiddlewareMixin


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Add additional security headers to all responses."""

    def process_response(self, request, response):
        # Content Security Policy (basic - customize as needed)
        if not hasattr(response, '_csp_set'):
            csp_directives = {
                'default-src': "'self'",
                'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
                'style-src': "'self' 'unsafe-inline'",
                'img-src': "'self' data: https:",
                'font-src': "'self'",
                'connect-src': "'self'",
                'frame-ancestors': "'none'",
                'form-action': "'self'",
                'base-uri': "'self'",
            }
            csp_value = '; '.join(f"{k} {v}" for k, v in csp_directives.items())
            response['Content-Security-Policy'] = csp_value

        # Additional security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'

        # Cache control for sensitive pages
        if request.user.is_authenticated:
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        return response


class SessionTimeoutMiddleware(MiddlewareMixin):
    """Expire sessions after a period of inactivity."""

    def process_request(self, request):
        if not request.user.is_authenticated:
            return

        # Get the last activity timestamp from session
        last_activity = request.session.get('last_activity')
        current_time = time.time()

        # Session timeout: 30 minutes of inactivity
        session_timeout = getattr(settings, 'SESSION_INACTIVITY_TIMEOUT', 1800)

        if last_activity and (current_time - last_activity) > session_timeout:
            # Session has expired due to inactivity
            logout(request)
            from django.contrib import messages
            messages.warning(request, 'Your session has expired due to inactivity. Please sign in again.')
            from django.shortcuts import redirect
            return redirect(settings.LOGIN_URL)

        # Update the last activity timestamp
        request.session['last_activity'] = current_time
        request.session.modified = True


class ConcurrentSessionMiddleware(MiddlewareMixin):
    """Limit concurrent sessions per user."""

    def process_request(self, request):
        if not request.user.is_authenticated:
            return

        # Only check if setting is enabled
        if not getattr(settings, 'CONCURRENT_SESSION_LIMIT_ENABLED', False):
            return

        max_sessions = getattr(settings, 'CONCURRENT_SESSION_LIMIT', 3)
        session_key = request.session.session_key

        # Get all active sessions for this user
        from django.contrib.auth.models import User
        user_sessions = Session.objects.filter(
            expire_date__gte=timezone.now()
        ).order_by('-last_activity')

        # Count sessions for this user (simplified - in production, store user_id in session data)
        user_session_count = 0
        current_session_found = False

        for session in user_sessions:
            session_data = session.get_decoded()
            if session_data.get('_auth_user_id') == str(request.user.id):
                user_session_count += 1
                if session.session_key == session_key:
                    current_session_found = True

        # If over limit and this isn't the newest session, logout
        if user_session_count > max_sessions and not current_session_found:
            logout(request)
            from django.contrib import messages
            messages.warning(request, 'You have been logged out because you logged in from another device.')
            from django.shortcuts import redirect
            return redirect(settings.LOGIN_URL)


class PasswordChangeRequiredMiddleware(MiddlewareMixin):
    """Force password change after a certain period (optional)."""

    def process_request(self, request):
        if not request.user.is_authenticated:
            return

        # Check if password change is required
        if getattr(settings, 'PASSWORD_EXPIRY_DAYS', None):
            last_password_change = request.user.last_login
            if last_password_change:
                from django.utils import timezone
                from datetime import timedelta
                expiry_date = timezone.now() - timedelta(days=settings.PASSWORD_EXPIRY_DAYS)
                if last_password_change < expiry_date:
                    # Password has expired
                    if request.path != '/accounts/password/change/' and request.path != '/accounts/logout/':
                        from django.contrib import messages
                        from django.shortcuts import redirect
                        messages.warning(request, 'Your password has expired. Please change it to continue.')
                        return redirect('accounts:password_change')


class LoginAttemptTrackerMiddleware(MiddlewareMixin):
    """Track login attempts and provide additional security."""

    def process_request(self, request):
        # This middleware can be used to add additional tracking
        # For now, it's a placeholder for future enhancements
        pass
