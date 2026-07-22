"""
نظام Logging والسجلات
"""

import logging
import logging.handlers
import os
from datetime import datetime


def setup_logging(config):
    """إعداد نظام logging"""
    
    # إنشاء مجلد السجلات
    logs_dir = os.path.dirname(config.LOG_FILE)
    os.makedirs(logs_dir, exist_ok=True)
    
    # إنشاء logger رئيسي
    logger = logging.getLogger('invest_platform')
    logger.setLevel(getattr(logging, config.LOG_LEVEL))
    
    # إذا كان هناك handlers بالفعل، لا تضيف المزيد
    if logger.handlers:
        return logger
    
    # صيغة السجل
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler للملفات (مع rotation)
    file_handler = logging.handlers.RotatingFileHandler(
        config.LOG_FILE,
        maxBytes=config.LOG_MAX_BYTES,
        backupCount=config.LOG_BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Handler للـ console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger


class AuditLog:
    """تسجيل الأنشطة الحساسة"""
    
    @staticmethod
    def log_user_action(user_id, action, details=None, status='success'):
        """تسجيل إجراء المستخدم"""
        logger = logging.getLogger('invest_platform')
        message = f"User {user_id}: {action}"
        if details:
            message += f" - {details}"
        
        if status == 'success':
            logger.info(message)
        elif status == 'warning':
            logger.warning(message)
        else:
            logger.error(message)
    
    @staticmethod
    def log_transaction(user_id, transaction_type, amount, status='pending'):
        """تسجيل المعاملات"""
        logger = logging.getLogger('invest_platform')
        message = f"Transaction: User {user_id}, Type: {transaction_type}, Amount: {amount}, Status: {status}"
        logger.info(message)
    
    @staticmethod
    def log_admin_action(admin_id, action, details=None):
        """تسجيل إجراءات الأدمن"""
        logger = logging.getLogger('invest_platform')
        message = f"Admin {admin_id}: {action}"
        if details:
            message += f" - {details}"
        logger.warning(message)
    
    @staticmethod
    def log_security_event(event_type, details):
        """تسجيل أحداث الأمان"""
        logger = logging.getLogger('invest_platform')
        message = f"[SECURITY] {event_type}: {details}"
        logger.critical(message)


def get_logger(name='invest_platform'):
    """الحصول على logger"""
    return logging.getLogger(name)
