from flask import Flask, request, jsonify, session, render_template, send_from_directory
from flask_cors import CORS
from flask import g
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
import sqlite3
import json
from datetime import datetime, timedelta
from urllib.parse import urlparse
import os
import time
import requests
import re
from functools import wraps
from types import SimpleNamespace
import uuid
import random
import string
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from email_service import (
    get_last_email_error,
    init_mail,
    send_email,
    send_password_reset_code_email,
    send_password_reset_email,
    send_verification_code_email,
)
from logger_config import get_logger, setup_logging
from utils import validate_email, validate_password_strength

load_dotenv()

app = Flask(__name__, template_folder='templates', static_folder='static')


@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(app.static_folder, 'images'),
        'app-icon-192.png',
        mimetype='image/png'
    )


def build_public_user_id(user_id):
    return str(100000 + int(user_id))


def build_referral_code(user_id):
    return f"INV{build_public_user_id(user_id)}"


MIDDLE_EAST_COUNTRIES = [
    {'code': 'SY', 'name': 'سوريا'},
    {'code': 'SA', 'name': 'السعودية'},
    {'code': 'AE', 'name': 'الإمارات العربية المتحدة'},
    {'code': 'QA', 'name': 'قطر'},
    {'code': 'KW', 'name': 'الكويت'},
    {'code': 'BH', 'name': 'البحرين'},
    {'code': 'OM', 'name': 'عُمان'},
    {'code': 'JO', 'name': 'الأردن'},
    {'code': 'LB', 'name': 'لبنان'},
    {'code': 'IQ', 'name': 'العراق'},
    {'code': 'EG', 'name': 'مصر'},
    {'code': 'TR', 'name': 'تركيا'},
    {'code': 'IR', 'name': 'إيران'},
    {'code': 'YE', 'name': 'اليمن'},
    {'code': 'PS', 'name': 'فلسطين'}
]

COUNTRY_NAME_BY_CODE = {item['code']: item['name'] for item in MIDDLE_EAST_COUNTRIES}
bcrypt = Bcrypt(app)

# إعدادات CORS
if os.environ.get('FLASK_ENV') == 'production':
    CORS(app, 
         supports_credentials=True,
         origins=os.environ.get('ALLOWED_ORIGINS', 'http://localhost:2000').split(','),
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
else:
    CORS(app, 
         supports_credentials=True,
         origins=os.environ.get('ALLOWED_ORIGINS', 'http://localhost:2000,http://127.0.0.1:2000').split(','),
         allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
         max_age=3600)

# تفعيل Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
)

# إعدادات الأمان
if os.environ.get('FLASK_ENV') == 'production' and (
    not os.environ.get('SECRET_KEY') or not os.environ.get('JWT_SECRET_KEY')
):
    raise RuntimeError('SECRET_KEY and JWT_SECRET_KEY must be set in production')

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)  # تقليل المدة
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['BACKUP_FOLDER'] = os.environ.get('BACKUP_FOLDER', 'backups')
app.config['MAX_CONTENT_LENGTH'] = 128 * 1024 * 1024  # 128MB
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['DATABASE_PATH'] = os.environ.get('DATABASE_PATH', 'database.db')
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get(
    'MAIL_DEFAULT_SENDER',
    app.config['MAIL_USERNAME'] or 'noreply@localhost'
)
app.config['MAIL_SENDER_NAME'] = os.environ.get(
    'MAIL_SENDER_NAME',
    'منصة الاستثمار الذكية الآمنة'
)
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID', '')
app.config['LOG_LEVEL'] = os.environ.get('LOG_LEVEL', 'INFO')
app.config['LOG_FILE'] = os.environ.get('LOG_FILE', os.path.join('logs', 'app.log'))
app.config['LOG_MAX_BYTES'] = int(os.environ.get('LOG_MAX_BYTES', 10 * 1024 * 1024))
app.config['LOG_BACKUP_COUNT'] = int(os.environ.get('LOG_BACKUP_COUNT', 5))

jwt = JWTManager(app)
init_mail(app)
setup_logging(SimpleNamespace(
    LOG_LEVEL=app.config['LOG_LEVEL'],
    LOG_FILE=app.config['LOG_FILE'],
    LOG_MAX_BYTES=app.config['LOG_MAX_BYTES'],
    LOG_BACKUP_COUNT=app.config['LOG_BACKUP_COUNT'],
))
logger = get_logger()


@app.before_request
def prepare_request_context():
    g.request_id = uuid.uuid4().hex[:12]
    g.request_started_at = time.time()


def is_request_origin_allowed():
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')
    source = origin or referer
    if not source:
        return True

    parsed = urlparse(source)
    source_host = (parsed.hostname or '').lower()
    request_host = (request.host.split(':')[0] or '').lower()
    trusted_hosts = {request_host, 'localhost', '127.0.0.1', '::1'}
    trusted_hosts.update({
        host.strip().lower()
        for host in str(os.environ.get('TRUSTED_ORIGIN_HOSTS', '') or '').split(',')
        if host.strip()
    })
    return source_host in trusted_hosts


@app.before_request
def protect_api_origin():
    if request.method in {'GET', 'HEAD', 'OPTIONS'}:
        return None
    if not request.path.startswith('/api/'):
        return None
    if is_request_origin_allowed():
        return None

    log_security_event(
        event_type='security.origin_blocked',
        severity='warning',
        details={
            'path': request.path,
            'method': request.method,
            'origin': request.headers.get('Origin'),
            'referer': request.headers.get('Referer'),
            'host': request.host,
        },
    )
    return jsonify({
        'error': 'مصدر الطلب غير موثوق لهذا الإجراء',
        'code': 'UNTRUSTED_ORIGIN'
    }), 403


def read_runtime_setting(key, default=None):
    db_path = app.config.get('DATABASE_PATH') or os.environ.get('DATABASE_PATH', 'database.db')
    if not db_path or not os.path.exists(db_path):
        return default

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            'SELECT value, value_type FROM system_settings WHERE key = ? LIMIT 1',
            (key,)
        ).fetchone()
        if not row:
            return default

        raw_value = row['value']
        value_type = str(row['value_type'] or '').strip().lower()
        if value_type == 'boolean':
            return str(raw_value).strip().lower() in {'1', 'true', 'yes', 'on'}
        if value_type in {'integer', 'number'}:
            try:
                return float(raw_value)
            except (TypeError, ValueError):
                return default
        return raw_value if raw_value not in (None, '') else default
    except sqlite3.Error:
        return default
    finally:
        if conn:
            conn.close()


def request_has_admin_access():
    if not request.path.startswith('/api/'):
        return False
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if not identity:
            return False

        conn = sqlite3.connect(app.config.get('DATABASE_PATH') or os.environ.get('DATABASE_PATH', 'database.db'))
        conn.row_factory = sqlite3.Row
        user = conn.execute(
            'SELECT role FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
            (int(identity),)
        ).fetchone()
        conn.close()
        return bool(user) and str(user['role'] or '').strip().lower() == 'admin'
    except Exception:
        return False


@app.before_request
def enforce_maintenance_mode():
    if request.method == 'OPTIONS':
        return None

    if request.path.startswith('/static/') or request.path.startswith('/uploads/'):
        return None

    if request.path in {'/favicon.ico', '/health', '/api/health'}:
        return None

    maintenance_enabled = bool(read_runtime_setting('maintenance_mode', False))
    if not maintenance_enabled:
        return None

    if request_has_admin_access():
        return None

    if not request.path.startswith('/api/'):
        return None

    if request.method in {'GET', 'HEAD'}:
        return None

    allowed_mutation_prefixes = (
        '/api/auth/login',
        '/api/auth/google',
        '/api/auth/forgot-password',
        '/api/auth/request-reset-code',
        '/api/auth/verify-reset-code',
        '/api/auth/reset-password',
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
    )
    if any(request.path.startswith(prefix) for prefix in allowed_mutation_prefixes):
        return None

    message = read_runtime_setting(
        'maintenance_message',
        'نحن الآن في وضع صيانة لتحسين المنصة. نعتذر عن الإزعاج وسنعود إليكم قريبًا.'
    )
    return jsonify({
        'error': message,
        'code': 'MAINTENANCE_MODE_ACTIVE'
    }), 503

# إضافة security headers
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://code.jquery.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; media-src 'self' https: blob:; frame-src 'self' https://accounts.google.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://vimeo.com; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com"
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    response.headers['X-Request-ID'] = getattr(g, 'request_id', '')

    duration_ms = None
    if hasattr(g, 'request_started_at'):
        duration_ms = round((time.time() - g.request_started_at) * 1000, 2)

    if response.status_code >= 400:
        logger.warning(
            'request_completed path=%s method=%s status=%s ip=%s duration_ms=%s request_id=%s',
            request.path,
            request.method,
            response.status_code,
            request.remote_addr,
            duration_ms,
            getattr(g, 'request_id', ''),
        )
    return response

# إنشاء مجلد التحميلات
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('static', exist_ok=True)
os.makedirs(app.config['BACKUP_FOLDER'], exist_ok=True)


# تهيئة قاعدة البيانات
def get_database_path():
    return app.config.get('DATABASE_PATH') or os.environ.get('DATABASE_PATH', 'database.db')


def column_exists(conn, table_name, column_name):
    columns = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    return any(column[1] == column_name for column in columns)


def table_exists(conn, table_name):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,)
    ).fetchone()
    return row is not None


def ensure_column(conn, table_name, column_name, definition):
    if not column_exists(conn, table_name, column_name):
        conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}')


