"""
معالجة الأخطاء والـ Middleware المخصص
"""

from flask import jsonify, request
from werkzeug.exceptions import HTTPException
from logger_config import AuditLog, get_logger
from datetime import datetime

logger = get_logger()


class APIException(Exception):
    """استثناء API مخصص"""
    
    def __init__(self, message, code=None, status_code=400):
        self.message = message
        self.code = code or message
        self.status_code = status_code
        super().__init__(message)


def register_error_handlers(app):
    """تسجيل معالجات الأخطاء"""
    
    @app.errorhandler(APIException)
    def handle_api_exception(error):
        """معالج استثناءات API"""
        response = {
            'success': False,
            'error': error.message,
            'code': error.code,
            'timestamp': datetime.now().isoformat()
        }
        AuditLog.log_security_event('API_ERROR', f"{error.code}: {error.message}")
        return jsonify(response), error.status_code
    
    @app.errorhandler(400)
    def bad_request(error):
        """معالج طلب سيء"""
        response = {
            'success': False,
            'error': 'Bad request',
            'code': 'BAD_REQUEST',
            'timestamp': datetime.now().isoformat()
        }
        return jsonify(response), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        """معالج عدم التفويض"""
        response = {
            'success': False,
            'error': 'Unauthorized',
            'code': 'UNAUTHORIZED',
            'timestamp': datetime.now().isoformat()
        }
        return jsonify(response), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        """معالج المحظور"""
        response = {
            'success': False,
            'error': 'Forbidden',
            'code': 'FORBIDDEN',
            'timestamp': datetime.now().isoformat()
        }
        return jsonify(response), 403
    
    @app.errorhandler(404)
    def not_found(error):
        """معالج غير موجود"""
        response = {
            'success': False,
            'error': 'Resource not found',
            'code': 'NOT_FOUND',
            'timestamp': datetime.now().isoformat()
        }
        return jsonify(response), 404
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """معالج تجاوز حد المعدل"""
        response = {
            'success': False,
            'error': 'Too many requests. Please try again later.',
            'code': 'RATE_LIMIT_EXCEEDED',
            'timestamp': datetime.now().isoformat()
        }
        AuditLog.log_security_event('RATE_LIMIT', f"IP: {request.remote_addr}")
        return jsonify(response), 429
    
    @app.errorhandler(500)
    def internal_server_error(error):
        """معالج خطأ الخادم الداخلي"""
        response = {
            'success': False,
            'error': 'Internal server error',
            'code': 'SERVER_ERROR',
            'timestamp': datetime.now().isoformat()
        }
        logger.error(f"Internal server error: {str(error)}")
        AuditLog.log_security_event('SERVER_ERROR', str(error))
        return jsonify(response), 500
    
    @app.errorhandler(503)
    def service_unavailable(error):
        """معالج الخدمة غير المتاحة"""
        response = {
            'success': False,
            'error': 'Service unavailable',
            'code': 'SERVICE_UNAVAILABLE',
            'timestamp': datetime.now().isoformat()
        }
        return jsonify(response), 503


def register_middleware(app):
    """تسجيل الـ middleware المخصص"""
    
    @app.before_request
    def before_request():
        """قبل كل طلب"""
        # تسجيل الطلب
        logger.debug(f"{request.method} {request.path} from {request.remote_addr}")
        
        # التحقق من صيانة الموقع
        if request.path.startswith('/api/') and not request.path.startswith('/api/auth/'):
            # يمكن إضافة فحوصات إضافية هنا
            pass
    
    @app.after_request
    def after_request(response):
        """بعد كل طلب"""
        # إضافة security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://code.jquery.com; style-src 'self' https://cdnjs.cloudflare.com"
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # تسجيل الاستجابة
        logger.debug(f"Response: {response.status_code} {request.path}")
        
        return response
    
    @app.teardown_request
    def teardown_request(exception=None):
        """بعد انتهاء الطلب"""
        if exception:
            logger.error(f"Request error: {str(exception)}")


class RequestValidator:
    """مدقق الطلبات"""
    
    @staticmethod
    def validate_json_content_type():
        """التحقق من نوع المحتوى"""
        if request.method in ['POST', 'PUT', 'PATCH']:
            if not request.is_json:
                raise APIException(
                    'Content-Type must be application/json',
                    'INVALID_CONTENT_TYPE',
                    400
                )
    
    @staticmethod
    def validate_request_size():
        """التحقق من حجم الطلب"""
        max_size = 16 * 1024 * 1024  # 16 MB
        if request.content_length and request.content_length > max_size:
            raise APIException(
                'Request body too large',
                'REQUEST_TOO_LARGE',
                413
            )
    
    @staticmethod
    def sanitize_input(data):
        """تنظيف المدخلات"""
        from utils import sanitize_string
        
        if isinstance(data, dict):
            return {k: RequestValidator.sanitize_input(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [RequestValidator.sanitize_input(item) for item in data]
        elif isinstance(data, str):
            return sanitize_string(data)
        else:
            return data


class AuditMiddleware:
    """middleware للتدقيق"""
    
    @staticmethod
    def log_sensitive_action(user_id, action, entity_type=None, entity_id=None, old_value=None, new_value=None):
        """تسجيل الإجراءات الحساسة"""
        from utils import get_db_connection
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO audit_logs (
                    user_id, action, entity_type, entity_id,
                    old_value, new_value, ip_address, user_agent, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                action,
                entity_type,
                entity_id,
                str(old_value)[:1000] if old_value else None,
                str(new_value)[:1000] if new_value else None,
                request.remote_addr,
                request.headers.get('User-Agent', ''),
                'success'
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to log audit: {str(e)}")
    
    @staticmethod
    def log_security_event(event_type, severity='info', details=None):
        """تسجيل حدث أمان"""
        AuditLog.log_security_event(event_type, f"{details} from {request.remote_addr}")
