"""
دوال مساعدة عامة - Utilities
"""

import random
import string
import sqlite3
import re
import json
from functools import wraps
from datetime import datetime
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity
from logger_config import AuditLog, get_logger

logger = get_logger()


class ValidationError(Exception):
    """استثناء التحقق من البيانات"""
    pass


class DatabaseError(Exception):
    """استثناء قاعدة البيانات"""
    pass


def validate_email(email):
    """التحقق من صحة البريد الإلكتروني"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValidationError('Invalid email format')
    return email.lower().strip()


def validate_password_strength(password):
    """التحقق من قوة كلمة المرور"""
    if len(password) < 8:
        raise ValidationError('Password must be at least 8 characters')
    
    if not re.search(r'[a-z]', password):
        raise ValidationError('Password must contain lowercase letters')
    
    if not re.search(r'[A-Z]', password):
        raise ValidationError('Password must contain uppercase letters')
    
    if not re.search(r'[0-9]', password):
        raise ValidationError('Password must contain numbers')
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise ValidationError('Password must contain special characters')
    
    return password


def validate_phone(phone):
    """التحقق من رقم الهاتف"""
    phone = re.sub(r'\D', '', phone)
    if len(phone) < 10:
        raise ValidationError('Invalid phone number')
    return phone


def validate_wallet_address(address, currency_code):
    """التحقق من صحة عنوان المحفظة"""
    if not address or len(address) < 20:
        raise ValidationError(f'Invalid wallet address for {currency_code}')
    return address


def generate_wallet_address(currency_id):
    """توليد عنوان محفظة فريد"""
    prefix = {
        1: 'T',       # USDT TRC20
        2: '1',       # BTC
        3: '0x',      # ETH
        4: 'bnb',     # BNB
        5: 'T'        # TRX
    }.get(currency_id, '')
    
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=33 - len(prefix)))
    return prefix + random_part


def generate_unique_id(prefix='TXN'):
    """توليد معرّف فريد"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"{prefix}_{timestamp}_{random_part}"


def get_db_connection():
    """الحصول على اتصال قاعدة البيانات"""
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn


def close_db_connection(conn):
    """إغلاق اتصال قاعدة البيانات"""
    if conn:
        conn.close()


def dict_from_row(row):
    """تحويل sqlite3.Row إلى dictionary"""
    if row is None:
        return None
    return dict(row) if row else None


def dict_from_rows(rows):
    """تحويل قائمة sqlite3.Row إلى قائمة dictionaries"""
    return [dict(row) for row in rows] if rows else []


def paginate_query(query, page=1, per_page=20):
    """تطبيق pagination على استعلام"""
    offset = (page - 1) * per_page
    total = len(query)
    paginated = query[offset:offset + per_page]
    
    return {
        'data': paginated,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': (total + per_page - 1) // per_page
        }
    }


def format_currency(amount, currency_code='USD'):
    """تنسيق المبلغ المالي"""
    symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'USDT': '₮',
        'BTC': '₿',
        'ETH': 'Ξ'
    }
    symbol = symbols.get(currency_code, '')
    return f"{symbol} {amount:,.2f}"


def calculate_fees(amount, fee_percentage=0, fee_fixed=0):
    """حساب الرسوم"""
    percentage_fee = amount * (fee_percentage / 100)
    total_fee = percentage_fee + fee_fixed
    total_amount = amount + total_fee
    
    return {
        'amount': amount,
        'percentage_fee': percentage_fee,
        'fixed_fee': fee_fixed,
        'total_fee': total_fee,
        'total_amount': total_amount
    }


def create_response(success=True, message='', data=None, code=None, status_code=200):
    """إنشاء استجابة موحدة"""
    response = {
        'success': success,
        'timestamp': datetime.now().isoformat()
    }
    
    if message:
        response['message'] = message
    
    if data is not None:
        response['data'] = data
    
    if code:
        response['code'] = code
    
    return jsonify(response), status_code


def error_response(error, code=None, status_code=400):
    """إنشاء استجابة خطأ"""
    return create_response(
        success=False,
        message=error,
        code=code,
        status_code=status_code
    )


def admin_required(f):
    """decorator للتحقق من صلاحيات الأدمن"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            user_id = int(get_jwt_identity())
            conn = get_db_connection()
            
            user = conn.execute(
                'SELECT role FROM users WHERE id = ? AND is_active = 1',
                (user_id,)
            ).fetchone()
            
            conn.close()
            
            if not user or user['role'] != 'admin':
                AuditLog.log_security_event('UNAUTHORIZED_ADMIN_ACCESS', f'User {user_id}')
                return error_response('Admin access required', 'ADMIN_REQUIRED', 403)
            
            return f(*args, **kwargs)
        
        except Exception as e:
            logger.error(f"Admin check error: {str(e)}")
            return error_response('Internal server error', 'SERVER_ERROR', 500)
    
    return decorated_function


def validate_required_fields(data, required_fields):
    """التحقق من وجود جميع الحقول المطلوبة"""
    missing = []
    for field in required_fields:
        if not data.get(field):
            missing.append(field)
    
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(missing)}")


def safe_int(value, default=0):
    """تحويل آمن إلى integer"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def safe_float(value, default=0.0):
    """تحويل آمن إلى float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def sanitize_string(text, max_length=1000):
    """تنظيف النصوص من الأحرف غير الآمنة"""
    if not isinstance(text, str):
        return ''
    
    # إزالة الأحرف الخاصة الخطيرة
    text = re.sub(r'[<>\"\'%;()&+]', '', text)
    
    # قص الطول الزائد
    text = text[:max_length]
    
    return text.strip()


def log_api_request(method, endpoint, user_id=None):
    """تسجيل طلب API"""
    ip_address = request.remote_addr
    message = f"{method} {endpoint} from {ip_address}"
    if user_id:
        message += f" (User: {user_id})"
    logger.debug(message)


def log_api_response(status_code, message=''):
    """تسجيل استجابة API"""
    logger.debug(f"Response: {status_code} {message}")
