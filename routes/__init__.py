from .auth import register_auth_routes
from .wallets import register_wallet_routes
from .transactions import register_transaction_routes
from .messages import register_message_routes
from .investments import register_investment_routes
from .admin import register_admin_routes
from .settings import register_settings_routes
from .site import register_site_routes

__all__ = [
    'register_auth_routes',
    'register_wallet_routes',
    'register_transaction_routes',
    'register_message_routes',
    'register_investment_routes',
    'register_admin_routes',
    'register_settings_routes',
    'register_site_routes',
]
