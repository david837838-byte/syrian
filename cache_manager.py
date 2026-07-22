"""
نظام التخزين المؤقت (Caching) مع Redis
"""

from flask_caching import Cache
from logger_config import get_logger
import json
from functools import wraps
from datetime import timedelta

logger = get_logger()

cache = Cache()


def init_cache(app):
    """تهيئة نظام التخزين المؤقت"""
    cache.init_app(app)


class CacheManager:
    """مدير التخزين المؤقت"""
    
    # مفاتيح التخزين المؤقت
    CACHE_KEYS = {
        'user_profile': 'user:{user_id}:profile',
        'user_wallets': 'user:{user_id}:wallets',
        'user_balance': 'user:{user_id}:balance:currency_{currency_id}',
        'investments': 'investments:active',
        'currencies': 'currencies:active',
        'networks': 'networks:all',
        'admin_wallets': 'admin:wallets',
        'settings': 'system:settings',
        'dashboard': 'admin:{user_id}:dashboard'
    }
    
    @staticmethod
    def get_cache_key(key_template, **kwargs):
        """الحصول على مفتاح التخزين المؤقت"""
        return key_template.format(**kwargs)
    
    @staticmethod
    def set_user_profile(user_id, data, timeout=3600):
        """تخزين ملف المستخدم الشخصي"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_profile'],
            user_id=user_id
        )
        cache.set(key, data, timeout=timeout)
        logger.debug(f"Cached user profile: {user_id}")
    
    @staticmethod
    def get_user_profile(user_id):
        """الحصول على ملف المستخدم الشخصي من التخزين"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_profile'],
            user_id=user_id
        )
        return cache.get(key)
    
    @staticmethod
    def invalidate_user_profile(user_id):
        """حذف ملف المستخدم من التخزين المؤقت"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_profile'],
            user_id=user_id
        )
        cache.delete(key)
        logger.debug(f"Invalidated user profile: {user_id}")
    
    @staticmethod
    def set_user_wallets(user_id, data, timeout=1800):
        """تخزين محافظ المستخدم"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_wallets'],
            user_id=user_id
        )
        cache.set(key, data, timeout=timeout)
        logger.debug(f"Cached user wallets: {user_id}")
    
    @staticmethod
    def get_user_wallets(user_id):
        """الحصول على محافظ المستخدم"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_wallets'],
            user_id=user_id
        )
        return cache.get(key)
    
    @staticmethod
    def invalidate_user_wallets(user_id):
        """حذف محافظ المستخدم من التخزين المؤقت"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_wallets'],
            user_id=user_id
        )
        cache.delete(key)
        logger.debug(f"Invalidated user wallets: {user_id}")
    
    @staticmethod
    def set_user_balance(user_id, currency_id, balance, timeout=900):
        """تخزين رصيد المستخدم"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_balance'],
            user_id=user_id,
            currency_id=currency_id
        )
        cache.set(key, balance, timeout=timeout)
    
    @staticmethod
    def get_user_balance(user_id, currency_id):
        """الحصول على رصيد المستخدم"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['user_balance'],
            user_id=user_id,
            currency_id=currency_id
        )
        return cache.get(key)
    
    @staticmethod
    def set_investments(data, timeout=3600):
        """تخزين الاستثمارات النشطة"""
        key = CacheManager.CACHE_KEYS['investments']
        cache.set(key, data, timeout=timeout)
        logger.debug("Cached active investments")
    
    @staticmethod
    def get_investments():
        """الحصول على الاستثمارات النشطة"""
        key = CacheManager.CACHE_KEYS['investments']
        return cache.get(key)
    
    @staticmethod
    def invalidate_investments():
        """حذف الاستثمارات من التخزين المؤقت"""
        key = CacheManager.CACHE_KEYS['investments']
        cache.delete(key)
        logger.debug("Invalidated investments cache")
    
    @staticmethod
    def set_currencies(data, timeout=86400):
        """تخزين العملات"""
        key = CacheManager.CACHE_KEYS['currencies']
        cache.set(key, data, timeout=timeout)
        logger.debug("Cached currencies")
    
    @staticmethod
    def get_currencies():
        """الحصول على العملات"""
        key = CacheManager.CACHE_KEYS['currencies']
        return cache.get(key)
    
    @staticmethod
    def set_settings(data, timeout=3600):
        """تخزين إعدادات النظام"""
        key = CacheManager.CACHE_KEYS['settings']
        cache.set(key, data, timeout=timeout)
        logger.debug("Cached system settings")
    
    @staticmethod
    def get_settings():
        """الحصول على إعدادات النظام"""
        key = CacheManager.CACHE_KEYS['settings']
        return cache.get(key)
    
    @staticmethod
    def invalidate_settings():
        """حذف الإعدادات من التخزين المؤقت"""
        key = CacheManager.CACHE_KEYS['settings']
        cache.delete(key)
        logger.debug("Invalidated settings cache")
    
    @staticmethod
    def set_admin_dashboard(user_id, data, timeout=300):
        """تخزين لوحة تحكم الأدمن"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['dashboard'],
            user_id=user_id
        )
        cache.set(key, data, timeout=timeout)
    
    @staticmethod
    def get_admin_dashboard(user_id):
        """الحصول على لوحة تحكم الأدمن"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['dashboard'],
            user_id=user_id
        )
        return cache.get(key)
    
    @staticmethod
    def invalidate_admin_dashboard(user_id):
        """حذف لوحة تحكم الأدمن"""
        key = CacheManager.get_cache_key(
            CacheManager.CACHE_KEYS['dashboard'],
            user_id=user_id
        )
        cache.delete(key)
    
    @staticmethod
    def clear_all():
        """مسح جميع التخزين المؤقت"""
        cache.clear()
        logger.info("Cleared all cache")


def cached_endpoint(timeout=300):
    """decorator لتخزين استجابة endpoint مؤقتاً"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # إنشاء مفتاح فريد بناءً على الدالة والمعاملات
            from flask import request
            from flask_jwt_extended import get_jwt_identity
            
            try:
                user_id = get_jwt_identity()
            except:
                user_id = 'anonymous'
            
            cache_key = f"{f.__name__}:{user_id}:{request.path}:{request.query_string.decode()}"
            
            # التحقق من التخزين المؤقت
            cached_response = cache.get(cache_key)
            if cached_response:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_response
            
            # استدعاء الدالة الأصلية
            response = f(*args, **kwargs)
            
            # تخزين الاستجابة
            cache.set(cache_key, response, timeout=timeout)
            logger.debug(f"Cache set for {cache_key}")
            
            return response
        
        return decorated_function
    return decorator


def invalidate_user_cache(user_id):
    """حذف جميع بيانات التخزين المؤقت للمستخدم"""
    CacheManager.invalidate_user_profile(user_id)
    CacheManager.invalidate_user_wallets(user_id)
    logger.info(f"Invalidated all cache for user {user_id}")


def invalidate_global_cache():
    """حذف بيانات التخزين المؤقت العامة"""
    CacheManager.invalidate_investments()
    CacheManager.invalidate_settings()
    logger.info("Invalidated global cache")