def migrate_legacy_withdrawal_requests_table(conn):
    if not table_exists(conn, 'withdrawal_requests'):
        return

    columns = conn.execute('PRAGMA table_info(withdrawal_requests)').fetchall()
    column_names = [column[1] for column in columns]
    if 'network' not in column_names:
        return

    legacy_backup_name = f"withdrawal_requests_legacy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    conn.execute('ALTER TABLE withdrawal_requests RENAME TO ' + legacy_backup_name)
    conn.execute('''
        CREATE TABLE withdrawal_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            fee REAL DEFAULT 0.0,
            wallet_address TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            admin_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id)
        )
    ''')
    conn.execute('DROP INDEX IF EXISTS idx_withdrawal_status')
    conn.execute('DROP INDEX IF EXISTS idx_withdrawal_user_status')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_withdrawal_user_status ON withdrawal_requests(user_id, status)')

    legacy_rows = conn.execute(f'SELECT * FROM {legacy_backup_name} ORDER BY id').fetchall()
    migrated_count = 0
    skipped_count = 0

    for row in legacy_rows:
        row_data = dict(row)
        currency_id = row_data.get('currency_id')
        network_id = row_data.get('network_id')
        raw_network = str(row_data.get('network') or '').strip()

        if network_id:
            network_exists = conn.execute(
                'SELECT id, currency_id FROM networks WHERE id = ? LIMIT 1',
                (network_id,)
            ).fetchone()
            if network_exists:
                network_id = int(network_exists['id'])
                if not currency_id:
                    currency_id = int(network_exists['currency_id'])
            else:
                network_id = None

        if not network_id and raw_network:
            normalized_network = raw_network.upper()
            candidate = None
            if currency_id:
                candidate = conn.execute(
                    '''
                    SELECT id, currency_id
                    FROM networks
                    WHERE currency_id = ?
                      AND (UPPER(code) = ? OR UPPER(name) = ?)
                    ORDER BY id ASC
                    LIMIT 1
                    ''',
                    (currency_id, normalized_network, normalized_network)
                ).fetchone()
            if not candidate:
                candidate = conn.execute(
                    '''
                    SELECT id, currency_id
                    FROM networks
                    WHERE UPPER(code) = ? OR UPPER(name) = ?
                    ORDER BY id ASC
                    LIMIT 1
                    ''',
                    (normalized_network, normalized_network)
                ).fetchone()
            if candidate:
                network_id = int(candidate['id'])
                if not currency_id:
                    currency_id = int(candidate['currency_id'])

        if currency_id and not network_id:
            fallback_network = conn.execute(
                'SELECT id FROM networks WHERE currency_id = ? ORDER BY id ASC LIMIT 1',
                (currency_id,)
            ).fetchone()
            if fallback_network:
                network_id = int(fallback_network['id'])

        if not currency_id or not network_id:
            skipped_count += 1
            continue

        conn.execute(
            '''
            INSERT INTO withdrawal_requests (
                id, user_id, currency_id, network_id, amount, fee,
                wallet_address, status, admin_note, created_at, processed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                row_data.get('id'),
                row_data.get('user_id'),
                currency_id,
                network_id,
                row_data.get('amount'),
                row_data.get('fee') if row_data.get('fee') is not None else 0.0,
                row_data.get('wallet_address'),
                row_data.get('status') or 'pending',
                row_data.get('admin_note'),
                row_data.get('created_at'),
                row_data.get('processed_at'),
                row_data.get('updated_at')
            )
        )
        migrated_count += 1

    logger.info(
        'withdrawal_requests_migration_completed backup_table=%s migrated=%s skipped=%s',
        legacy_backup_name,
        migrated_count,
        skipped_count
    )


def ensure_database_compatibility(conn):
    """Apply small SQLite migrations needed by newer modules."""
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS governorates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            symbol TEXT,
            image_url TEXT,
            country_code TEXT DEFAULT 'SY',
            country_name TEXT DEFAULT 'سوريا',
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')

    ensure_column(conn, 'users', 'two_factor_enabled', 'BOOLEAN DEFAULT 0')
    ensure_column(conn, 'users', 'two_factor_secret', 'TEXT')
    ensure_column(conn, 'users', 'backup_codes', 'TEXT')
    ensure_column(conn, 'users', 'email_verified', 'BOOLEAN DEFAULT 0')
    ensure_column(conn, 'users', 'email_verified_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'last_login', 'TIMESTAMP')
    ensure_column(conn, 'users', 'failed_login_attempts', 'INTEGER DEFAULT 0')
    ensure_column(conn, 'users', 'locked_until', 'TIMESTAMP')
    ensure_column(conn, 'users', 'last_failed_login_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'password_changed_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'auth_provider', "TEXT DEFAULT 'password'")
    ensure_column(conn, 'users', 'google_sub', 'TEXT')
    ensure_column(conn, 'users', 'avatar_url', 'TEXT')
    ensure_column(conn, 'users', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'public_user_id', 'TEXT')
    ensure_column(conn, 'users', 'referral_code', 'TEXT')
    ensure_column(conn, 'users', 'referred_by_user_id', 'INTEGER')
    ensure_column(conn, 'users', 'account_type', "TEXT DEFAULT 'individual'")
    ensure_column(conn, 'users', 'preferred_country_code', "TEXT DEFAULT 'SY'")
    ensure_column(conn, 'users', 'preferred_country_name', "TEXT DEFAULT 'سوريا'")
    ensure_column(conn, 'users', 'detected_country_code', "TEXT DEFAULT 'SY'")
    ensure_column(conn, 'users', 'detected_country_name', "TEXT DEFAULT 'سوريا'")
    ensure_column(conn, 'users', 'kyc_status', "TEXT DEFAULT 'not_submitted'")
    ensure_column(conn, 'users', 'kyc_document_urls_json', 'TEXT')
    ensure_column(conn, 'users', 'kyc_document_type', 'TEXT')
    ensure_column(conn, 'users', 'kyc_full_name', 'TEXT')
    ensure_column(conn, 'users', 'kyc_submitted_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'kyc_verified_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'kyc_reviewed_at', 'TIMESTAMP')
    ensure_column(conn, 'users', 'kyc_rejection_note', 'TEXT')
    ensure_column(conn, 'currencies', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'networks', 'created_at', 'TIMESTAMP')
    normalize_network_catalog(conn)
    ensure_column(conn, 'admin_wallets', 'updated_at', 'TIMESTAMP')
    normalize_admin_wallet_network_scope(conn)
    ensure_chain_compatible_token_admin_wallets(conn)
    ensure_column(conn, 'transactions', 'currency_id', 'INTEGER')
    ensure_column(conn, 'transactions', 'network_id', 'INTEGER')
    ensure_column(conn, 'transactions', 'admin_wallet_address', 'TEXT')
    ensure_column(conn, 'transactions', 'verified_at', 'TIMESTAMP')
    ensure_column(conn, 'transactions', 'admin_note', 'TEXT')
    ensure_column(conn, 'transactions', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'withdrawal_requests', 'currency_id', 'INTEGER')
    ensure_column(conn, 'withdrawal_requests', 'network_id', 'INTEGER')
    ensure_column(conn, 'withdrawal_requests', 'fee', 'REAL DEFAULT 0.0')
    ensure_column(conn, 'withdrawal_requests', 'processed_at', 'TIMESTAMP')
    ensure_column(conn, 'withdrawal_requests', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'investments', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'investments', 'governorate_id', 'INTEGER')
    ensure_column(conn, 'investments', 'image_url', 'TEXT')
    ensure_column(conn, 'investments', 'image_gallery_json', 'TEXT')
    ensure_column(conn, 'investments', 'start_date', 'TEXT')
    ensure_column(conn, 'investments', 'end_date', 'TEXT')
    ensure_column(conn, 'investments', 'platform_fee_mode', "TEXT DEFAULT 'fixed'")
    ensure_column(conn, 'investments', 'platform_fee_value', 'REAL DEFAULT 0')
    ensure_column(conn, 'investments', 'platform_fee_currency', "TEXT DEFAULT 'USDT'")
    ensure_column(conn, 'investments', 'platform_fee_network', "TEXT DEFAULT 'TRC20'")
    ensure_column(conn, 'investments', 'platform_fee_paid', 'INTEGER DEFAULT 0')
    ensure_column(conn, 'investments', 'platform_fee_transaction_id', 'INTEGER')
    ensure_column(conn, 'investments', 'source_label', 'TEXT')
    ensure_column(conn, 'investments', 'source_url', 'TEXT')
    ensure_column(conn, 'investments', 'source_published_at', 'TEXT')
    ensure_column(conn, 'user_investments', 'returns', 'REAL DEFAULT 0')
    ensure_column(conn, 'user_investments', 'role', "TEXT DEFAULT 'user'")
    ensure_column(conn, 'user_investments', 'investment_date', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    ensure_column(conn, 'user_investments', 'last_profit_date', 'TIMESTAMP')
    if table_exists(conn, 'company_profiles'):
        ensure_column(conn, 'company_profiles', 'logo_url', 'TEXT')
        ensure_column(conn, 'company_profiles', 'document_urls_json', 'TEXT')
        ensure_column(conn, 'company_profiles', 'submitted_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'reviewed_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'approved_by_user_id', 'INTEGER')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_paid', 'INTEGER DEFAULT 0')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_paid_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_transaction_id', 'INTEGER')
    ensure_column(conn, 'system_settings', 'created_at', 'TIMESTAMP')

    # Keep legacy wallet limits compatible with small real-network test deposits.
    conn.execute('''
        UPDATE currencies
        SET min_deposit = 0.0001,
            updated_at = CURRENT_TIMESTAMP
        WHERE code = 'BNB' AND (min_deposit IS NULL OR min_deposit > 0.0001)
    ''')

    conn.execute('''
        UPDATE networks
        SET min_amount = 0.0001
        WHERE currency_id = (SELECT id FROM currencies WHERE code = 'BNB' LIMIT 1)
          AND UPPER(COALESCE(code, name, '')) IN ('BSC', 'BEP20')
          AND (min_amount IS NULL OR min_amount > 0.0001)
    ''')

    conn.executescript('''
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            ip_address TEXT,
            success BOOLEAN DEFAULT 0,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auth_device_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            identifier TEXT NOT NULL,
            user_id INTEGER,
            device_id TEXT NOT NULL,
            device_name TEXT,
            ip_address TEXT,
            user_agent TEXT,
            failure_count INTEGER DEFAULT 0,
            locked_until TIMESTAMP,
            last_failure_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope, identifier, device_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS user_device_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            device_name TEXT,
            ip_address TEXT,
            user_agent TEXT,
            first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP,
            last_password_reset_request_at TIMESTAMP,
            last_password_reset_at TIMESTAMP,
            failed_login_attempts INTEGER DEFAULT 0,
            failed_reset_attempts INTEGER DEFAULT 0,
            lock_reason TEXT,
            locked_until TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, device_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS email_verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS withdrawal_verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            wallet_address TEXT NOT NULL,
            code TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
            status TEXT DEFAULT 'success',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            severity TEXT DEFAULT 'info',
            details TEXT,
            ip_address TEXT,
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS wallet_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            access_note TEXT,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            admin_wallet_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id),
            FOREIGN KEY (admin_wallet_id) REFERENCES admin_wallets(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS wallet_profile_access (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES wallet_profiles(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(profile_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS financial_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_type TEXT NOT NULL DEFAULT 'crypto',
            title TEXT NOT NULL,
            description TEXT,
            country_code TEXT,
            country_name TEXT,
            currency_id INTEGER,
            network_id INTEGER,
            admin_wallet_id INTEGER,
            account_label TEXT,
            account_identifier TEXT,
            extra_details TEXT,
            instructions TEXT,
            is_active BOOLEAN DEFAULT 1,
            display_order INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id),
            FOREIGN KEY (admin_wallet_id) REFERENCES admin_wallets(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS real_crypto_wallet_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            address TEXT NOT NULL UNIQUE,
            label TEXT,
            provider_name TEXT,
            notes TEXT,
            is_active BOOLEAN DEFAULT 1,
            assigned_user_id INTEGER,
            assigned_at TIMESTAMP,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id),
            FOREIGN KEY (assigned_user_id) REFERENCES users(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS real_user_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            pool_wallet_id INTEGER NOT NULL UNIQUE,
            address TEXT NOT NULL,
            label TEXT,
            provider_name TEXT,
            status TEXT DEFAULT 'active',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_synced_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id),
            FOREIGN KEY (pool_wallet_id) REFERENCES real_crypto_wallet_pool(id),
            UNIQUE(user_id, currency_id, network_id)
        );

        CREATE TABLE IF NOT EXISTS real_wallet_generation_counters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            currency_id INTEGER NOT NULL,
            network_id INTEGER NOT NULL,
            next_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(currency_id, network_id),
            FOREIGN KEY (currency_id) REFERENCES currencies(id),
            FOREIGN KEY (network_id) REFERENCES networks(id)
        );

        CREATE TABLE IF NOT EXISTS company_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            company_name TEXT NOT NULL,
            trade_name TEXT,
            registration_number TEXT,
            representative_name TEXT NOT NULL,
            representative_title TEXT,
            company_email TEXT,
            company_phone TEXT,
            country_code TEXT DEFAULT 'SY',
            country_name TEXT DEFAULT 'سوريا',
            city TEXT,
            address TEXT,
            website_url TEXT,
            description TEXT,
            logo_url TEXT,
            document_urls_json TEXT,
            verification_status TEXT DEFAULT 'draft',
            verification_note TEXT,
            submitted_at TIMESTAMP,
            reviewed_at TIMESTAMP,
            verified_at TIMESTAMP,
            approved_by_user_id INTEGER,
            wallet_setup_fee_paid INTEGER DEFAULT 0,
            wallet_setup_fee_paid_at TIMESTAMP,
            wallet_setup_fee_transaction_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS property_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            property_type TEXT NOT NULL,
            sale_price REAL NOT NULL,
            area_size REAL,
            address TEXT NOT NULL,
            governorate_id INTEGER NOT NULL,
            image_url TEXT,
            image_gallery_json TEXT,
            kyc_document_urls_json TEXT,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            contact_email TEXT,
            platform_fee_mode TEXT NOT NULL,
            platform_fee_value REAL NOT NULL DEFAULT 0,
            platform_fee_currency TEXT NOT NULL DEFAULT 'USDT',
            platform_fee_network TEXT NOT NULL DEFAULT 'TRC20',
            platform_fee_paid INTEGER DEFAULT 0,
            platform_fee_transaction_id INTEGER,
            status TEXT DEFAULT 'draft',
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (seller_id) REFERENCES users(id),
            FOREIGN KEY (governorate_id) REFERENCES governorates(id),
            FOREIGN KEY (platform_fee_transaction_id) REFERENCES transactions(id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT DEFAULT 'direct',
            title TEXT,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS conversation_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(conversation_id, user_id),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            body TEXT,
            message_type TEXT DEFAULT 'text',
            message_origin TEXT DEFAULT 'user',
            attachment_url TEXT,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS call_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            initiated_by INTEGER NOT NULL,
            call_type TEXT DEFAULT 'audio',
            status TEXT DEFAULT 'ringing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            accepted_at TIMESTAMP,
            ended_at TIMESTAMP,
            ended_by INTEGER,
            last_signal_at TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id),
            FOREIGN KEY (initiated_by) REFERENCES users(id),
            FOREIGN KEY (ended_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS call_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            signal_type TEXT NOT NULL,
            payload TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (call_id) REFERENCES call_sessions(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);
        CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);
        CREATE INDEX IF NOT EXISTS idx_withdrawal_user_status ON withdrawal_requests(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
        CREATE INDEX IF NOT EXISTS idx_investments_governorate ON investments(governorate_id);
        CREATE INDEX IF NOT EXISTS idx_investments_status_governorate ON investments(status, governorate_id);
        CREATE INDEX IF NOT EXISTS idx_property_listings_status ON property_listings(status);
        CREATE INDEX IF NOT EXISTS idx_property_listings_governorate ON property_listings(governorate_id);
        CREATE INDEX IF NOT EXISTS idx_property_listings_seller ON property_listings(seller_id);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
        CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at DESC);
        CREATE INDEX IF NOT EXISTS idx_auth_device_attempts_lookup ON auth_device_attempts(scope, identifier, device_id);
        CREATE INDEX IF NOT EXISTS idx_user_device_activity_user ON user_device_activity(user_id, last_seen_at DESC);
        CREATE INDEX IF NOT EXISTS idx_user_device_activity_locked ON user_device_activity(locked_until, last_seen_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_user_id ON users(public_user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
        CREATE INDEX IF NOT EXISTS idx_wallet_profiles_currency ON wallet_profiles(currency_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_profile_access_user ON wallet_profile_access(user_id);
        CREATE INDEX IF NOT EXISTS idx_financial_channels_country_active ON financial_channels(country_code, is_active, display_order);
        CREATE INDEX IF NOT EXISTS idx_real_crypto_wallet_pool_scope ON real_crypto_wallet_pool(currency_id, network_id, is_active, assigned_user_id);
        CREATE INDEX IF NOT EXISTS idx_real_user_wallets_user_scope ON real_user_wallets(user_id, currency_id, network_id, status);
        CREATE INDEX IF NOT EXISTS idx_real_wallet_generation_counters_scope ON real_wallet_generation_counters(currency_id, network_id);
        CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_company_profiles_status ON company_profiles(verification_status, country_code);
        CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at ON messages(sender_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON call_sessions(conversation_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_call_signals_call ON call_signals(call_id, id ASC);
        CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_security_logs_user_created_at ON security_logs(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_password_reset_codes_lookup ON password_reset_codes(user_id, code, used, expires_at);
        CREATE INDEX IF NOT EXISTS idx_email_verification_codes_lookup ON email_verification_codes(user_id, code, used, expires_at);
    ''')

    if table_exists(conn, 'company_profiles'):
        ensure_column(conn, 'company_profiles', 'logo_url', 'TEXT')
        ensure_column(conn, 'company_profiles', 'document_urls_json', 'TEXT')
        ensure_column(conn, 'company_profiles', 'submitted_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'reviewed_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'approved_by_user_id', 'INTEGER')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_paid', 'INTEGER DEFAULT 0')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_paid_at', 'TIMESTAMP')
        ensure_column(conn, 'company_profiles', 'wallet_setup_fee_transaction_id', 'INTEGER')

    ensure_column(conn, 'wallet_profiles', 'access_note', 'TEXT')
    ensure_column(conn, 'wallet_profiles', 'updated_at', 'TIMESTAMP')
    ensure_column(conn, 'governorates', 'country_code', "TEXT DEFAULT 'SY'")
    ensure_column(conn, 'governorates', 'country_name', "TEXT DEFAULT 'سوريا'")
    ensure_column(conn, 'property_listings', 'image_url', 'TEXT')
    ensure_column(conn, 'property_listings', 'image_gallery_json', 'TEXT')
    ensure_column(conn, 'property_listings', 'kyc_document_urls_json', 'TEXT')
    ensure_column(conn, 'property_listings', 'contact_email', 'TEXT')
    ensure_column(conn, 'property_listings', 'platform_fee_mode', "TEXT DEFAULT 'fixed'")
    ensure_column(conn, 'property_listings', 'platform_fee_value', 'REAL DEFAULT 0')
    ensure_column(conn, 'property_listings', 'platform_fee_currency', "TEXT DEFAULT 'USDT'")
    ensure_column(conn, 'property_listings', 'platform_fee_network', "TEXT DEFAULT 'TRC20'")
    ensure_column(conn, 'property_listings', 'platform_fee_paid', 'INTEGER DEFAULT 0')
    ensure_column(conn, 'property_listings', 'platform_fee_transaction_id', 'INTEGER')
    ensure_column(conn, 'property_listings', 'published_at', 'TIMESTAMP')
    ensure_column(conn, 'property_listings', 'updated_at', 'TIMESTAMP')
    migrate_legacy_withdrawal_requests_table(conn)
    ensure_column(conn, 'messages', 'read_at', 'TIMESTAMP')
    ensure_column(conn, 'messages', 'message_origin', "TEXT DEFAULT 'user'")
    ensure_column(conn, 'call_sessions', 'call_type', "TEXT DEFAULT 'audio'")
    ensure_column(conn, 'call_sessions', 'status', "TEXT DEFAULT 'ringing'")
    ensure_column(conn, 'call_sessions', 'accepted_at', 'TIMESTAMP')
    ensure_column(conn, 'call_sessions', 'ended_at', 'TIMESTAMP')
    ensure_column(conn, 'call_sessions', 'ended_by', 'INTEGER')
    ensure_column(conn, 'call_sessions', 'last_signal_at', 'TIMESTAMP')

    users_needing_ids = conn.execute('''
        SELECT id
        FROM users
        WHERE public_user_id IS NULL OR TRIM(public_user_id) = ''
           OR referral_code IS NULL OR TRIM(referral_code) = ''
    ''').fetchall()

    for user in users_needing_ids:
        conn.execute('''
            UPDATE users
            SET public_user_id = COALESCE(NULLIF(TRIM(public_user_id), ''), ?),
                referral_code = COALESCE(NULLIF(TRIM(referral_code), ''), ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            build_public_user_id(user['id']),
            build_referral_code(user['id']),
            user['id']
        ))


def init_db():
    conn = sqlite3.connect(get_database_path())
    conn.execute('PRAGMA foreign_keys = ON')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # قراءة ملف SQL
    with open('database_schema.sql', 'r', encoding='utf-8') as f:
        schema = f.read()
        cursor.executescript(schema)

    ensure_database_compatibility(conn)
    
    # إدخال البيانات الأساسية
    insert_default_data(conn)
    
    conn.commit()
    conn.close()
    print("[OK] Database initialized successfully!")


def is_obvious_placeholder_wallet_address(address):
    value = str(address or '').strip()
    if not value:
        return False

    lowered = value.lower()
    if any(token in lowered for token in ('placeholder', 'dummy', 'sample-wallet', 'demo-wallet', 'fake-wallet')):
        return True

    for prefix in ('0x', 'bnb', 'bc1', 'tb1', 't', '1'):
        body = value[len(prefix):] if lowered.startswith(prefix) else value
        normalized_body = re.sub(r'[\s\-_]', '', body)
        if len(normalized_body) >= 8 and set(normalized_body.upper()) == {'X'}:
            return True

    normalized_value = re.sub(r'[\s\-_]', '', value)
    return len(normalized_value) >= 8 and set(normalized_value.upper()) == {'X'}


def cleanup_legacy_placeholder_admin_wallets(conn):
    wallets = conn.execute('''
        SELECT id, address, current_balance, total_received, total_sent
        FROM admin_wallets
    ''').fetchall()

    removable_wallet_ids = []
    removable_addresses = []

    for wallet in wallets:
        address = str(wallet['address'] or '').strip()
        if not is_obvious_placeholder_wallet_address(address):
            continue

        has_balance_activity = any(float(wallet[key] or 0) > 0 for key in ('current_balance', 'total_received', 'total_sent'))
        tx_count = conn.execute('''
            SELECT COUNT(*) AS count
            FROM transactions
            WHERE admin_wallet_address = ?
        ''', (address,)).fetchone()['count']

        if has_balance_activity or tx_count > 0:
            continue

        removable_wallet_ids.append(int(wallet['id']))
        removable_addresses.append(address)

    if removable_wallet_ids:
        conn.executemany(
            'DELETE FROM admin_wallets WHERE id = ?',
            [(wallet_id,) for wallet_id in removable_wallet_ids]
        )
        conn.executemany('''
            UPDATE user_wallets
            SET address = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE address = ?
        ''', [(address,) for address in sorted(set(removable_addresses))])

    return len(removable_wallet_ids)


def normalize_network_catalog(conn):
    network_rows = conn.execute('''
        SELECT id, currency_id, UPPER(TRIM(code)) AS normalized_code
        FROM networks
        WHERE currency_id IS NOT NULL
          AND TRIM(COALESCE(code, '')) != ''
        ORDER BY id
    ''').fetchall()

    grouped_network_ids = {}
    for row in network_rows:
        key = (int(row['currency_id']), str(row['normalized_code']))
        grouped_network_ids.setdefault(key, []).append(int(row['id']))

    reference_tables = [
        'admin_wallets',
        'transactions',
        'withdrawal_requests',
        'wallet_profiles',
        'financial_channels',
        'real_crypto_wallet_pool',
        'real_user_wallets',
        'real_wallet_generation_counters',
        'withdrawal_verification_codes',
    ]
    reference_tables = [
        table_name
        for table_name in reference_tables
        if table_exists(conn, table_name) and column_exists(conn, table_name, 'network_id')
    ]

    removed_count = 0
    for duplicate_ids in grouped_network_ids.values():
        canonical_id = duplicate_ids[0]
        for duplicate_id in duplicate_ids[1:]:
            for table_name in reference_tables:
                conn.execute(
                    f'UPDATE OR IGNORE {table_name} SET network_id = ? WHERE network_id = ?',
                    (canonical_id, duplicate_id)
                )

            remaining_references = 0
            for table_name in reference_tables:
                remaining_references += int(conn.execute(
                    f'SELECT COUNT(*) AS count FROM {table_name} WHERE network_id = ?',
                    (duplicate_id,)
                ).fetchone()['count'])

            if remaining_references == 0:
                conn.execute('DELETE FROM networks WHERE id = ?', (duplicate_id,))
                removed_count += 1

    try:
        conn.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_networks_currency_code_unique
            ON networks(currency_id, code)
        ''')
    except sqlite3.IntegrityError:
        pass

    return removed_count


def normalize_admin_wallet_network_scope(conn):
    wallet_rows = conn.execute('''
        SELECT
            a.id,
            a.currency_id,
            c.code AS currency_code,
            a.network_id,
            n.code AS network_code,
            n.currency_id AS network_currency_id
        FROM admin_wallets a
        LEFT JOIN currencies c ON c.id = a.currency_id
        LEFT JOIN networks n ON n.id = a.network_id
    ''').fetchall()

    alias_map = {
        'ETH': ['ETH', 'ERC20'],
        'BNB': ['BSC', 'BEP20'],
        'USDT': ['TRC20', 'ERC20', 'BEP20'],
        'BTC': ['BTC'],
        'TRX': ['TRON', 'TRC20'],
    }

    fixed_count = 0
    for wallet in wallet_rows:
        if not wallet['currency_id'] or not wallet['network_id']:
            continue
        if int(wallet['currency_id']) == int(wallet['network_currency_id'] or 0):
            continue

        currency_code = str(wallet['currency_code'] or '').upper().strip()
        existing_network_code = str(wallet['network_code'] or '').upper().strip()
        candidate_codes = []
        if existing_network_code:
            candidate_codes.append(existing_network_code)
        candidate_codes.extend(alias_map.get(currency_code, []))

        replacement_network = None
        for candidate_code in candidate_codes:
            replacement_network = conn.execute('''
                SELECT id
                FROM networks
                WHERE currency_id = ? AND UPPER(COALESCE(code, '')) = ?
                ORDER BY id
                LIMIT 1
            ''', (wallet['currency_id'], candidate_code)).fetchone()
            if replacement_network:
                break

        if not replacement_network:
            replacement_network = conn.execute('''
                SELECT id
                FROM networks
                WHERE currency_id = ?
                ORDER BY id
                LIMIT 1
            ''', (wallet['currency_id'],)).fetchone()

        if replacement_network and int(replacement_network['id']) != int(wallet['network_id']):
            conn.execute('''
                UPDATE admin_wallets
                SET network_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (replacement_network['id'], wallet['id']))
            fixed_count += 1

    return fixed_count


def ensure_chain_compatible_token_admin_wallets(conn):
    currency_rows = conn.execute('SELECT id, UPPER(code) AS code FROM currencies WHERE is_active = 1').fetchall()
    currency_id_by_code = {str(row['code']): int(row['id']) for row in currency_rows}

    target_configs = [
        {
            'target_currency': 'USDT',
            'target_network': 'ERC20',
            'source_network_codes': ['ETH', 'ERC20'],
            'label': 'USDT ERC20',
        },
        {
            'target_currency': 'USDT',
            'target_network': 'BEP20',
            'source_network_codes': ['BSC', 'BEP20'],
            'label': 'USDT BEP20',
        },
        {
            'target_currency': 'USDT',
            'target_network': 'TRC20',
            'source_network_codes': ['TRON', 'TRC20'],
            'label': 'USDT TRC20',
        },
    ]

    created_count = 0
    for config in target_configs:
        target_currency_id = currency_id_by_code.get(config['target_currency'])
        if not target_currency_id:
            continue

        target_network = conn.execute('''
            SELECT id
            FROM networks
            WHERE currency_id = ? AND UPPER(COALESCE(code, '')) = ?
            ORDER BY id
            LIMIT 1
        ''', (target_currency_id, config['target_network'])).fetchone()
        if not target_network:
            continue

        existing_target_wallet = conn.execute('''
            SELECT id
            FROM admin_wallets
            WHERE currency_id = ? AND network_id = ? AND is_active = 1
            LIMIT 1
        ''', (target_currency_id, target_network['id'])).fetchone()
        if existing_target_wallet:
            continue

        placeholders = ', '.join(['?'] * len(config['source_network_codes']))
        source_wallet = conn.execute(f'''
            SELECT a.address, a.label
            FROM admin_wallets a
            JOIN networks n ON n.id = a.network_id
            WHERE a.is_active = 1
              AND TRIM(COALESCE(a.address, '')) != ''
              AND UPPER(COALESCE(n.code, '')) IN ({placeholders})
            ORDER BY a.id
            LIMIT 1
        ''', config['source_network_codes']).fetchone()
        if not source_wallet:
            continue

        conn.execute('''
            INSERT INTO admin_wallets (currency_id, network_id, address, label, is_active)
            VALUES (?, ?, ?, ?, 1)
        ''', (
            target_currency_id,
            target_network['id'],
            source_wallet['address'],
            config['label']
        ))
        created_count += 1

    return created_count

def insert_default_data(conn):
    cursor = conn.cursor()
    
    # العملات الافتراضية
    currencies = [
        ('USDT', 'Tether', '₮', 1, 5, 5),
        ('BTC', 'Bitcoin', '₿', 1, 0.001, 0.002),
        ('ETH', 'Ethereum', 'Ξ', 1, 0.01, 0.02),
        ('BNB', 'Binance Coin', 'BNB', 1, 0.0001, 0.2),
        ('TRX', 'Tron', 'TRX', 1, 100, 200)
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO currencies (code, name, symbol, is_active, min_deposit, min_withdraw)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', currencies)

    cursor.execute('''
        UPDATE currencies
        SET min_deposit = 5, min_withdraw = 5, updated_at = CURRENT_TIMESTAMP
        WHERE code = 'USDT'
    ''')

    # الشبكات - ربط ديناميكي برمز العملة لضمان السلامة المرجعية للمفاتيح الأجنبية
    curr_map = {row[1].upper(): row[0] for row in cursor.execute("SELECT id, UPPER(code) FROM currencies").fetchall()}
    
    networks_data = [
        ('USDT', 'TRC20', 'TRC20', 0.0, 1.0, 1.0),   # USDT TRC20
        ('USDT', 'ERC20', 'ERC20', 0.0, 5.0, 5.0),   # USDT ERC20
        ('USDT', 'BEP20', 'BEP20', 0.0, 0.5, 0.5),   # USDT BEP20
        ('BTC', 'Bitcoin', 'BTC', 0.0, 0.0001, 0.0002),  # BTC
        ('ETH', 'Ethereum', 'ETH', 0.0, 0.001, 0.002),   # ETH
        ('BNB', 'BSC', 'BSC', 0.0, 0.01, 0.0001),        # BNB
        ('TRX', 'Tron', 'TRX', 0.0, 0.1, 0.2)           # TRX
    ]
    
    for curr_code, name, code, fee_percentage, fee_fixed, min_amount in networks_data:
        currency_id = curr_map.get(curr_code.upper())
        if currency_id:
            cursor.execute('''
                INSERT INTO networks (currency_id, name, code, fee_percentage, fee_fixed, min_amount)
                SELECT ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM networks
                    WHERE currency_id = ?
                      AND UPPER(COALESCE(code, '')) = UPPER(?)
                )
            ''', (
                currency_id,
                name,
                code,
                fee_percentage,
                fee_fixed,
                min_amount,
                currency_id,
                code
            ))

    governorates = [
        ('حلب', 'aleppo', 'قلعة حلب والأسواق التاريخية', 'مدينة التجارة والصناعة والتراث العمراني.', 'https://source.unsplash.com/1600x900/?Aleppo,Syria,castle', 'SY', 'سوريا'),
        ('حمص', 'homs', 'قلب سوريا ونهر العاصي', 'موقع وسطي مناسب للمشاريع السكنية والخدمية.', 'https://source.unsplash.com/1600x900/?Homs,Syria,city', 'SY', 'سوريا'),
        ('دمشق', 'damascus', 'الياسمين والمدينة القديمة', 'العاصمة ومركز الطلب السكني والتجاري.', 'https://source.unsplash.com/1600x900/?Damascus,Syria,old-city', 'SY', 'سوريا'),
        ('ريف دمشق', 'rif-dimashq', 'الغوطة والامتداد العمراني', 'فرص توسع عقاري حول العاصمة.', 'https://source.unsplash.com/1600x900/?Damascus,Syria,suburbs', 'SY', 'سوريا'),
        ('حماة', 'hama', 'النواعير والعاصي', 'مدينة ذات هوية تراثية وسوق محلي مستقر.', 'https://source.unsplash.com/1600x900/?Hama,Syria,noria', 'SY', 'سوريا'),
        ('اللاذقية', 'latakia', 'الساحل والبحر', 'مشاريع سكنية وسياحية على الساحل السوري.', 'https://source.unsplash.com/1600x900/?Latakia,Syria,sea', 'SY', 'سوريا'),
        ('طرطوس', 'tartus', 'الميناء والساحل', 'فرص عقارية وتجارية مرتبطة بالبحر والمرافئ.', 'https://source.unsplash.com/1600x900/?Tartus,Syria,coast', 'SY', 'سوريا'),
        ('إدلب', 'idlib', 'الزيتون والسهول', 'منطقة زراعية وعمرانية واعدة.', 'https://source.unsplash.com/1600x900/?Idlib,Syria,olive', 'SY', 'سوريا'),
        ('درعا', 'daraa', 'حوران والقمح', 'بوابة الجنوب ومركز زراعي وتجاري.', 'https://source.unsplash.com/1600x900/?Daraa,Syria,wheat', 'SY', 'سوريا'),
        ('السويداء', 'as-suwayda', 'الجبل والحجر البازلتي', 'هوية عمرانية مميزة وفرص سكنية هادئة.', 'https://source.unsplash.com/1600x900/?Suwayda,Syria,mountain', 'SY', 'سوريا'),
        ('القنيطرة', 'quneitra', 'الجولان والطبيعة', 'طبيعة مفتوحة وفرص تطوير مستقبلية.', 'https://source.unsplash.com/1600x900/?Quneitra,Syria,nature', 'SY', 'سوريا'),
        ('دير الزور', 'deir-ez-zor', 'الفرات والجسر المعلق', 'موقع اقتصادي مهم على نهر الفرات.', 'https://source.unsplash.com/1600x900/?Deir-ez-Zor,Syria,euphrates', 'SY', 'سوريا'),
        ('الرقة', 'raqqa', 'الفرات والسهول', 'موقع زراعي وعمراني واسع.', 'https://source.unsplash.com/1600x900/?Raqqa,Syria,euphrates', 'SY', 'سوريا'),
        ('الحسكة', 'al-hasakah', 'الجزيرة والقمح', 'مركز زراعي وتجاري في شمال شرق سوريا.', 'https://source.unsplash.com/1600x900/?Hasakah,Syria,wheat', 'SY', 'سوريا'),
        ('الرياض - السعودية', 'riyadh-saudi-arabia', 'الرياض', 'عاصمة مالية وتجارية تستقطب التطوير السكني والمكتبي.', 'https://source.unsplash.com/1600x900/?Riyadh,Saudi-Arabia,skyline', 'SA', 'السعودية'),
        ('جدة - السعودية', 'jeddah-saudi-arabia', 'جدة', 'سوق ساحلي قوي للعقارات السكنية والتجارية والضيافة.', 'https://source.unsplash.com/1600x900/?Jeddah,Saudi-Arabia,sea', 'SA', 'السعودية'),
        ('دبي - الإمارات', 'dubai-uae', 'دبي', 'مدينة عالية السيولة وجذابة للاستثمار السكني والتجاري.', 'https://source.unsplash.com/1600x900/?Dubai,UAE,skyline', 'AE', 'الإمارات العربية المتحدة'),
        ('أبوظبي - الإمارات', 'abu-dhabi-uae', 'أبوظبي', 'فرص متوازنة بين العقارات المؤسسية والسكنية الراقية.', 'https://source.unsplash.com/1600x900/?Abu-Dhabi,UAE,city', 'AE', 'الإمارات العربية المتحدة'),
        ('الدوحة - قطر', 'doha-qatar', 'الدوحة', 'سوق حضري حديث يركز على المجمعات السكنية والتجارية.', 'https://source.unsplash.com/1600x900/?Doha,Qatar,skyline', 'QA', 'قطر'),
        ('مدينة الكويت - الكويت', 'kuwait-city-kuwait', 'الكويت', 'طلب مرتفع على المشاريع السكنية والخدمية داخل المدينة.', 'https://source.unsplash.com/1600x900/?Kuwait-City,Kuwait,city', 'KW', 'الكويت'),
        ('المنامة - البحرين', 'manama-bahrain', 'المنامة', 'فرص مرنة في سوق صغير سريع الحركة والتمويل.', 'https://source.unsplash.com/1600x900/?Manama,Bahrain,city', 'BH', 'البحرين'),
        ('مسقط - عُمان', 'muscat-oman', 'مسقط', 'سوق عقاري هادئ ومستقر للعائلات والمشاريع الساحلية.', 'https://source.unsplash.com/1600x900/?Muscat,Oman,coast', 'OM', 'عُمان'),
        ('عمّان - الأردن', 'amman-jordan', 'عمّان', 'مركز سكني وتعليمي وخدمي يجذب الطلب المتوسط والطويل.', 'https://source.unsplash.com/1600x900/?Amman,Jordan,city', 'JO', 'الأردن'),
        ('بيروت - لبنان', 'beirut-lebanon', 'بيروت', 'واجهة بحرية وسوق مركزي للعقارات الراقية والتجارية.', 'https://source.unsplash.com/1600x900/?Beirut,Lebanon,coast', 'LB', 'لبنان'),
        ('بغداد - العراق', 'baghdad-iraq', 'بغداد', 'سوق كثيف السكان مع طلب واضح على السكن والمحال.', 'https://source.unsplash.com/1600x900/?Baghdad,Iraq,city', 'IQ', 'العراق'),
        ('البصرة - العراق', 'basra-iraq', 'البصرة', 'فرص لوجستية وتجارية مرتبطة بالموانئ والطاقة.', 'https://source.unsplash.com/1600x900/?Basra,Iraq,port', 'IQ', 'العراق'),
        ('القاهرة - مصر', 'cairo-egypt', 'القاهرة', 'سوق ضخم للاستثمار السكني المتدرج والمكتبي.', 'https://source.unsplash.com/1600x900/?Cairo,Egypt,skyline', 'EG', 'مصر'),
        ('الإسكندرية - مصر', 'alexandria-egypt', 'الإسكندرية', 'طلب سياحي وسكني على الواجهة البحرية والمناطق المخدومة.', 'https://source.unsplash.com/1600x900/?Alexandria,Egypt,sea', 'EG', 'مصر'),
        ('إسطنبول - تركيا', 'istanbul-turkey', 'إسطنبول', 'سوق كبير متعدد الشرائح يدمج السكن والتجارة والضيافة.', 'https://source.unsplash.com/1600x900/?Istanbul,Turkey,bosphorus', 'TR', 'تركيا'),
        ('أنقرة - تركيا', 'ankara-turkey', 'أنقرة', 'فرص مستقرة في المشاريع السكنية والإدارية.', 'https://source.unsplash.com/1600x900/?Ankara,Turkey,city', 'TR', 'تركيا'),
        ('طهران - إيران', 'tehran-iran', 'طهران', 'حضور قوي للمشاريع السكنية والمكتبية ضمن مدينة كثيفة.', 'https://source.unsplash.com/1600x900/?Tehran,Iran,city', 'IR', 'إيران'),
        ('تبريز - إيران', 'tabriz-iran', 'تبريز', 'سوق محلي نشط للمشاريع السكنية والتجارية المتوسطة.', 'https://source.unsplash.com/1600x900/?Tabriz,Iran,city', 'IR', 'إيران'),
        ('صنعاء - اليمن', 'sanaa-yemen', 'صنعاء', 'فرص تتركز في الأصول السكنية والمباني القائمة.', 'https://source.unsplash.com/1600x900/?Sanaa,Yemen,city', 'YE', 'اليمن'),
        ('عدن - اليمن', 'aden-yemen', 'عدن', 'مدينة ساحلية مناسبة للعقارات التجارية والخدمية.', 'https://source.unsplash.com/1600x900/?Aden,Yemen,port', 'YE', 'اليمن'),
        ('القدس - فلسطين', 'jerusalem-palestine', 'القدس', 'طلب تاريخي وسياحي وخدمي ضمن نسيج عمراني حساس.', 'https://source.unsplash.com/1600x900/?Jerusalem,Palestine,city', 'PS', 'فلسطين'),
        ('رام الله - فلسطين', 'ramallah-palestine', 'رام الله', 'مركز إداري واقتصادي مناسب للمشاريع السكنية والمكتبية.', 'https://source.unsplash.com/1600x900/?Ramallah,Palestine,city', 'PS', 'فلسطين')
    ]

    cursor.executemany('''
        INSERT OR IGNORE INTO governorates (name, slug, symbol, description, image_url, country_code, country_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', governorates)
    cursor.executemany('''
        UPDATE governorates
        SET country_code = ?, country_name = ?
        WHERE slug = ?
    ''', [(item[5], item[6], item[1]) for item in governorates])
    
    # إعدادات النظام
    settings = [
        ('site_title', 'سوريا العقارية', 'string', 'general', 'عنوان الموقع'),
        ('site_description', 'منصة استثمار عقاري رقمية', 'string', 'general', 'وصف الموقع'),
        ('site_background_image', '/static/images/hero-city-investment.png', 'string', 'general', 'الخلفية الافتراضية للموقع'),
        ('company_accounts_enabled', 'true', 'boolean', 'general', 'تفعيل أو إيقاف تسجيل حسابات الشركات'),
        ('hero_badge_text', 'فرص عقارية موزعة على المحافظات السورية', 'string', 'marketing', 'الشارة أعلى الواجهة الرئيسية'),
        ('hero_title', 'استثمر في عقارات سوريا برؤية أوضح وتجربة أحدث', 'string', 'marketing', 'عنوان الواجهة الرئيسية'),
        ('hero_description', 'منصة رقمية تجمع المشاريع العقارية حسب المحافظة، وتعرض لكل منطقة قصتها وصورتها وفرصها الاستثمارية، مع إدارة دفع رقمي ومتابعة مباشرة من مكان واحد.', 'string', 'marketing', 'وصف الواجهة الرئيسية'),
        ('hero_primary_cta', 'تصفح المشاريع', 'string', 'marketing', 'نص الزر الرئيسي'),
        ('hero_secondary_cta', 'افتح حسابك', 'string', 'marketing', 'نص الزر الثانوي'),
        ('home_video_enabled', 'false', 'boolean', 'marketing', 'تفعيل فيديو الشرح في الصفحة الرئيسية'),
        ('home_video_url', '', 'string', 'marketing', 'رابط فيديو الشرح في الصفحة الرئيسية'),
        ('wallet_video_enabled', 'false', 'boolean', 'marketing', 'تفعيل فيديو الشرح في قسم المحفظة'),
        ('wallet_video_url', '', 'string', 'marketing', 'رابط فيديو الشرح في قسم المحفظة'),
        ('hero_panel_title', 'كيف تظهر التجربة للمستثمر؟', 'string', 'marketing', 'عنوان الصندوق الجانبي'),
        ('hero_highlights', json.dumps([
            {'value': '14 محافظة', 'label': 'كل محافظة تظهر بهوية وصورة وفرص استثمارية خاصة'},
            {'value': 'دفع رقمي', 'label': 'إدارة المحافظ والعملات والشبكات من داخل المنصة'},
            {'value': 'لوحة مدير', 'label': 'تحكم مباشر بالمحتوى والمشاريع والمحافظات'}
        ], ensure_ascii=False), 'json', 'marketing', 'بطاقات المؤشرات في الواجهة الرئيسية'),
        ('hero_panel_items', json.dumps([
            {'icon': 'fas fa-image', 'title': 'خلفية مرتبطة بالمحافظة', 'description': 'عند اختيار محافظة تتبدل هوية الواجهة لتعطي المستثمر إحساساً بالمكان.'},
            {'icon': 'fas fa-filter', 'title': 'تصفية سريعة وواضحة', 'description': 'الوصول إلى المشاريع العقارية حسب المحافظة بدون تشتيت أو خطوات طويلة.'},
            {'icon': 'fas fa-wallet', 'title': 'تمويل ومتابعة من مكان واحد', 'description': 'إيداع وسحب واستثمار مع مؤشرات واضحة ورسوم وشبكات مدعومة.'}
        ], ensure_ascii=False), 'json', 'marketing', 'عناصر صندوق الشرح الجانبي'),
        ('investor_focus_title', 'منصة تعطي صورة أوضح قبل اتخاذ القرار', 'string', 'marketing', 'عنوان رسالة الثقة للمستثمر'),
        ('investor_focus_text', 'نعرض المحافظة، المشروع، حالة التمويل، والجاهزية التشغيلية بلغة مباشرة تساعد المستثمر على فهم الفرصة بسرعة ومن دون غموض.', 'string', 'marketing', 'نص رسالة الثقة للمستثمر'),
        ('investor_focus_points', json.dumps([
            'خلفية بصرية مرتبطة بالمحافظة المختارة',
            'تفاصيل تمويل وعائد ومدة داخل عرض واحد',
            'إمكانية تحديث الرسائل التسويقية من إعدادات الأدمن'
        ], ensure_ascii=False), 'json', 'marketing', 'نقاط الثقة للمستثمر'),
        ('why_us_title', 'واجهة حديثة، مشاريع أوضح، وقرار استثماري أسهل', 'string', 'marketing', 'عنوان قسم لماذا نحن'),
        ('why_us_description', 'صممنا التجربة لتكون عملية للمستثمر وللإدارة معاً: عرض مرتب للمشاريع، محافظات مخصصة، ومدفوعات رقمية قابلة للإدارة والمتابعة.', 'string', 'marketing', 'وصف قسم لماذا نحن'),
        ('why_us_kicker', 'منصة موجهة للاستثمار العقاري السوري', 'string', 'marketing', 'الشارة العليا في قسم لماذا نحن'),
        ('why_us_hero_panel_badge', 'لمحة سريعة', 'string', 'marketing', 'شارة الصندوق الجانبي في قسم لماذا نحن'),
        ('why_us_hero_panel_title', 'القسم هذا يشرح لماذا المنصة تبدو أكثر وضوحًا وإقناعًا للمستثمر.', 'string', 'marketing', 'عنوان الصندوق الجانبي في قسم لماذا نحن'),
        ('why_us_metrics', json.dumps([
            {'label': 'وضوح القرار', 'value': 'أعلى'},
            {'label': 'عدد الخطوات', 'value': 'أقل'},
            {'label': 'عرض المعلومات', 'value': 'أسرع'}
        ], ensure_ascii=False), 'json', 'marketing', 'مؤشرات الصندوق الجانبي في قسم لماذا نحن'),
        ('why_us_items', json.dumps([
            {
                'icon': 'fas fa-map-marked-alt',
                'title': 'محافظات بهوية بصرية',
                'summary': 'كل محافظة يمكن أن تظهر بصورة ورمز ووصف يشجع المستثمر على فهم المكان قبل الاستثمار.',
                'details': 'المنصة لا تعرض اسم المحافظة فقط، بل تمنحها حضوراً بصرياً ورسالة تسويقية تجعل كل فرصة مرتبطة بسياقها المحلي.',
                'points': ['صورة مخصصة لكل محافظة', 'وصف استثماري مختصر وواضح', 'استمرار الهوية البصرية عبر الصفحة']
            },
            {
                'icon': 'fas fa-layer-group',
                'title': 'مشاريع منظمة بوضوح',
                'summary': 'المشاريع تظهر بمؤشرات التمويل والعائد والمدة وعدد المستثمرين بشكل سريع وقابل للمقارنة.',
                'details': 'بدلاً من عرض تقليدي، يحصل المستثمر على لوحة قرار سريعة تساعده في المقارنة واكتشاف الفرص الأقرب إلى أهدافه.',
                'points': ['نسبة التمويل الحالية', 'مدة الاستثمار والعائد المتوقع', 'عرض منظم قابل للمقارنة']
            },
            {
                'icon': 'fas fa-wallet',
                'title': 'تمويل رقمي عملي',
                'summary': 'إدارة الشبكات والعملات والمحافظ وطلبات الإيداع والسحب من داخل لوحة واحدة.',
                'details': 'التجربة المالية مصممة لتكون مباشرة وواضحة، مع شبكات متعددة ورسائل توضح ما يحتاجه المستثمر في كل خطوة.',
                'points': ['محافظ وشبكات متعددة', 'طلبات إيداع وسحب منظمة', 'تجربة تشغيلية قابلة للتوسع']
            },
            {
                'icon': 'fas fa-user-cog',
                'title': 'تحكم كامل للأدمن',
                'summary': 'المدير يضيف المحافظات، يفعّلها أو يعطلها، ويحدد المشاريع التي تظهر للمستخدمين.',
                'details': 'واجهة الإدارة أصبحت أساساً لتطوير المحتوى التسويقي أيضاً، بحيث يمكن تحسين الرسائل والبطاقات الرئيسية لاحقاً من الإعدادات.',
                'points': ['إدارة المحافظات وحالتها', 'إضافة المشاريع وربطها بالمحافظات', 'تجهيز إعدادات المحتوى التسويقي']
            }
        ], ensure_ascii=False), 'json', 'marketing', 'عناصر قسم لماذا نحن'),
        ('why_us_proof_items', json.dumps([
            {'icon': 'fas fa-layer-group', 'title': 'تجربة مرتبة', 'description': 'المنصة تعرض الرحلة من الاستكشاف حتى التمويل ضمن منطق بصري واضح ومختصر.'},
            {'icon': 'fas fa-map-location-dot', 'title': 'سياق محلي', 'description': 'المحافظات تظهر كفرص لها صورة ورسالة وهوية، وليس فقط كخيارات داخل قائمة.'},
            {'icon': 'fas fa-chart-column', 'title': 'مقارنة أسرع', 'description': 'العائد والمدة والتمويل تظهر بصريًا بطريقة تسهّل الحكم الأولي على أي فرصة.'}
        ], ensure_ascii=False), 'json', 'marketing', 'بطاقات الإثبات في قسم لماذا نحن'),
        ('why_us_trust_signals_intro', json.dumps({
            'kicker': 'إشارات الثقة',
            'title': 'مؤشرات مؤسسية تعطي انطباعًا أقوى للمستثمر',
            'description': 'هذه الطبقة تضيف إشارات مهنية شبيهة بالشركات الكبيرة: وضوح تشغيلي، حوكمة أفضل، وتواصل أكثر تنظيمًا.'
        }, ensure_ascii=False), 'json', 'marketing', 'مقدمة إشارات الثقة في قسم لماذا نحن'),
        ('why_us_trust_signals', json.dumps([
            {'value': 'حوكمة أوضح', 'label': 'لغة مؤسسية', 'description': 'عرض المعلومات المهمة ضمن بنية مرتبة تشبه منصات الاستثمار الاحترافية.'},
            {'value': 'مسار مفهوم', 'label': 'من التسجيل حتى التمويل', 'description': 'المستخدم يرى كيف يبدأ، أين يودع، وكيف يتابع استثماره من مكان واحد.'},
            {'value': 'تواصل موثق', 'label': 'رسائل ودعم وإشعارات', 'description': 'وجود قنوات دعم واضحة ورسائل داخلية يزيد الثقة قبل اتخاذ القرار.'}
        ], ensure_ascii=False), 'json', 'marketing', 'إشارات الثقة في قسم لماذا نحن'),
        ('why_us_operational_steps_intro', json.dumps({
            'kicker': 'رحلة التشغيل',
            'title': 'كيف تسير التجربة من التسجيل حتى المتابعة؟',
            'description': 'شرح تشغيلي مباشر يوضح كيف تنتقل الرحلة بين الحساب والمحفظة والاستثمار والدعم.'
        }, ensure_ascii=False), 'json', 'marketing', 'مقدمة رحلة التشغيل في قسم لماذا نحن'),
        ('why_us_operational_steps', json.dumps([
            {'title': 'إنشاء الحساب والتحقق', 'description': 'فتح الحساب، توثيق البريد، ثم تفعيل الوصول إلى المسار المالي داخل المنصة.', 'meta': 'الخطوة 01'},
            {'title': 'إدارة المحفظة والتمويل', 'description': 'اختيار العملة والشبكة وعنوان الإيداع، ثم متابعة الرصيد والحركات من واجهة واحدة.', 'meta': 'الخطوة 02'},
            {'title': 'اختيار الفرصة المناسبة', 'description': 'مقارنة المشاريع حسب المنطقة والعائد والتمويل والصور قبل تنفيذ القرار.', 'meta': 'الخطوة 03'},
            {'title': 'المتابعة والدعم', 'description': 'العودة إلى المعاملات والرسائل والإشعارات لمتابعة كل خطوة بعد التنفيذ.', 'meta': 'الخطوة 04'}
        ], ensure_ascii=False), 'json', 'marketing', 'خطوات رحلة التشغيل في قسم لماذا نحن'),
        ('why_us_showcase_kicker', 'محاور التجربة', 'string', 'marketing', 'شارة محور التجربة في قسم لماذا نحن'),
        ('why_us_showcase_title', 'ما الذي سيراه المستثمر داخل الواجهة؟', 'string', 'marketing', 'عنوان محور التجربة في قسم لماذا نحن'),
        ('why_us_showcase_description', 'العناصر التالية تبين كيف صُممت المنصة لتقليل التشتيت وإبراز القرار الاستثماري من أول نظرة.', 'string', 'marketing', 'وصف محور التجربة في قسم لماذا نحن'),
        ('why_us_section_guides_intro', json.dumps({
            'kicker': 'شرح الأقسام',
            'title': 'كل قسم مهم في المنصة من مكان واحد',
            'description': 'اختر القسم الذي تريد فهمه، وستظهر لك فكرته، فائدته، وما الذي يمكن فعله داخله مع زر انتقال مباشر.'
        }, ensure_ascii=False), 'json', 'marketing', 'مقدمة شرح الأقسام في قسم لماذا نحن'),
        ('why_us_section_guides', json.dumps([
            {
                'key': 'investments',
                'icon': 'fas fa-building',
                'title': 'قسم المشاريع',
                'summary': 'استكشاف المشاريع حسب المحافظة مع مقارنة أوضح بين العائد والمدة ونسبة التمويل.',
                'description': 'هذا القسم هو نقطة القرار الأساسية للمستثمر. فيه يرى صورة المشروع، تفاصيله، نسبة التمويل الحالية، المدة، العائد، وعدد المستثمرين قبل أن يضغط على استثمر الآن.',
                'points': ['اختيار المحافظة ثم مشاهدة المشاريع المرتبطة بها', 'إظهار صورة المشروع وخطته الزمنية ونسبة التمويل', 'زر استثمار مباشر عند توفر الرصيد'],
                'section': 'investments',
                'actionLabel': 'فتح المشاريع'
            },
            {
                'key': 'wallet',
                'icon': 'fas fa-wallet',
                'title': 'قسم المحفظة',
                'summary': 'إدارة الرصيد والعنوان والشبكة والإيداع والسحب والتحويل الداخلي من مكان واحد.',
                'description': 'المحفظة هي مركز الحركة المالي داخل المنصة. من هنا يتابع المستخدم رصيده، عنوانه، QR، الشبكات المدعومة، والإجراءات المالية الأساسية.',
                'points': ['عرض الرصيد والعنوان وQR بشكل واضح', 'اختيار العملة والشبكة بسرعة', 'تنفيذ إيداع أو سحب أو تحويل داخلي'],
                'section': 'wallet',
                'actionLabel': 'فتح المحفظة'
            },
            {
                'key': 'transactions',
                'icon': 'fas fa-right-left',
                'title': 'قسم المعاملات',
                'summary': 'سجل مرتب للإيداعات والسحوبات والاستثمارات وحالة كل عملية.',
                'description': 'هذا القسم يعرض للمستخدم كل ما حدث في حسابه المالي بشكل زمني منظم، مع نوع العملية وحالتها والعملة والشبكة والملاحظات المرتبطة بها.',
                'points': ['عرض نوع العملية وتاريخها', 'إظهار الحالة: مكتمل أو معلق أو مرفوض', 'مرجع واضح للمتابعة والمراجعة'],
                'section': 'transactions',
                'actionLabel': 'فتح المعاملات'
            }
        ], ensure_ascii=False), 'json', 'marketing', 'بطاقات شرح الأقسام في قسم لماذا نحن'),
        ('why_us_side_badge', 'أسباب الثقة', 'string', 'marketing', 'شارة العمود الجانبي في قسم لماذا نحن'),
        ('why_us_side_title', 'ما الذي يجعل المنصة أكثر إقناعًا للمستثمر؟', 'string', 'marketing', 'عنوان العمود الجانبي في قسم لماذا نحن'),
        ('why_us_side_description', 'كل جزء في الواجهة مصمم ليقلل التردد: صورة أوضح، أرقام أسرع، وحركة أقل بين الحساب والمحفظة والمشاريع.', 'string', 'marketing', 'وصف العمود الجانبي في قسم لماذا نحن'),
        ('why_us_side_stats', json.dumps([
            {'title': 'واجهة موحدة', 'description': 'المحفظة والمشاريع والمعاملات ضمن مسار واحد'},
            {'title': 'هوية محلية', 'description': 'المحافظات ليست أسماء فقط، بل سياق بصري وتسويقي'},
            {'title': 'قرار أسرع', 'description': 'نسب التمويل والعائد والمدة مرئية بوضوح من أول نظرة'}
        ], ensure_ascii=False), 'json', 'marketing', 'بطاقات العمود الجانبي في قسم لماذا نحن'),
        ('why_us_side_footer', json.dumps([
            {'label': 'النتيجة', 'value': 'ثقة أعلى قبل الضغط على "استثمر الآن"'},
            {'label': 'المسار', 'value': 'استكشاف، مقارنة، ثم قرار'}
        ], ensure_ascii=False), 'json', 'marketing', 'تذييل العمود الجانبي في قسم لماذا نحن'),
        ('footer_description', 'منصة استثمار عقاري رقمية تعرض مشاريع المحافظات السورية بطريقة أوضح، مع إدارة المحافظ الرقمية والتمويل من واجهة واحدة.', 'string', 'marketing', 'وصف الفوتر'),
        ('trust_center_kicker', 'الثقة والقانون والتشغيل', 'string', 'marketing', 'الشارة العليا في مركز الثقة'),
        ('trust_center_title', 'كل ما يحتاجه المستثمر لفهم المنصة قبل التمويل', 'string', 'marketing', 'عنوان مركز الثقة'),
        ('trust_center_description', 'نعرض هنا كيف تعمل المنصة، كيف نتعامل مع البيانات، وما هي حدود المخاطر والتشغيل، حتى تكون الصورة أوضح قبل اتخاذ أي قرار.', 'string', 'marketing', 'وصف مركز الثقة'),
        ('trust_center_stats', json.dumps([
            {'label': 'الشفافية', 'value': 'سياسات واضحة', 'description': 'خصوصية، استخدام، ومخاطر بلغة مباشرة'},
            {'label': 'الدعم', 'value': 'قنوات اتصال', 'description': 'رسائل داخلية، بريد، ومتابعة من نفس المنصة'},
            {'label': 'التشغيل', 'value': 'رحلة مترابطة', 'description': 'من التسجيل حتى المحفظة والاستثمار والمتابعة'}
        ], ensure_ascii=False), 'json', 'marketing', 'مؤشرات مركز الثقة'),
        ('trust_center_cards', json.dumps([
            {'icon': 'fas fa-building-shield', 'title': 'عن المنصة', 'content_key': 'about_platform_text', 'preview': 'منصة استثمار رقمية تعرض المشاريع بطريقة أوضح وتربط القرار بالمحفظة والمتابعة.', 'button_label': 'عرض التفاصيل', 'action_type': 'info', 'action_target': 'about_platform'},
            {'icon': 'fas fa-file-contract', 'title': 'الشروط والأحكام', 'content_key': 'terms_of_use_text', 'preview': 'بنود مختصرة توضح مسؤوليات المستخدم، استخدام المنصة، وحدود الخدمات الرقمية داخلها.', 'button_label': 'قراءة الشروط', 'action_type': 'info', 'action_target': 'terms'},
            {'icon': 'fas fa-user-shield', 'title': 'الخصوصية', 'content_key': 'privacy_policy_text', 'preview': 'نوضح كيف نستخدم البيانات لتشغيل المنصة وتأمين العمليات وتحسين التجربة فقط.', 'button_label': 'سياسة الخصوصية', 'action_type': 'info', 'action_target': 'privacy'},
            {'icon': 'fas fa-triangle-exclamation', 'title': 'إفصاح المخاطر', 'content_key': 'risk_disclosure_text', 'preview': 'توضيح مسؤولية المستثمر والعوامل التي قد تؤثر على العائد أو المدة أو سيولة الاستثمار.', 'button_label': 'عرض المخاطر', 'action_type': 'info', 'action_target': 'risk'},
            {'icon': 'fas fa-route', 'title': 'رحلة البدء داخل المنصة', 'preview': 'من شاشة الدخول تبدأ رحلتك بشكل مباشر: حساب واحد يفتح لك المحفظة والمشاريع وسجل المعاملات والتواصل داخل المنصة بخطوات واضحة وسريعة.', 'button_label': 'الذهاب إلى الدخول', 'action_type': 'section', 'action_target': 'auth'}
        ], ensure_ascii=False), 'json', 'marketing', 'بطاقات مركز الثقة'),
        ('trust_center_pillars_intro', json.dumps({
            'kicker': 'أركان الثقة',
            'title': 'معايير مؤسسية توضّح كيف تعمل المنصة',
            'description': 'هذا الجزء يشرح المحاور التي ترفع ثقة المستخدم والمستثمر، مثل الحوكمة، المراجعة، الشفافية، والدعم التشغيلي.'
        }, ensure_ascii=False), 'json', 'marketing', 'مقدمة أركان الثقة في مركز الثقة'),
        ('trust_center_pillars', json.dumps([
            {'icon': 'fas fa-building-shield', 'title': 'الحوكمة والتشغيل', 'description': 'المستخدم يرى كيف تدار المنصة وما هي حدود المسؤوليات والخطوات التشغيلية.', 'points': ['إدارة مركزية للإعدادات والمحتوى', 'وضوح الأدوار والإشراف', 'رحلة تشغيل مترابطة من الحساب حتى المعاملة']},
            {'icon': 'fas fa-user-check', 'title': 'التوثيق والتحقق', 'description': 'توثيق البريد وKYC وإجراءات السحب تضيف طبقات حماية وثقة قبل أي حركة مالية.', 'points': ['تحقق البريد أثناء التسجيل', 'توثيق KYC للحسابات', 'رمز تحقق قبل السحب']},
            {'icon': 'fas fa-scale-balanced', 'title': 'الالتزامات القانونية', 'description': 'الشروط والخصوصية وإفصاح المخاطر معروضة بلغة أوضح وقابلة للتحديث من الإدارة.', 'points': ['عرض السياسات الأساسية', 'إفصاح مخاطر ظاهر للمستخدم', 'نقاط قانونية قابلة للتوسعة']}
        ], ensure_ascii=False), 'json', 'marketing', 'أركان الثقة في مركز الثقة'),
        ('trust_center_commitments_intro', json.dumps({
            'kicker': 'التزامات المنصة',
            'title': 'ماذا يرى المستخدم قبل أن يقرر التحويل أو الاستثمار؟',
            'description': 'التزامات واضحة في العرض والتشغيل والدعم تعطي انطباعًا أقرب إلى الشركات الكبيرة ومنصات الاستثمار الاحترافية.'
        }, ensure_ascii=False), 'json', 'marketing', 'مقدمة التزامات المنصة في مركز الثقة'),
        ('trust_center_commitments', json.dumps([
            {'title': 'وضوح الرسوم', 'value': 'قبل التنفيذ', 'description': 'أي رسوم مرتبطة بالإيداع أو السحب أو الاستثمار يجب أن تكون ظاهرة قبل التأكيد.'},
            {'title': 'وضوح الحالة', 'value': 'في كل خطوة', 'description': 'المستخدم يرى إن كانت العملية معلقة أو مكتملة أو تحتاج مراجعة.'},
            {'title': 'قنوات الدعم', 'value': 'مباشرة ومنظمة', 'description': 'وجود الرسائل والإشعارات وبيانات التواصل يرفع الثقة عند الحاجة للمساعدة.'}
        ], ensure_ascii=False), 'json', 'marketing', 'التزامات المنصة في مركز الثقة'),
        ('about_platform_text', 'منصة استثمار رقمية تجمع بين عرض المشاريع، إدارة المحفظة، والتواصل الداخلي، بحيث يرى المستثمر الصورة التشغيلية والمالية من مكان واحد قبل اتخاذ قراره.', 'string', 'marketing', 'نص التعريف بالمنصة'),
        ('about_platform_points', json.dumps(['عرض أوضح للمشاريع والمحافظات', 'ربط المحفظة والاستثمار والمعاملات من مكان واحد', 'إدارة محتوى وهوية المنصة من لوحة الأدمن'], ensure_ascii=False), 'json', 'marketing', 'نقاط شرح عن المنصة'),
        ('terms_of_use_text', 'باستخدام هذه المنصة يقر المستخدم بأنه مسؤول عن دقة بياناته وقراراته الاستثمارية، وأن الخدمات المعروضة رقمية وتشغيلية وتخضع لشروط الإدارة والسياسات المعلنة داخل المنصة.', 'string', 'marketing', 'نص الشروط والأحكام'),
        ('terms_of_use_points', json.dumps(['مسؤولية المستخدم عن البيانات والقرار', 'استخدام المنصة ضمن السياسات المعلنة', 'الخدمات الرقمية تخضع لضوابط الإدارة والتشغيل'], ensure_ascii=False), 'json', 'marketing', 'نقاط الشروط والأحكام'),
        ('privacy_policy_text', 'نحافظ على خصوصية المستخدمين ونستخدم البيانات لتشغيل المنصة، تأمين المعاملات، وتحسين تجربة الاستثمار فقط. لا يتم مشاركة بياناتك الحساسة خارج إطار المتطلبات التشغيلية والدعم والإجراءات القانونية.', 'string', 'marketing', 'نص سياسة الخصوصية'),
        ('privacy_policy_points', json.dumps(['حماية البيانات الأساسية', 'استخدام تشغيلي للدعم والأمان', 'وضوح أكبر للمستثمر حول التعامل مع معلوماته'], ensure_ascii=False), 'json', 'marketing', 'نقاط سياسة الخصوصية'),
        ('risk_disclosure_text', 'الاستثمار بطبيعته يرتبط بمخاطر تخص المدة والسيولة والعائد والتنفيذ. يجب على المستثمر مراجعة تفاصيل كل مشروع وعدم الاعتماد على العائد المتوقع وحده قبل التمويل.', 'string', 'marketing', 'نص إفصاح المخاطر'),
        ('risk_disclosure_points', json.dumps(['العائد المتوقع ليس ضمانًا ثابتًا', 'المدة والسيولة قد تتأثر بظروف التشغيل', 'قراءة تفاصيل المشروع جزء أساسي قبل التمويل'], ensure_ascii=False), 'json', 'marketing', 'نقاط إفصاح المخاطر'),
        ('home_testimonials', json.dumps([
            {'name': 'مستثمر عقاري', 'role': 'بداية أسرع', 'quote': 'وضوح المحافظات والمشاريع اختصر عليّ وقت المقارنة، وكل شيء ظهر مرتبًا من أول زيارة.', 'metric': 'قرار أسرع'},
            {'name': 'مستخدم جديد', 'role': 'محفظة أسهل', 'quote': 'أعجبني أنني انتقلت من التسجيل إلى المحفظة ثم الاستثمار بدون تعقيد أو ضياع بين الصفحات.', 'metric': 'مسار أوضح'},
            {'name': 'متابع للفرص', 'role': 'ثقة أعلى', 'quote': 'وجود الأرقام والعوائد والصور والتواريخ في مكان واحد جعل الانطباع أقرب لمنصة استثمار محترفة.', 'metric': 'ثقة أفضل'}
        ], ensure_ascii=False), 'json', 'marketing', 'قصص النجاح في الواجهة الرئيسية'),
        ('home_feature_showcase', json.dumps([
            {'icon': 'fas fa-chart-line', 'title': 'مؤشرات سريعة', 'description': 'المشاريع، رؤوس الأموال، ومتوسط العائد تظهر مباشرة من أول شاشة.'},
            {'icon': 'fas fa-map-location-dot', 'title': 'ترتيب حسب المحافظة', 'description': 'الفرص موزعة بصريًا مع حضور محلي أوضح لكل محافظة.'},
            {'icon': 'fas fa-wallet', 'title': 'تمويل من نفس المنصة', 'description': 'المحفظة، الإيداع، السحب، والاستثمار ضمن رحلة واحدة متصلة.'},
            {'icon': 'fas fa-shield-halved', 'title': 'خطوات حماية أوضح', 'description': 'توثيق البريد وكود السحب يضيفان طبقة ثقة إضافية للمستخدم.'}
        ], ensure_ascii=False), 'json', 'marketing', 'نقاط قوة الواجهة في الرئيسية'),
        ('home_faq', json.dumps([
            {'question': 'كيف أبدأ الاستثمار داخل المنصة؟', 'answer': 'ابدأ بإنشاء حساب، ثم افتح المحفظة، اربط عنوانك أو استخدم عنوان الإيداع، وبعد ظهور الرصيد انتقل إلى قسم المشاريع واختر الفرصة المناسبة.'},
            {'question': 'هل أستطيع اختيار المشاريع حسب المحافظة؟', 'answer': 'نعم، الصفحة الرئيسية وقسم المشاريع يعرضان المحافظات بشكل أوضح، ويمكنك فلترة الفرص حسب المحافظة ثم متابعة تفاصيل كل مشروع.'},
            {'question': 'كيف أعرف إن كان رصيدي كافيًا للاستثمار؟', 'answer': 'عند الضغط على استثمر الآن يتم التحقق من الرصيد داخل المحفظة، وإذا لم يكن كافيًا تظهر لك رسالة واضحة قبل تنفيذ أي خصم.'},
            {'question': 'ماذا أرى داخل المحفظة؟', 'answer': 'سترى الرصيد، العملة، الشبكة، عنوان الإيداع، QR، إضافة إلى إجراءات الإيداع والسحب والتحويل الداخلي بين المستخدمين.'},
            {'question': 'هل يمكنني متابعة كل العمليات بعد البدء؟', 'answer': 'نعم، قسم المعاملات يعرض الإيداعات والسحوبات والاستثمارات وحالة كل عملية بشكل مرتب وواضح.'}
        ], ensure_ascii=False), 'json', 'marketing', 'الأسئلة الشائعة في الواجهة الرئيسية'),
        ('social_twitter_url', '', 'string', 'marketing', 'رابط تويتر'),
        ('social_facebook_url', '', 'string', 'marketing', 'رابط فيسبوك'),
        ('social_instagram_url', '', 'string', 'marketing', 'رابط إنستجرام'),
        ('social_linkedin_url', '', 'string', 'marketing', 'رابط لينكد إن'),
        ('contact_email', 'support@invest-platform.com', 'string', 'contact', 'البريد الالكتروني للدعم'),
        ('contact_phone', '+966500000000', 'string', 'contact', 'رقم الهاتف'),
        ('support_ai_enabled', 'true', 'boolean', 'contact', 'تفعيل مساعد الدعم الذكي داخل الرسائل'),
        ('support_ai_name', 'مساعد المنصة الذكي', 'string', 'contact', 'الاسم الظاهر لمساعد الدعم الذكي'),
        ('support_ai_escalation_notice', 'إذا كانت الحالة تحتاج متابعة أعمق فسيكمل فريق الإدارة الرد داخل نفس المحادثة.', 'string', 'contact', 'رسالة تصعيد محادثات الدعم إلى الإدارة'),
        ('default_currency', 'USDT', 'string', 'financial', 'العملة الافتراضية'),
        ('available_currencies', json.dumps(['USDT', 'BTC', 'ETH', 'BNB'], ensure_ascii=False), 'json', 'financial', 'العملات المتاحة'),
        ('min_deposit', '5', 'number', 'financial', 'الحد الأدنى للإيداع'),
        ('min_withdraw', '5', 'number', 'financial', 'الحد الأدنى للسحب'),
        ('profit_rate', '15', 'number', 'financial', 'نسبة الربح الأساسية'),
        ('profit_rate_min', '5', 'number', 'financial', 'أقل نسبة ربح'),
        ('profit_rate_max', '30', 'number', 'financial', 'أعلى نسبة ربح'),
        ('profit_auto_credit_enabled', 'true', 'boolean', 'financial', 'إضافة الأرباح تلقائياً إلى المحفظة'),
        ('profit_distribution_mode', 'monthly', 'string', 'financial', 'دورية إضافة الأرباح: يومي أو شهري'),
        ('referral_bonus', '5', 'number', 'financial', 'مكافأة الإحالة'),
        ('investment_cancellation_fee_rate', '1', 'number', 'financial', 'نسبة خصم إلغاء الاستثمار'),
        ('investor_investment_fee_percentage', '0', 'number', 'financial', 'نسبة رسوم المنصة على المستثمر عند تنفيذ الاستثمار'),
        ('company_investment_fee_mode', 'percentage', 'string', 'financial', 'نوع عمولة الاستثمار على مشاريع الشركات: نسبة أو مبلغ ثابت'),
        ('company_investment_fee_percentage', '1', 'number', 'financial', 'نسبة عمولة الاستثمار على مشاريع الشركات'),
        ('company_investment_fee_fixed_amount', '25', 'number', 'financial', 'العمولة الثابتة على الاستثمار في مشاريع الشركات'),
        ('company_investment_fee_currency', 'USDT', 'string', 'financial', 'عملة عمولة مشاريع الشركات'),
        ('company_investment_fee_network', 'TRC20', 'string', 'financial', 'شبكة تحويل عمولة مشاريع الشركات'),
        ('company_wallet_setup_fee_amount', '15', 'number', 'financial', 'رسوم أول إنشاء محفظة للشركة'),
        ('company_wallet_setup_fee_currency', 'USDT', 'string', 'financial', 'عملة رسوم أول محفظة للشركة'),
        ('company_wallet_setup_fee_network', 'TRC20', 'string', 'financial', 'شبكة خصم رسوم أول محفظة للشركة'),
        ('property_listing_fee_mode', 'percentage', 'string', 'financial', 'نوع رسوم نشر العقار: نسبة أو مبلغ ثابت'),
        ('property_listing_fee_percentage', '1', 'number', 'financial', 'نسبة رسوم نشر العقار'),
        ('property_listing_fee_fixed_amount', '10', 'number', 'financial', 'الرسوم الثابتة لنشر العقار'),
        ('property_listing_fee_currency', 'USDT', 'string', 'financial', 'عملة رسوم نشر العقار'),
        ('property_listing_fee_network', 'TRC20', 'string', 'financial', 'شبكة خصم رسوم نشر العقار'),
        ('min_investment', '100', 'number', 'financial', 'الحد الأدنى للاستثمار'),
        ('maintenance_mode', 'false', 'boolean', 'system', 'وضع الصيانة'),
        ('maintenance_message', 'نحن الآن في وضع صيانة لتحسين المنصة. نعتذر عن الإزعاج وسنعود إليكم قريبًا.', 'string', 'system', 'رسالة وضع الصيانة'),
        ('registration_enabled', 'true', 'boolean', 'system', 'تفعيل التسجيل'),
        ('seed_demo_investments_enabled', 'false', 'boolean', 'system', 'تفعيل إنشاء الاستثمارات التجريبية تلقائياً عند كون الجدول فارغاً'),
        ('deposit_enabled', 'true', 'boolean', 'system', 'تفعيل الإيداع'),
        ('withdraw_enabled', 'true', 'boolean', 'system', 'تفعيل السحب'),
        ('internal_transfer_enabled', 'true', 'boolean', 'system', 'تفعيل التحويل الداخلي بين المستخدمين'),
        ('legacy_wallet_section_enabled', 'true', 'boolean', 'launch', 'إظهار أو إخفاء قسم المحفظة القديمة'),
        ('real_wallets_section_enabled', 'true', 'boolean', 'launch', 'إظهار أو إخفاء قسم المحافظ الحقيقية'),
        ('financial_channels_enabled', 'true', 'boolean', 'launch', 'إظهار أو إخفاء القنوات المالية الحقيقية'),
        ('real_crypto_wallet_creation_enabled', 'true', 'boolean', 'launch', 'السماح بإنشاء محافظ كريبتو حقيقية جديدة للمستخدمين'),
        ('real_money_enabled', 'false', 'boolean', 'launch', 'تجهيز تفعيل الوضع الحقيقي'),
        ('real_wallet_generation_mode', 'manual_pool', 'string', 'launch', 'طريقة إنشاء المحافظ الحقيقية الجديدة'),
        ('real_wallet_blockchain_provider', 'tatum', 'string', 'launch', 'مزود إنشاء المحافظ الحقيقية'),
        ('real_wallet_provider_api_key', os.environ.get('TATUM_API_KEY', ''), 'string', 'launch', 'مفتاح API لمزود المحافظ الحقيقية'),
        ('real_wallet_provider_base_url', os.environ.get('TATUM_BASE_URL', 'https://api.tatum.io'), 'string', 'launch', 'الرابط الأساسي لمزود المحافظ الحقيقية'),
        ('real_wallet_eth_testnet_type', os.environ.get('TATUM_ETH_TESTNET_TYPE', 'ethereum-sepolia'), 'string', 'launch', 'نوع شبكة اختبار Ethereum لمزود المحافظ'),
        ('real_wallet_xpub_tron', os.environ.get('REAL_WALLET_XPUB_TRON', ''), 'string', 'launch', 'XPUB الخاص بشبكة TRON لإنشاء محافظ TRC20'),
        ('real_wallet_xpub_ethereum', os.environ.get('REAL_WALLET_XPUB_ETHEREUM', ''), 'string', 'launch', 'XPUB الخاص بشبكة Ethereum لإنشاء محافظ ERC20'),
        ('real_wallet_xpub_bsc', os.environ.get('REAL_WALLET_XPUB_BSC', ''), 'string', 'launch', 'XPUB الخاص بشبكة BSC لإنشاء محافظ BEP20'),
        ('real_wallet_xpub_bitcoin', os.environ.get('REAL_WALLET_XPUB_BITCOIN', ''), 'string', 'launch', 'XPUB الخاص بشبكة Bitcoin لإنشاء محافظ BTC'),
        ('launch_networks', json.dumps(['TRC20', 'ERC20', 'BEP20', 'BTC'], ensure_ascii=False), 'json', 'launch', 'الشبكات الأولى للإطلاق'),
        ('deposit_verification_mode', 'simulated', 'string', 'launch', 'وضع تحقق الإيداع'),
        ('deposit_verification_provider', 'tatum', 'string', 'launch', 'مصدر التحقق الحقيقي للإيداع'),
        ('deposit_tx_max_age_hours', '24', 'number', 'launch', 'الحد الأقصى لعمر TX الإيداع بالساعات'),
        ('withdraw_execution_mode', 'admin_approval', 'string', 'launch', 'تنفيذ السحب بعد موافقة الأدمن'),
        ('rtc_stun_urls', 'stun:stun.l.google.com:19302', 'string', 'launch', 'روابط STUN للاتصال الصوتي'),
        ('rtc_turn_enabled', 'false', 'boolean', 'launch', 'تفعيل TURN للاتصال الصوتي'),
        ('rtc_turn_url', '', 'string', 'launch', 'رابط TURN للاتصال الصوتي'),
        ('rtc_turn_username', '', 'string', 'launch', 'اسم مستخدم TURN'),
        ('rtc_turn_password', '', 'string', 'launch', 'كلمة مرور TURN'),
        ('project_exit_methods', json.dumps(['crypto', 'bank', 'paypal'], ensure_ascii=False), 'json', 'launch', 'طرق الخروج في نهاية المشروع'),
        ('session_timeout', '60', 'number', 'security', 'مدة الجلسة بالدقائق'),
        ('max_login_attempts', '5', 'number', 'security', 'الحد الأقصى لمحاولات الدخول'),
        ('lockout_duration_minutes', '15', 'number', 'security', 'مدة قفل الحساب المؤقت بالدقائق'),
        ('device_login_attempts_limit', '6', 'number', 'security', 'الحد الأقصى لمحاولات الجهاز في تسجيل الدخول'),
        ('device_reset_attempts_limit', '6', 'number', 'security', 'الحد الأقصى لمحاولات الجهاز في إعادة التعيين'),
        ('device_lockout_duration_minutes', '60', 'number', 'security', 'مدة حظر الجهاز المؤقت بالدقائق'),
        ('backup_retention_count', '10', 'number', 'security', 'عدد النسخ الاحتياطية التي يتم الاحتفاظ بها'),
        ('backup_auto_create_before_restore', 'true', 'boolean', 'security', 'إنشاء نسخة احتياطية تلقائية قبل الاستعادة'),
        ('two_factor_auth', 'false', 'boolean', 'security', 'تفعيل المصادقة الثنائية'),
        ('email_verification', 'true', 'boolean', 'security', 'التحقق من البريد الإلكتروني'),
        ('mail_server', app.config.get('MAIL_SERVER', 'smtp.gmail.com'), 'string', 'security', 'خادم SMTP'),
        ('mail_port', str(app.config.get('MAIL_PORT', 587)), 'number', 'security', 'منفذ SMTP'),
        ('mail_use_tls', 'true' if app.config.get('MAIL_USE_TLS', True) else 'false', 'boolean', 'security', 'استخدام TLS للبريد'),
        ('mail_provider_preset', 'custom', 'string', 'security', 'نوع مزود الإرسال'),
        ('mail_delivery_profile', 'business_domain', 'string', 'security', 'مستوى موثوقية الوصول للبريد'),
        ('mail_username', app.config.get('MAIL_USERNAME') or '', 'string', 'security', 'اسم مستخدم البريد المرسل'),
        ('mail_password', app.config.get('MAIL_PASSWORD') or '', 'string', 'security', 'كلمة مرور البريد المرسل'),
        ('mail_default_sender', app.config.get('MAIL_DEFAULT_SENDER') or '', 'string', 'security', 'البريد الذي ترسل منه المنصة'),
        ('mail_sender_name', 'منصة الاستثمار الذكية الآمنة', 'string', 'security', 'اسم مرسل رسائل البريد الإلكتروني')
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO system_settings (key, value, data_type, category, description)
        VALUES (?, ?, ?, ?, ?)
    ''', settings)

    cursor.executemany('''
        UPDATE system_settings
        SET data_type = ?, category = ?, description = ?
        WHERE key = ?
    ''', [
        ('string', 'financial', 'العملة الافتراضية', 'default_currency'),
        ('json', 'financial', 'العملات المتاحة', 'available_currencies'),
        ('number', 'financial', 'الحد الأدنى للإيداع', 'min_deposit'),
        ('number', 'financial', 'الحد الأدنى للسحب', 'min_withdraw'),
        ('number', 'financial', 'نسبة الربح الأساسية', 'profit_rate'),
        ('number', 'financial', 'نسبة خصم إلغاء الاستثمار', 'investment_cancellation_fee_rate'),
        ('number', 'financial', 'نسبة رسوم المنصة على المستثمر عند تنفيذ الاستثمار', 'investor_investment_fee_percentage'),
        ('string', 'financial', 'نوع عمولة الاستثمار على مشاريع الشركات: نسبة أو مبلغ ثابت', 'company_investment_fee_mode'),
        ('number', 'financial', 'نسبة عمولة الاستثمار على مشاريع الشركات', 'company_investment_fee_percentage'),
        ('number', 'financial', 'العمولة الثابتة على الاستثمار في مشاريع الشركات', 'company_investment_fee_fixed_amount'),
        ('string', 'financial', 'عملة عمولة مشاريع الشركات', 'company_investment_fee_currency'),
        ('string', 'financial', 'شبكة تحويل عمولة مشاريع الشركات', 'company_investment_fee_network'),
        ('number', 'financial', 'رسوم أول إنشاء محفظة للشركة', 'company_wallet_setup_fee_amount'),
        ('string', 'financial', 'عملة رسوم أول محفظة للشركة', 'company_wallet_setup_fee_currency'),
        ('string', 'financial', 'شبكة خصم رسوم أول محفظة للشركة', 'company_wallet_setup_fee_network'),
        ('boolean', 'system', 'تفعيل التحويل الداخلي بين المستخدمين', 'internal_transfer_enabled'),
        ('number', 'security', 'مدة الجلسة بالدقائق', 'session_timeout'),
        ('number', 'security', 'الحد الأقصى لمحاولات الدخول', 'max_login_attempts'),
        ('number', 'security', 'مدة قفل الحساب المؤقت بالدقائق', 'lockout_duration_minutes'),
        ('number', 'security', 'الحد الأقصى لمحاولات الجهاز في تسجيل الدخول', 'device_login_attempts_limit'),
        ('number', 'security', 'الحد الأقصى لمحاولات الجهاز في إعادة التعيين', 'device_reset_attempts_limit'),
        ('number', 'security', 'مدة حظر الجهاز المؤقت بالدقائق', 'device_lockout_duration_minutes'),
        ('number', 'security', 'عدد النسخ الاحتياطية التي يتم الاحتفاظ بها', 'backup_retention_count'),
        ('boolean', 'security', 'إنشاء نسخة احتياطية تلقائية قبل الاستعادة', 'backup_auto_create_before_restore'),
        ('boolean', 'security', 'تفعيل المصادقة الثنائية', 'two_factor_auth'),
        ('boolean', 'security', 'التحقق من البريد الإلكتروني', 'email_verification'),
        ('string', 'security', 'خادم SMTP', 'mail_server'),
        ('number', 'security', 'منفذ SMTP', 'mail_port'),
        ('boolean', 'security', 'استخدام TLS للبريد', 'mail_use_tls'),
        ('string', 'security', 'نوع مزود الإرسال', 'mail_provider_preset'),
        ('string', 'security', 'مستوى موثوقية الوصول للبريد', 'mail_delivery_profile'),
        ('string', 'security', 'اسم مستخدم البريد المرسل', 'mail_username'),
        ('string', 'security', 'كلمة مرور البريد المرسل', 'mail_password'),
        ('string', 'security', 'البريد الذي ترسل منه المنصة', 'mail_default_sender'),
        ('string', 'security', 'اسم مرسل رسائل البريد الإلكتروني', 'mail_sender_name'),
        ('string', 'general', 'الخلفية الافتراضية للموقع', 'site_background_image'),
        ('boolean', 'general', 'تفعيل أو إيقاف تسجيل حسابات الشركات', 'company_accounts_enabled'),
        ('string', 'marketing', 'عنوان الواجهة الرئيسية', 'hero_title'),
        ('json', 'marketing', 'عناصر قسم لماذا نحن', 'why_us_items'),
        ('boolean', 'launch', 'إظهار أو إخفاء قسم المحفظة القديمة', 'legacy_wallet_section_enabled'),
        ('boolean', 'launch', 'إظهار أو إخفاء قسم المحافظ الحقيقية', 'real_wallets_section_enabled'),
        ('boolean', 'launch', 'إظهار أو إخفاء القنوات المالية الحقيقية', 'financial_channels_enabled'),
        ('boolean', 'launch', 'السماح بإنشاء محافظ كريبتو حقيقية جديدة للمستخدمين', 'real_crypto_wallet_creation_enabled'),
        ('string', 'launch', 'طريقة إنشاء المحافظ الحقيقية الجديدة', 'real_wallet_generation_mode'),
        ('string', 'launch', 'مزود إنشاء المحافظ الحقيقية', 'real_wallet_blockchain_provider'),
        ('string', 'launch', 'مفتاح API لمزود المحافظ الحقيقية', 'real_wallet_provider_api_key'),
        ('string', 'launch', 'الرابط الأساسي لمزود المحافظ الحقيقية', 'real_wallet_provider_base_url'),
        ('string', 'launch', 'نوع شبكة اختبار Ethereum لمزود المحافظ', 'real_wallet_eth_testnet_type'),
        ('string', 'launch', 'XPUB الخاص بشبكة TRON لإنشاء محافظ TRC20', 'real_wallet_xpub_tron'),
        ('string', 'launch', 'XPUB الخاص بشبكة Ethereum لإنشاء محافظ ERC20', 'real_wallet_xpub_ethereum'),
        ('string', 'launch', 'XPUB الخاص بشبكة BSC لإنشاء محافظ BEP20', 'real_wallet_xpub_bsc'),
        ('string', 'launch', 'XPUB الخاص بشبكة Bitcoin لإنشاء محافظ BTC', 'real_wallet_xpub_bitcoin'),
        ('number', 'launch', 'الحد الأقصى لعمر TX الإيداع بالساعات', 'deposit_tx_max_age_hours'),
        ('string', 'launch', 'روابط STUN للاتصال الصوتي', 'rtc_stun_urls'),
        ('boolean', 'launch', 'تفعيل TURN للاتصال الصوتي', 'rtc_turn_enabled'),
        ('string', 'launch', 'رابط TURN للاتصال الصوتي', 'rtc_turn_url'),
        ('string', 'launch', 'اسم مستخدم TURN', 'rtc_turn_username'),
        ('string', 'launch', 'كلمة مرور TURN', 'rtc_turn_password')
    ])

    cursor.execute('''
        UPDATE system_settings
        SET value = ?
        WHERE key = 'site_background_image'
          AND value = ?
    ''', (
        '/static/images/hero-city-investment.png',
        'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80'
    ))

    cursor.execute('''
        UPDATE system_settings
        SET value = ?
        WHERE key = 'site_background_image'
          AND value = ?
    ''', (
        '/static/images/hero-city-investment.png',
        '/static/images/syria.png'
    ))

    current_default_currency = cursor.execute(
        'SELECT value FROM system_settings WHERE key = ?',
        ('default_currency',)
    ).fetchone()
    if current_default_currency and current_default_currency[0].isdigit():
        currency_map = {
            '1': 'USDT',
            '2': 'BTC',
            '3': 'ETH',
            '4': 'BNB',
            '5': 'TRX'
        }
        mapped_currency = currency_map.get(current_default_currency[0], 'USDT')
        cursor.execute(
            'UPDATE system_settings SET value = ? WHERE key = ?',
            (mapped_currency, 'default_currency')
        )
    
    # إنشاء المستخدم الأدمن إذا لم يكن موجوداً
    admin_exists = cursor.execute('SELECT id FROM users WHERE email = ?', ('admin@invest.com',)).fetchone()
    if not admin_exists:
        admin_password = os.environ.get('ADMIN_PASSWORD') or app.config.get('ADMIN_PASSWORD')
        if not admin_password:
            raise RuntimeError('ADMIN_PASSWORD must be set before creating the admin user')

        hashed_password = bcrypt.generate_password_hash(admin_password).decode('utf-8')
        
        cursor.execute('''
            INSERT INTO users (name, email, phone, password, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'مدير النظام',
            'admin@invest.com',
            '+966500000000',
            hashed_password,
            'admin',
            1
        ))
        
        admin_id = cursor.lastrowid
        
        # إنشاء سجلات محافظ للأدمن بدون عناوين افتراضية
        currencies = cursor.execute('SELECT id FROM currencies WHERE is_active = 1').fetchall()
        for currency in currencies:
            cursor.execute('''
                INSERT INTO user_wallets (user_id, currency_id, address, balance)
                VALUES (?, ?, ?, ?)
            ''', (admin_id, currency[0], None, 0.0))
        
        print("[OK] Admin account created successfully")
    
    # إضافة الاستثمارات التجريبية أصبحت اختيارية وموقوفة افتراضياً
    admin_id = cursor.execute('SELECT id FROM users WHERE email = ?', ('admin@invest.com',)).fetchone()[0]
    seed_demo_investments_row = cursor.execute(
        'SELECT value FROM system_settings WHERE key = ?',
        ('seed_demo_investments_enabled',)
    ).fetchone()
    seed_demo_investments_enabled = bool(
        seed_demo_investments_row and str(seed_demo_investments_row[0]).lower() == 'true'
    )
    existing_investments_count = cursor.execute('SELECT COUNT(*) FROM investments').fetchone()[0]

    if seed_demo_investments_enabled and existing_investments_count == 0:
        investments = [
            ('مجمع سكني في حلب الجديدة', 'تطوير وحدات سكنية وتجارية قرب مناطق الطلب المتزايد في حلب.', 100000, 0, 15, 12, 'real-estate', 'aleppo'),
            ('أبراج سكنية في حمص', 'مشروع عقاري متوسط المخاطر في موقع مركزي داخل حمص.', 180000, 0, 14, 14, 'real-estate', 'homs'),
            ('مكاتب تجارية في دمشق', 'مساحات تجارية صغيرة قابلة للتأجير في العاصمة.', 250000, 0, 12, 10, 'real-estate', 'damascus'),
            ('شقق سياحية في اللاذقية', 'وحدات مفروشة قريبة من الساحل موجهة للإيجار الموسمي.', 150000, 0, 18, 18, 'real-estate', 'latakia'),
            ('مستودعات تجارية في طرطوس', 'مستودعات وخدمات لوجستية مرتبطة بالميناء والساحل.', 220000, 0, 13, 16, 'real-estate', 'tartus')
        ]

        for inv in investments:
            governorate = cursor.execute('SELECT id FROM governorates WHERE slug = ?', (inv[7],)).fetchone()
            governorate_id = governorate[0] if governorate else None
            cursor.execute('''
                INSERT INTO investments (name, description, total_amount, min_investment, return_rate, duration, category, governorate_id, added_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ''', (inv[0], inv[1], inv[2], inv[3], inv[4], inv[5], inv[6], governorate_id, admin_id))
        print("[OK] Demo investments created because the table was empty and seeding is enabled")
    else:
        print("[OK] Demo investment seeding skipped")

    market_reference_investments = [
        {
            'name': 'توسعة مطار دمشق الدولي',
            'description': 'مشروع سوق موثق أُعلن عنه في 6 أغسطس 2025 ضمن اتفاقيات استثمارية كبيرة في سوريا، ويشمل توسعة المطار ورفع طاقته التشغيلية. أُضيف هذا المشروع داخل قسم مستقل لمشاريع السوق الموثقة مع إمكانية متابعته والاستثمار فيه من المنصة.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/c69c9b1c8c7273e9562b330069a3040d',
            'source_published_at': '2025-08-06',
            'total_amount': 4000000000,
            'min_investment': 250,
            'return_rate': 12,
            'duration': 48,
            'start_date': '2025-08-06',
            'governorate_slug': 'damascus',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?Damascus,airport,Syria',
                'https://source.unsplash.com/1600x900/?airport,terminal,Middle-East'
            ]
        },
        {
            'name': 'مترو دمشق الحضري',
            'description': 'مشروع سوق موثق أُعلن عنه في 6 أغسطس 2025 لتطوير شبكة مترو في دمشق ضمن حزمة استثمارية كبرى. أُدرج داخل قسم مستقل لمشاريع السوق الموثقة ليعطي صورة أوضح عن اتجاهات الاستثمار والبنية التحتية، مع إمكانية الاستثمار فيه من المنصة.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/c69c9b1c8c7273e9562b330069a3040d',
            'source_published_at': '2025-08-06',
            'total_amount': 2000000000,
            'min_investment': 200,
            'return_rate': 11,
            'duration': 60,
            'start_date': '2025-08-06',
            'governorate_slug': 'damascus',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?metro,train,city',
                'https://source.unsplash.com/1600x900/?urban,rail,station'
            ]
        },
        {
            'name': 'أبراج سكنية قرب دمشق',
            'description': 'مشروع سوق موثق أُعلن عنه في 6 أغسطس 2025 ويشمل تطوير أبراج سكنية ووحدات سكنية كبيرة قرب العاصمة السورية. يظهر هنا كمؤشر على حركة التطوير العقاري الفعلية في السوق السوري، مع إمكانية الاستثمار فيه من داخل المنصة.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/c69c9b1c8c7273e9562b330069a3040d',
            'source_published_at': '2025-08-06',
            'total_amount': 2000000000,
            'min_investment': 150,
            'return_rate': 13,
            'duration': 42,
            'start_date': '2025-08-06',
            'governorate_slug': 'damascus',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?residential,towers,city',
                'https://source.unsplash.com/1600x900/?apartment,building,skyline'
            ]
        },
        {
            'name': 'مشروع الكهرباء الإسعافي في سوريا',
            'description': 'مشروع سوق موثق وافق عليه البنك الدولي في 25 يونيو 2025 لدعم إعادة تأهيل البنية الكهربائية في سوريا. وجوده هنا يوضح حجم المشاريع الفعلية في السوق والبنية التحتية، مع إمكانية الاستثمار فيه من خلال قسم السوق الموثق.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/7ca26740ae09cb997fc405e948bf42bc',
            'source_published_at': '2025-06-25',
            'total_amount': 146000000,
            'min_investment': 100,
            'return_rate': 10,
            'duration': 24,
            'start_date': '2025-06-25',
            'governorate_slug': 'damascus',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?electricity,substation,power-grid',
                'https://source.unsplash.com/1600x900/?energy,grid,infrastructure'
            ]
        },
        {
            'name': 'برنامج إصلاح الكهرباء في لبنان',
            'description': 'مشروع سوق موثق أُعلن عنه في 24 أبريل 2025 بدعم من البنك الدولي بقيمة 250 مليون دولار لتحسين قطاع الكهرباء في لبنان. أُضيف للمنصة كإشارة سوقية حقيقية ولمقارنة الفرص الإقليمية، مع إمكانية الاستثمار فيه من داخل المنصة.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/3942b84a2d92ae3ca47be8633c7f7145',
            'source_published_at': '2025-04-24',
            'total_amount': 250000000,
            'min_investment': 100,
            'return_rate': 10,
            'duration': 24,
            'start_date': '2025-04-24',
            'governorate_slug': 'beirut-lebanon',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?Beirut,Lebanon,city,night',
                'https://source.unsplash.com/1600x900/?power,city,lights'
            ]
        },
        {
            'name': 'إعادة تأهيل البنية التحتية الحيوية في لبنان',
            'description': 'مشروع سوق موثق أُعلن عنه في 25 يونيو 2025 ضمن تمويل دولي عاجل لإصلاح الخدمات الحيوية وإعادة الإعمار في لبنان. نعرضه داخل المنصة ضمن قسم مستقل لمشاريع السوق الموثقة وبصورة أوضح للمستثمر، مع إمكانية الاستثمار فيه.',
            'source_label': 'AP News',
            'source_url': 'https://apnews.com/article/7ca26740ae09cb997fc405e948bf42bc',
            'source_published_at': '2025-06-25',
            'total_amount': 250000000,
            'min_investment': 120,
            'return_rate': 11,
            'duration': 30,
            'start_date': '2025-06-25',
            'governorate_slug': 'beirut-lebanon',
            'image_gallery': [
                'https://source.unsplash.com/1600x900/?Beirut,reconstruction,urban',
                'https://source.unsplash.com/1600x900/?infrastructure,construction,city'
            ]
        }
    ]

    inserted_market_reference_count = 0
    for project in market_reference_investments:
        existing_reference = cursor.execute(
            'SELECT id FROM investments WHERE name = ? LIMIT 1',
            (project['name'],)
        ).fetchone()
        governorate = cursor.execute(
            'SELECT id FROM governorates WHERE slug = ? LIMIT 1',
            (project['governorate_slug'],)
        ).fetchone()
        if not governorate:
            continue

        image_gallery = project['image_gallery']
        if existing_reference:
            cursor.execute('''
                UPDATE investments
                SET description = ?,
                    image_url = ?,
                    image_gallery_json = ?,
                    source_label = ?,
                    source_url = ?,
                    source_published_at = ?,
                    total_amount = ?,
                    min_investment = ?,
                    return_rate = ?,
                    duration = ?,
                    start_date = ?,
                    end_date = ?,
                    category = ?,
                    governorate_id = ?,
                    added_by = ?,
                    status = 'active'
                WHERE id = ?
            ''', (
                project['description'],
                image_gallery[0],
                json.dumps(image_gallery, ensure_ascii=False),
                project['source_label'],
                project['source_url'],
                project['source_published_at'],
                project['total_amount'],
                project['min_investment'],
                project['return_rate'],
                project['duration'],
                project['start_date'],
                None,
                'market-reference',
                governorate[0],
                admin_id,
                existing_reference[0]
            ))
            continue

        cursor.execute('''
            INSERT INTO investments (
                name, description, image_url, image_gallery_json, source_label, source_url, source_published_at, total_amount, admin_amount,
                min_investment, return_rate, duration, start_date, end_date, category,
                governorate_id, added_by, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        ''', (
            project['name'],
            project['description'],
            image_gallery[0],
            json.dumps(image_gallery, ensure_ascii=False),
            project['source_label'],
            project['source_url'],
            project['source_published_at'],
            project['total_amount'],
            0,
            project['min_investment'],
            project['return_rate'],
            project['duration'],
            project['start_date'],
            None,
            'market-reference',
            governorate[0],
            admin_id
        ))
        inserted_market_reference_count += 1

    print(f"[OK] Market reference investments ensured ({inserted_market_reference_count} inserted)")

    cursor.execute('UPDATE investments SET min_investment = 0 WHERE min_investment > 0')
    removed_placeholder_wallet_count = cleanup_legacy_placeholder_admin_wallets(conn)
    cursor.execute('''
        UPDATE user_wallets
        SET address = NULL, balance = 0, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = (SELECT id FROM users WHERE email = 'admin@invest.com' LIMIT 1)
          AND balance = 100000.0
    ''')
    
    if removed_placeholder_wallet_count:
        print(f"[OK] Removed {removed_placeholder_wallet_count} legacy placeholder admin wallets")

    print("[OK] Investment defaults check completed")

def generate_wallet_address(currency_id):
    """توليد عنوان محفظة فريد لكل عملة"""
    prefix = {
        1: 'T',  # USDT TRC20
        2: '1',  # BTC
        3: '0x', # ETH
        4: 'bnb', # BNB
        5: 'T'   # TRX
    }.get(currency_id, '')
    
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=33-len(prefix)))
    return prefix + random_part

def get_db_connection():
    """الحصول على اتصال قاعدة البيانات"""
    conn = sqlite3.connect(get_database_path())
    conn.execute('PRAGMA foreign_keys = ON')
    conn.row_factory = sqlite3.Row
    return conn


def generate_password_reset_token(user_id):
    token = uuid.uuid4().hex
    expires_at = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
        VALUES (?, ?, ?, 0)
    ''', (user_id, token, expires_at))
    conn.commit()
    conn.close()
    return token


def get_password_reset_token(token):
    conn = get_db_connection()
    row = conn.execute('''
        SELECT id, user_id FROM password_reset_tokens
        WHERE token = ? AND used = 0 AND expires_at > ?
    ''', (token, datetime.now().strftime('%Y-%m-%d %H:%M:%S'))).fetchone()
    conn.close()
    return row


def mark_password_reset_token_used(token_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', (token_id,))
    conn.commit()
    conn.close()


def create_email_verification_code(conn, user_id):
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = (datetime.now() + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        'UPDATE email_verification_codes SET used = 1 WHERE user_id = ? AND used = 0',
        (user_id,)
    )
    conn.execute('''
        INSERT INTO email_verification_codes (user_id, code, expires_at, used)
        VALUES (?, ?, ?, 0)
    ''', (user_id, code, expires_at))
    return code


def create_password_reset_code(conn, user_id):
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = (datetime.now() + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        'UPDATE password_reset_codes SET used = 1 WHERE user_id = ? AND used = 0',
        (user_id,)
    )
    conn.execute('''
        INSERT INTO password_reset_codes (user_id, code, expires_at, used)
        VALUES (?, ?, ?, 0)
    ''', (user_id, code, expires_at))
    return code


def create_withdrawal_verification_code(conn, user_id, currency_id, network_id, amount, wallet_address):
    code = ''.join(random.choices(string.digits, k=6))
    expires_at = (datetime.now() + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    conn.execute(
        'UPDATE withdrawal_verification_codes SET used = 1 WHERE user_id = ? AND used = 0',
        (user_id,)
    )
    conn.execute('''
        INSERT INTO withdrawal_verification_codes (
            user_id, currency_id, network_id, amount, wallet_address, code, expires_at, used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ''', (user_id, currency_id, network_id, amount, wallet_address, code, expires_at))
    return code


def get_system_setting(conn, key, default=None):
    row = conn.execute(
        'SELECT value, data_type FROM system_settings WHERE key = ?',
        (key,)
    ).fetchone()
    if not row or row['value'] in (None, ''):
        return default

    value = row['value']
    data_type = row['data_type']

    if data_type == 'boolean':
        return str(value).lower() == 'true'
    if data_type == 'number':
        try:
            return float(value) if '.' in str(value) else int(value)
        except (TypeError, ValueError):
            return default
    if data_type == 'json':
        try:
            return json.loads(value)
        except Exception:
            return default
    return value


def verify_google_id_token(id_token):
    google_client_id = app.config.get('GOOGLE_CLIENT_ID') or os.environ.get('GOOGLE_CLIENT_ID', '')
    if not google_client_id:
        raise ValueError('Google sign-in is not configured')
    if not id_token:
        raise ValueError('Missing Google credential')

    try:
        response = requests.get(
            'https://oauth2.googleapis.com/tokeninfo',
            params={'id_token': id_token},
            timeout=8
        )
    except requests.RequestException as exc:
        raise ValueError(f'Unable to verify Google token: {exc}') from exc

    if response.status_code != 200:
        raise ValueError('Google token verification failed')

    payload = response.json()
    if payload.get('aud') != google_client_id:
        raise ValueError('Google token audience mismatch')

    if str(payload.get('email_verified', '')).lower() != 'true':
        raise ValueError('Google account email is not verified')

    if payload.get('iss') not in {'accounts.google.com', 'https://accounts.google.com'}:
        raise ValueError('Invalid Google token issuer')

    email = str(payload.get('email') or '').strip().lower()
    if not email:
        raise ValueError('Google account did not return an email address')

    return {
        'sub': str(payload.get('sub') or '').strip(),
        'email': email,
        'name': str(payload.get('name') or payload.get('given_name') or email.split('@')[0]).strip(),
        'picture': str(payload.get('picture') or '').strip(),
    }


def serialize_log_payload(payload):
    if payload is None:
        return None
    try:
        return json.dumps(payload, ensure_ascii=False, default=str)
    except Exception:
        return str(payload)


def log_audit_event(action, user_id=None, entity_type=None, entity_id=None, old_value=None, new_value=None, status='success'):
    conn = None
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO audit_logs (
                user_id, action, entity_type, entity_id,
                old_value, new_value, ip_address, user_agent, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            action,
            entity_type,
            entity_id,
            serialize_log_payload(old_value),
            serialize_log_payload(new_value),
            request.remote_addr if request else None,
            request.headers.get('User-Agent', '')[:255] if request else None,
            status,
        ))
        conn.commit()
    except Exception as exc:
        logger.error('audit_log_failed action=%s error=%s', action, exc)
    finally:
        if conn:
            conn.close()


def log_security_event(event_type, severity='info', details=None, user_id=None):
    serialized_details = serialize_log_payload(details)
    conn = None
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO security_logs (event_type, severity, details, ip_address, user_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            event_type,
            severity,
            serialized_details,
            request.remote_addr if request else None,
            user_id,
        ))
        conn.commit()
    except Exception as exc:
        logger.error('security_log_failed event=%s error=%s', event_type, exc)
    finally:
        if conn:
            conn.close()

    log_method = logger.info
    if severity == 'warning':
        log_method = logger.warning
    elif severity in {'error', 'critical'}:
        log_method = logger.error
    log_method('security_event type=%s user_id=%s details=%s', event_type, user_id, serialized_details)


def accrue_investment_profits(conn, user_id=None, now=None):
    auto_credit_enabled = bool(get_system_setting(conn, 'profit_auto_credit_enabled', True))
    distribution_mode = str(get_system_setting(conn, 'profit_distribution_mode', 'monthly') or 'monthly').lower()
    referral_bonus_rate = float(get_system_setting(conn, 'referral_bonus', 0) or 0)
    if distribution_mode not in {'daily', 'monthly'}:
        distribution_mode = 'monthly'

    if not auto_credit_enabled:
        return {'credited_amount': 0.0, 'updated_positions': 0, 'mode': distribution_mode}

    payout_currency = conn.execute(
        "SELECT id FROM currencies WHERE code = 'USDT' AND is_active = 1"
    ).fetchone()
    if not payout_currency:
        return {'credited_amount': 0.0, 'updated_positions': 0, 'mode': distribution_mode}

    referral_network = conn.execute('''
        SELECT id
        FROM networks
        WHERE currency_id = ? AND is_active = 1
        ORDER BY id ASC
        LIMIT 1
    ''', (payout_currency['id'],)).fetchone()

    interval_days = 1 if distribution_mode == 'daily' else 30
    current_time = now or datetime.now()
    where_user = 'AND ui.user_id = ?' if user_id is not None else ''
    params = (user_id,) if user_id is not None else ()

    positions = conn.execute(f'''
        SELECT
            ui.id,
            ui.user_id,
            ui.amount,
            ui.returns,
            ui.investment_date,
            ui.last_profit_date,
            u.referred_by_user_id,
            i.return_rate,
            i.duration
        FROM user_investments ui
        JOIN users u ON u.id = ui.user_id
        JOIN investments i ON i.id = ui.investment_id
        WHERE ui.status = 'active' AND i.status = 'active' {where_user}
    ''', params).fetchall()

    cursor = conn.cursor()
    total_credited = 0.0
    updated_positions = 0

    for position in positions:
        try:
            investment_date = datetime.fromisoformat(str(position['investment_date']))
        except ValueError:
            continue

        if position['last_profit_date']:
            try:
                last_profit_date = datetime.fromisoformat(str(position['last_profit_date']))
            except ValueError:
                last_profit_date = investment_date
        else:
            last_profit_date = investment_date

        investment_end = investment_date + timedelta(days=max(int(position['duration']), 0) * 30)
        accrual_end = min(current_time, investment_end)
        if accrual_end <= last_profit_date:
            continue

        elapsed_seconds = (accrual_end - last_profit_date).total_seconds()
        periods = int(elapsed_seconds // (interval_days * 86400))
        if periods <= 0:
            continue

        period_rate = (float(position['return_rate']) / 100.0)
        if distribution_mode == 'daily':
            period_rate /= 30.0

        profit_amount = round(float(position['amount']) * period_rate * periods, 8)
        if profit_amount <= 0:
            continue

        next_profit_date = last_profit_date + timedelta(days=interval_days * periods)
        cursor.execute('''
            UPDATE user_investments
            SET returns = returns + ?, last_profit_date = ?
            WHERE id = ?
        ''', (
            profit_amount,
            next_profit_date.strftime('%Y-%m-%d %H:%M:%S'),
            position['id']
        ))
        cursor.execute('''
            UPDATE user_wallets
            SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = ?
        ''', (
            profit_amount,
            position['user_id'],
            payout_currency['id']
        ))

        if referral_bonus_rate > 0 and position['referred_by_user_id']:
            referral_amount = round(profit_amount * (referral_bonus_rate / 100.0), 8)
            if referral_amount > 0:
                cursor.execute('''
                    UPDATE user_wallets
                    SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND currency_id = ?
                ''', (
                    referral_amount,
                    position['referred_by_user_id'],
                    payout_currency['id']
                ))
                cursor.execute('''
                    INSERT INTO transactions (
                        user_id, type, currency_id, network_id, amount,
                        tx_hash, admin_wallet_address, status, note, verified_at
                    ) VALUES (?, 'referral_bonus', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
                ''', (
                    position['referred_by_user_id'],
                    payout_currency['id'],
                    referral_network['id'] if referral_network else 1,
                    referral_amount,
                    f"مكافأة إحالة من أرباح المستخدم #{position['user_id']}"
                ))

        total_credited += profit_amount
        updated_positions += 1

    return {
        'credited_amount': round(total_credited, 8),
        'updated_positions': updated_positions,
        'mode': distribution_mode
    }


def parse_positive_float(value, field_name):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} must be a valid number')

    if amount <= 0:
        raise ValueError(f'{field_name} must be greater than zero')

    return amount


def parse_non_negative_float(value, field_name):
    try:
        amount = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} must be a valid number')

    if amount < 0:
        raise ValueError(f'{field_name} cannot be negative')

    return amount


def slugify_governorate(name):
    base = ''.join(ch.lower() if ch.isalnum() else '-' for ch in name.strip())
    return '-'.join(part for part in base.split('-') if part)[:80] or uuid.uuid4().hex[:12]


def resolve_country_info(country_code):
    normalized_code = str(country_code or '').strip().upper()
    if normalized_code in COUNTRY_NAME_BY_CODE:
        return {
            'code': normalized_code,
            'name': COUNTRY_NAME_BY_CODE[normalized_code]
        }
    return {
        'code': 'SY',
        'name': COUNTRY_NAME_BY_CODE['SY']
    }


def detect_country_from_request(req):
    candidate_headers = [
        'CF-IPCountry',
        'X-Country-Code',
        'CloudFront-Viewer-Country',
        'X-AppEngine-Country',
        'X-Country'
    ]
    for header in candidate_headers:
        value = str(req.headers.get(header, '') or '').strip().upper()
        if value in COUNTRY_NAME_BY_CODE:
            return {
                'code': value,
                'name': COUNTRY_NAME_BY_CODE[value],
                'source': header
            }

    accept_language = str(req.headers.get('Accept-Language', '') or '').lower()
    language_map = {
        'ar-sa': 'SA',
        'ar-ae': 'AE',
        'ar-qa': 'QA',
        'ar-kw': 'KW',
        'ar-bh': 'BH',
        'ar-om': 'OM',
        'ar-jo': 'JO',
        'ar-lb': 'LB',
        'ar-iq': 'IQ',
        'ar-sy': 'SY',
        'ar-ps': 'PS',
        'ar-eg': 'EG',
        'tr-tr': 'TR',
        'fa-ir': 'IR'
    }
    for prefix, code in language_map.items():
        if prefix in accept_language:
            return {
                'code': code,
                'name': COUNTRY_NAME_BY_CODE[code],
                'source': 'Accept-Language'
            }

    fallback = resolve_country_info(os.environ.get('DEFAULT_COUNTRY_CODE', 'SY'))
    return {
        'code': fallback['code'],
        'name': fallback['name'],
        'source': 'default'
    }

# ميدلوير للتحقق من صلاحية الأدمن
def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        conn = get_db_connection()
        user = conn.execute(
            'SELECT role FROM users WHERE id = ? AND is_active = 1',
            (current_user_id,)
        ).fetchone()
        conn.close()
        
        if user and user['role'] == 'admin':
            return f(*args, **kwargs)
        else:
            return jsonify({'error': 'Admin access required', 'code': 'ADMIN_REQUIRED'}), 403
    return decorated_function

def register_route_modules():
    from routes import (
        register_admin_routes,
        register_auth_routes,
        register_investment_routes,
        register_settings_routes,
        register_site_routes,
        register_message_routes,
        register_transaction_routes,
        register_wallet_routes,
    )

    ctx = SimpleNamespace(
        admin_required=admin_required,
        bcrypt=bcrypt,
        create_email_verification_code=create_email_verification_code,
        create_password_reset_code=create_password_reset_code,
        create_access_token=create_access_token,
        generate_password_reset_token=generate_password_reset_token,
        generate_wallet_address=generate_wallet_address,
        create_withdrawal_verification_code=create_withdrawal_verification_code,
        get_db_connection=get_db_connection,
        get_system_setting=get_system_setting,
        get_jwt_identity=get_jwt_identity,
        get_password_reset_token=get_password_reset_token,
        log_audit_event=log_audit_event,
        log_security_event=log_security_event,
        logger=logger,
        verify_google_id_token=verify_google_id_token,
        accrue_investment_profits=accrue_investment_profits,
        jwt_required=jwt_required,
        limiter=limiter,
        parse_non_negative_float=parse_non_negative_float,
        parse_positive_float=parse_positive_float,
        send_email=send_email,
        get_last_email_error=get_last_email_error,
        send_password_reset_code_email=send_password_reset_code_email,
        send_password_reset_email=send_password_reset_code_email,
        send_verification_code_email=send_verification_code_email,
        slugify_governorate=slugify_governorate,
        middle_east_countries=MIDDLE_EAST_COUNTRIES,
        resolve_country_info=resolve_country_info,
        detect_country_from_request=detect_country_from_request,
        validate_email=validate_email,
        validate_password_strength=validate_password_strength,
        verify_jwt_in_request=verify_jwt_in_request,
    )

    register_auth_routes(app, ctx)
    register_wallet_routes(app, ctx)
    register_transaction_routes(app, ctx)
    register_message_routes(app, ctx)
    register_investment_routes(app, ctx)
    register_admin_routes(app, ctx)
    register_settings_routes(app, ctx)
    register_site_routes(app, ctx)


register_route_modules()


def build_health_payload():
    def check_directory_state(path):
        try:
            os.makedirs(path, exist_ok=True)
            probe_path = os.path.join(path, '.healthcheck.tmp')
            with open(probe_path, 'w', encoding='utf-8') as probe_file:
                probe_file.write('ok')
            os.remove(probe_path)
            return {'ok': True, 'path': path}
        except Exception as exc:
            return {'ok': False, 'path': path, 'error': str(exc)}

    database_ok = False
    database_error = None
    try:
        conn = get_db_connection()
        conn.execute('SELECT 1').fetchone()
        conn.close()
        database_ok = True
    except Exception as exc:
        database_error = str(exc)

    backup_folder = app.config.get('BACKUP_FOLDER', 'backups')
    uploads_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
    logs_folder = os.path.dirname(app.config.get('LOG_FILE', os.path.join('logs', 'app.log'))) or 'logs'
    backup_files = []
    if os.path.isdir(backup_folder):
        for name in os.listdir(backup_folder):
            path = os.path.join(backup_folder, name)
            if os.path.isfile(path) and name.lower().endswith('.db'):
                backup_files.append(path)
    latest_backup_path = max(backup_files, key=os.path.getmtime) if backup_files else None

    storage_checks = {
        'uploads': check_directory_state(uploads_folder),
        'logs': check_directory_state(logs_folder),
        'backups': check_directory_state(backup_folder)
    }
    services_ok = database_ok and all(item.get('ok') for item in storage_checks.values())

    return {
        'status': 'ok' if services_ok else 'degraded',
        'timestamp': datetime.now().isoformat(),
        'request_id': getattr(g, 'request_id', None),
        'environment': os.environ.get('FLASK_ENV', 'development'),
        'services': {
            'database': {
                'ok': database_ok,
                'error': database_error,
            },
            'mail': {
                'configured': bool(app.config.get('MAIL_USERNAME') and app.config.get('MAIL_PASSWORD'))
            },
            'storage': storage_checks,
            'backups': {
                'count': len(backup_files),
                'latest_backup_at': datetime.fromtimestamp(os.path.getmtime(latest_backup_path)).isoformat() if latest_backup_path else None,
                'latest_backup_name': os.path.basename(latest_backup_path) if latest_backup_path else None
            },
            'rate_limit': {
                'storage_uri': os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
            }
        }
    }


@app.route('/health', methods=['GET'])
@app.route('/api/health', methods=['GET'])
def health_check():
    payload = build_health_payload()
    status_code = 200 if payload['status'] == 'ok' else 503
    return jsonify(payload), status_code

# ==================== 9. معالجة الأخطاء ====================
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Not found', 'code': 'NOT_FOUND'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error('internal_server_error path=%s request_id=%s error=%s', request.path, getattr(g, 'request_id', ''), error)
    return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

# ==================== 10. تشغيل التطبيق ====================
if __name__ == '__main__':
    # إنشاء ملف SQL للمخطط
    with open(os.devnull, 'w', encoding='utf-8') as f:
        f.write("""
            -- نظام محافظ متعدد العملات
            CREATE TABLE IF NOT EXISTS currencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                symbol TEXT,
                is_active BOOLEAN DEFAULT 1,
                min_deposit REAL DEFAULT 50,
                min_withdraw REAL DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- الشبكات
            CREATE TABLE IF NOT EXISTS networks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT NOT NULL,
                fee_percentage REAL DEFAULT 0.0,
                fee_fixed REAL DEFAULT 0.0,
                min_amount REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (currency_id) REFERENCES currencies(id)
            );

            -- المستخدمين
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                is_active BOOLEAN DEFAULT 1,
                public_user_id TEXT UNIQUE,
                referral_code TEXT UNIQUE,
                referred_by_user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- محافظ المستخدمين
            CREATE TABLE IF NOT EXISTS user_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency_id INTEGER NOT NULL,
                address TEXT,
                balance REAL DEFAULT 0.0,
                pending_balance REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                UNIQUE(user_id, currency_id)
            );

            -- محافظ الأدمن
            CREATE TABLE IF NOT EXISTS admin_wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                address TEXT NOT NULL,
                label TEXT,
                current_balance REAL DEFAULT 0.0,
                total_received REAL DEFAULT 0.0,
                total_sent REAL DEFAULT 0.0,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- المعاملات
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                tx_hash TEXT,
                admin_wallet_address TEXT,
                status TEXT DEFAULT 'pending',
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP,
                admin_note TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- طلبات السحب
            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                currency_id INTEGER NOT NULL,
                network_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                fee REAL DEFAULT 0.0,
                wallet_address TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                admin_note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (currency_id) REFERENCES currencies(id),
                FOREIGN KEY (network_id) REFERENCES networks(id)
            );

            -- جدول رموز إعادة تعيين كلمة المرور
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS password_reset_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            -- الاستثمارات
            CREATE TABLE IF NOT EXISTS investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                image_url TEXT,
                source_label TEXT,
                source_url TEXT,
                source_published_at TEXT,
                total_amount REAL NOT NULL,
                admin_amount REAL DEFAULT 0,
                min_investment REAL NOT NULL,
                return_rate REAL NOT NULL,
                duration INTEGER NOT NULL,
                start_date TEXT,
                end_date TEXT,
                category TEXT,
                collected REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                added_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (added_by) REFERENCES users(id)
            );

            -- استثمارات المستخدمين
            CREATE TABLE IF NOT EXISTS user_investments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                investment_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                returns REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                role TEXT DEFAULT 'user',
                investment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_profit_date TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (investment_id) REFERENCES investments(id)
            );

            -- الإعدادات
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                data_type TEXT DEFAULT 'string',
                category TEXT DEFAULT 'general',
                description TEXT,
                is_editable BOOLEAN DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
    
    init_db()
    print("[INFO] Server starting on http://localhost:2000")
    print("[INFO] Default admin email: admin@invest.com")
    print("[WARN] Change the default admin password before exposing this service.")
    app.run(debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true', port=2000)

