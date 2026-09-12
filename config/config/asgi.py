import os

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from core.websocket_auth import JwtAuthMiddlewareStack
from kitchen.routing import websocket_urlpatterns


application = ProtocolTypeRouter({

    "http": django_asgi_app,

    "websocket": JwtAuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),

})