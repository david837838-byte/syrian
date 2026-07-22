"""
نظام المصادقة الثنائية (2FA) - Two-Factor Authentication
"""

import pyotp
import sqlite3
import time
from datetime import datetime, timedelta
from logger_config import get_logger
from utils import get_db_connection

logger = get_logger()


class TwoFactorAuth:
    """نظام المصادقة الثنائية"""
    
    @staticmethod
    def generate_secret():
        """توليد مفتاح سري جديد"""
        return pyotp.random_base32()
    
    @staticmethod
    def get_totp(secret):
        """الحصول على TOTP من المفتاح السري"""
        totp = pyotp.TOTP(secret)
        return totp.now()
    
    @staticmethod
    def verify_totp(secret, token):
        """التحقق من رمز TOTP"""
        totp = pyotp.TOTP(secret)
        # السماح بـ ±30 ثانية للانحراف الزمني
        return totp.verify(token, valid_window=1)
    
    @staticmethod
    def get_provisioning_uri(secret, email, issuer_name="Invest Platform"):
        """الحصول على URI لـ QR Code"""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=email,
            issuer_name=issuer_name
        )
    
    @staticmethod
    def enable_2fa_for_user(user_id, secret):
        """تفعيل 2FA للمستخدم"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users 
                SET 
                    two_factor_secret = ?,
                    two_factor_enabled = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (secret, user_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"2FA enabled for user {user_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to enable 2FA: {str(e)}")
            return False
    
    @staticmethod
    def disable_2fa_for_user(user_id):
        """تعطيل 2FA للمستخدم"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users 
                SET 
                    two_factor_secret = NULL,
                    two_factor_enabled = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (user_id,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"2FA disabled for user {user_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to disable 2FA: {str(e)}")
            return False
    
    @staticmethod
    def verify_user_2fa(user_id, token):
        """التحقق من رمز 2FA للمستخدم"""
        try:
            conn = get_db_connection()
            
            user = conn.execute('''
                SELECT two_factor_secret, two_factor_enabled 
                FROM users 
                WHERE id = ? AND two_factor_enabled = 1
            ''', (user_id,)).fetchone()
            
            conn.close()
            
            if not user or not user['two_factor_secret']:
                logger.warning(f"2FA not enabled for user {user_id}")
                return False
            
            return TwoFactorAuth.verify_totp(user['two_factor_secret'], token)
        
        except Exception as e:
            logger.error(f"2FA verification failed: {str(e)}")
            return False
    
    @staticmethod
    def generate_backup_codes(count=10):
        """توليد رموز نسخ احتياطية (للاستخدام في حالة فقدان الجهاز)"""
        import secrets
        codes = []
        for _ in range(count):
            code = secrets.token_hex(4).upper()
            codes.append(code)
        return codes
    
    @staticmethod
    def save_backup_codes(user_id, codes):
        """حفظ الرموز النسخ احتياطية"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # تخزين الرموز كـ JSON
            import json
            codes_json = json.dumps(codes)
            
            cursor.execute('''
                UPDATE users 
                SET backup_codes = ?
                WHERE id = ?
            ''', (codes_json, user_id))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Backup codes saved for user {user_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to save backup codes: {str(e)}")
            return False
    
    @staticmethod
    def verify_backup_code(user_id, code):
        """التحقق من رمز نسخ احتياطي واستخدامه (ثم حذفه)"""
        try:
            conn = get_db_connection()
            
            user = conn.execute('''
                SELECT backup_codes FROM users WHERE id = ?
            ''', (user_id,)).fetchone()
            
            if not user or not user['backup_codes']:
                conn.close()
                return False
            
            import json
            backup_codes = json.loads(user['backup_codes'])
            
            if code in backup_codes:
                # إزالة الرمز المستخدم
                backup_codes.remove(code)
                
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users 
                    SET backup_codes = ?
                    WHERE id = ?
                ''', (json.dumps(backup_codes), user_id))
                
                conn.commit()
                conn.close()
                
                logger.info(f"Backup code used for user {user_id}")
                return True
            
            conn.close()
            return False
        
        except Exception as e:
            logger.error(f"Backup code verification failed: {str(e)}")
            return False


class LoginAttempt:
    """تتبع محاولات تسجيل الدخول الفاشلة"""
    
    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION = 15  # دقيقة
    
    @staticmethod
    def record_failed_attempt(email):
        """تسجيل محاولة فاشلة"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # حذف المحاولات القديمة
            cutoff_time = datetime.now() - timedelta(minutes=LoginAttempt.LOCKOUT_DURATION)
            cursor.execute('''
                DELETE FROM login_attempts 
                WHERE email = ? AND attempted_at < ?
            ''', (email, cutoff_time))
            
            # إضافة محاولة جديدة
            cursor.execute('''
                INSERT INTO login_attempts (email, attempted_at)
                VALUES (?, CURRENT_TIMESTAMP)
            ''', (email,))
            
            conn.commit()
            conn.close()
            
            logger.warning(f"Failed login attempt for {email}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to record login attempt: {str(e)}")
            return False
    
    @staticmethod
    def is_locked_out(email):
        """التحقق مما إذا كان الحساب مقفول"""
        try:
            conn = get_db_connection()
            
            cutoff_time = datetime.now() - timedelta(minutes=LoginAttempt.LOCKOUT_DURATION)
            
            result = conn.execute('''
                SELECT COUNT(*) as attempts 
                FROM login_attempts 
                WHERE email = ? AND attempted_at > ?
            ''', (email, cutoff_time)).fetchone()
            
            conn.close()
            
            is_locked = result['attempts'] >= LoginAttempt.MAX_ATTEMPTS
            
            if is_locked:
                logger.warning(f"Account locked out: {email} ({result['attempts']} attempts)")
            
            return is_locked
        
        except Exception as e:
            logger.error(f"Failed to check lockout status: {str(e)}")
            return False
    
    @staticmethod
    def clear_attempts(email):
        """مسح محاولات التسجيل الفاشلة"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                DELETE FROM login_attempts WHERE email = ?
            ''', (email,))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Login attempts cleared for {email}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to clear login attempts: {str(e)}")
            return False
    
    @staticmethod
    def get_remaining_attempts(email):
        """الحصول على عدد المحاولات المتبقية"""
        try:
            conn = get_db_connection()
            
            cutoff_time = datetime.now() - timedelta(minutes=LoginAttempt.LOCKOUT_DURATION)
            
            result = conn.execute('''
                SELECT COUNT(*) as attempts 
                FROM login_attempts 
                WHERE email = ? AND attempted_at > ?
            ''', (email, cutoff_time)).fetchone()
            
            conn.close()
            
            attempts = result['attempts']
            remaining = max(0, LoginAttempt.MAX_ATTEMPTS - attempts)
            
            return remaining
        
        except Exception as e:
            logger.error(f"Failed to get remaining attempts: {str(e)}")
            return LoginAttempt.MAX_ATTEMPTS
