"""
WSGI entry point for Passenger-based hosts (DirectAdmin / cPanel "Setup Python App").

Application root:  the `config/` folder (the one containing manage.py)
Application startup file:  passenger_wsgi.py
Application entry point:  application
"""

from config.wsgi import application  # noqa: F401
