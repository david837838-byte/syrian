import json
import os
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename


def register_auth_routes(app, ctx):
    def build_public_user_id(user_id):
        return str(100000 + int(user_id))

    def build_referral_code(user_id):
        return f"INV{build_public_user_id(user_id)}"

    def is_setting_enabled(conn, key, default=True):
        row = conn.execute(
            'SELECT value FROM system_settings WHERE key = ?',
            (key,)
        ).fetchone()
        if not row:
            return default
        return str(row['value']).lower() == 'true'

    def is_email_verification_enabled(conn):
        return is_setting_enabled(conn, 'email_verification', False)

    def resolve_referred_by_user_id(conn, referral_input):
        normalized_referral = str(referral_input or '').strip().upper()
        if not normalized_referral:
            return None
        referrer = conn.execute('''
            SELECT id
            FROM users
            WHERE UPPER(referral_code) = ?
              AND is_active = 1
        ''', (normalized_referral,)).fetchone()
        if not referrer:
            raise ValueError('رمز الإحالة غير صحيح')
        return referrer['id']

    def normalize_account_type(value):
        normalized = str(value or 'individual').strip().lower()
        return normalized if normalized in {'individual', 'company'} else 'individual'

    def load_company_profile(conn, user_id):
        row = conn.execute('''
            SELECT
                id,
                user_id,
                company_name,
                trade_name,
                registration_number,
                representative_name,
                representative_title,
                company_email,
                company_phone,
                country_code,
                country_name,
                city,
                address,
                website_url,
                description,
                logo_url,
                document_urls_json,
                verification_status,
                verification_note,
                submitted_at,
                reviewed_at,
                verified_at,
                approved_by_user_id,
                wallet_setup_fee_paid,
                wallet_setup_fee_paid_at,
                wallet_setup_fee_transaction_id,
                created_at,
                updated_at
            FROM company_profiles
            WHERE user_id = ?
        ''', (user_id,)).fetchone()
        if not row:
            return None
        payload = dict(row)
        document_urls = []
        if payload.get('document_urls_json'):
            try:
                parsed_documents = json.loads(payload['document_urls_json'])
                if isinstance(parsed_documents, list):
                    document_urls = [str(item).strip() for item in parsed_documents if str(item).strip()]
            except json.JSONDecodeError:
                document_urls = []
        payload['document_urls'] = document_urls
        return payload

    def build_user_payload(user, company_profile=None):
        kyc_status = user['kyc_status'] if 'kyc_status' in user.keys() else 'not_submitted'
        kyc_document_urls = []
        if 'kyc_document_urls_json' in user.keys() and user['kyc_document_urls_json']:
            try:
                parsed_urls = json.loads(user['kyc_document_urls_json'])
                if isinstance(parsed_urls, list):
                    kyc_document_urls = parsed_urls
            except json.JSONDecodeError:
                kyc_document_urls = []
        company_data = company_profile
        if company_data is None and 'company_name' in user.keys() and user['company_name']:
            company_data = {
                'company_name': user['company_name'],
                'trade_name': user['trade_name'] if 'trade_name' in user.keys() else '',
                'registration_number': user['registration_number'] if 'registration_number' in user.keys() else '',
                'representative_name': user['representative_name'] if 'representative_name' in user.keys() else '',
                'representative_title': user['representative_title'] if 'representative_title' in user.keys() else '',
                'company_email': user['company_email'] if 'company_email' in user.keys() else '',
                'company_phone': user['company_phone'] if 'company_phone' in user.keys() else '',
                'country_code': user['company_country_code'] if 'company_country_code' in user.keys() else '',
                'country_name': user['company_country_name'] if 'company_country_name' in user.keys() else '',
                'city': user['company_city'] if 'company_city' in user.keys() else '',
                'address': user['company_address'] if 'company_address' in user.keys() else '',
                'website_url': user['company_website_url'] if 'company_website_url' in user.keys() else '',
                'description': user['company_description'] if 'company_description' in user.keys() else '',
                'logo_url': user['company_logo_url'] if 'company_logo_url' in user.keys() else '',
                'document_urls': [],
                'verification_status': user['company_verification_status'] if 'company_verification_status' in user.keys() else 'draft',
                'verification_note': user['company_verification_note'] if 'company_verification_note' in user.keys() else '',
                'submitted_at': user['company_submitted_at'] if 'company_submitted_at' in user.keys() else None,
                'reviewed_at': user['company_reviewed_at'] if 'company_reviewed_at' in user.keys() else None,
                'verified_at': user['company_verified_at'] if 'company_verified_at' in user.keys() else None,
                'approved_by_user_id': user['company_approved_by_user_id'] if 'company_approved_by_user_id' in user.keys() else None,
                'wallet_setup_fee_paid': bool(user['company_wallet_setup_fee_paid']) if 'company_wallet_setup_fee_paid' in user.keys() else False,
                'wallet_setup_fee_paid_at': user['company_wallet_setup_fee_paid_at'] if 'company_wallet_setup_fee_paid_at' in user.keys() else None,
                'wallet_setup_fee_transaction_id': user['company_wallet_setup_fee_transaction_id'] if 'company_wallet_setup_fee_transaction_id' in user.keys() else None
            }
        return {
            'id': user['id'],
            'public_user_id': user['public_user_id'] if 'public_user_id' in user.keys() else build_public_user_id(user['id']),
            'name': user['name'],
            'email': user['email'],
            'phone': user['phone'],
            'role': user['role'],
            'created_at': user['created_at'] if 'created_at' in user.keys() else None,
            'is_active': bool(user['is_active']) if 'is_active' in user.keys() else True,
            'account_type': normalize_account_type(user['account_type'] if 'account_type' in user.keys() else 'individual'),
            'referral_code': user['referral_code'] if 'referral_code' in user.keys() else build_referral_code(user['id']),
            'email_verified': bool(user['email_verified']) if 'email_verified' in user.keys() else False,
            'auth_provider': user['auth_provider'] if 'auth_provider' in user.keys() else 'password',
            'google_linked': bool(user['google_sub']) if 'google_sub' in user.keys() and user['google_sub'] else False,
            'preferred_country_code': user['preferred_country_code'] if 'preferred_country_code' in user.keys() else 'SY',
            'preferred_country_name': user['preferred_country_name'] if 'preferred_country_name' in user.keys() else 'سوريا',
            'detected_country_code': user['detected_country_code'] if 'detected_country_code' in user.keys() else 'SY',
            'detected_country_name': user['detected_country_name'] if 'detected_country_name' in user.keys() else 'سوريا',
            'kyc_status': kyc_status,
            'kyc_document_type': user['kyc_document_type'] if 'kyc_document_type' in user.keys() else '',
            'kyc_full_name': user['kyc_full_name'] if 'kyc_full_name' in user.keys() else '',
            'kyc_submitted_at': user['kyc_submitted_at'] if 'kyc_submitted_at' in user.keys() else None,
            'kyc_verified_at': user['kyc_verified_at'] if 'kyc_verified_at' in user.keys() else None,
            'kyc_reviewed_at': user['kyc_reviewed_at'] if 'kyc_reviewed_at' in user.keys() else None,
            'kyc_rejection_note': user['kyc_rejection_note'] if 'kyc_rejection_note' in user.keys() else '',
            'kyc_document_urls': kyc_document_urls,
            'company_profile': company_data
        }

    def merge_auth_provider(current_provider, new_provider='google'):
        current = str(current_provider or 'password').strip().lower()
        if current == new_provider:
            return new_provider
        if new_provider in current:
            return current
        if current in {'', 'password'}:
            return f'password_{new_provider}'
        return f'{current}_{new_provider}'

    def get_client_ip():
        forwarded_for = request.headers.get('X-Forwarded-For', '')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return request.remote_addr

    def get_user_agent():
        return str(request.headers.get('User-Agent') or '').strip()

    def get_client_device_id():
        submitted = str(request.headers.get('X-Device-Id') or '').strip()
        if submitted:
            return submitted[:160]
        fallback = f"{get_client_ip()}|{get_user_agent()}"
        return hashlib.sha256(fallback.encode('utf-8')).hexdigest()

    def get_client_device_name():
        submitted = str(request.headers.get('X-Device-Name') or '').strip()
        if submitted:
            return submitted[:255]
        return 'متصفح غير مسمى'

    def resolve_user_country(submitted_country_code=None):
        detected = ctx.detect_country_from_request(request)
        preferred = ctx.resolve_country_info(submitted_country_code or detected['code'])
        return {
            'preferred_code': preferred['code'],
            'preferred_name': preferred['name'],
            'detected_code': detected['code'],
            'detected_name': detected['name'],
            'source': detected.get('source', 'default')
        }

    def get_numeric_setting(conn, key, default):
        value = ctx.get_system_setting(conn, key, default)
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def sanitize_plain_text(value, max_length=255):
        cleaned = ''.join(ch for ch in str(value or '') if ch.isprintable())
        cleaned = cleaned.replace('<', '').replace('>', '').replace('{', '').replace('}', '').strip()
        return cleaned[:max_length]

    def normalize_uploaded_url_list(items):
        normalized = []
        if not isinstance(items, list):
            return normalized
        for item in items:
            url = str(item or '').strip()
            if url and url not in normalized:
                normalized.append(url)
        return normalized

    def get_device_attempt_record(conn, scope, identifier, device_id):
        return conn.execute('''
            SELECT *
            FROM auth_device_attempts
            WHERE scope = ? AND identifier = ? AND device_id = ?
            LIMIT 1
        ''', (scope, identifier, device_id)).fetchone()

    def is_device_locked(record):
        if not record or not record['locked_until']:
            return False
        try:
            locked_until_dt = datetime.strptime(str(record['locked_until']), '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
            return locked_until_dt > datetime.now(timezone.utc)
        except ValueError:
            return False

    def upsert_user_device_activity(conn, user_id, updates=None):
        updates = updates or {}
        device_id = get_client_device_id()
        device_name = get_client_device_name()
        ip_address = get_client_ip()
        user_agent = get_user_agent()

        conn.execute('''
            INSERT INTO user_device_activity (
                user_id, device_id, device_name, ip_address, user_agent, first_seen_at, last_seen_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, device_id) DO UPDATE SET
                device_name = excluded.device_name,
                ip_address = excluded.ip_address,
                user_agent = excluded.user_agent,
                last_seen_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        ''', (user_id, device_id, device_name, ip_address, user_agent))

        assignments = []
        params = []
        allowed_fields = {
            'last_login_at',
            'last_password_reset_request_at',
            'last_password_reset_at',
            'failed_login_attempts',
            'failed_reset_attempts',
            'lock_reason',
            'locked_until'
        }
        for key, value in updates.items():
            if key not in allowed_fields:
                continue
            assignments.append(f"{key} = ?")
            params.append(value)

        if assignments:
            assignments.append('updated_at = CURRENT_TIMESTAMP')
            params.extend([user_id, device_id])
            conn.execute(f'''
                UPDATE user_device_activity
                SET {', '.join(assignments)}
                WHERE user_id = ? AND device_id = ?
            ''', params)

    def clear_device_failures(conn, scope, identifier, user_id=None):
        device_id = get_client_device_id()
        conn.execute('''
            UPDATE auth_device_attempts
            SET failure_count = 0,
                locked_until = NULL,
                last_failure_at = NULL,
                updated_at = CURRENT_TIMESTAMP,
                user_id = COALESCE(?, user_id),
                ip_address = ?,
                user_agent = ?,
                device_name = ?
            WHERE scope = ? AND identifier = ? AND device_id = ?
        ''', (user_id, get_client_ip(), get_user_agent(), get_client_device_name(), scope, identifier, device_id))

    def register_device_failure(conn, scope, identifier, max_attempts, lockout_minutes, user_id=None):
        device_id = get_client_device_id()
        record = get_device_attempt_record(conn, scope, identifier, device_id)
        next_attempt_count = int(record['failure_count'] or 0) + 1 if record else 1
        lock_until = None
        if next_attempt_count >= max_attempts:
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)).strftime('%Y-%m-%d %H:%M:%S')

        conn.execute('''
            INSERT INTO auth_device_attempts (
                scope, identifier, user_id, device_id, device_name, ip_address, user_agent,
                failure_count, locked_until, last_failure_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(scope, identifier, device_id) DO UPDATE SET
                user_id = COALESCE(excluded.user_id, auth_device_attempts.user_id),
                device_name = excluded.device_name,
                ip_address = excluded.ip_address,
                user_agent = excluded.user_agent,
                failure_count = ?,
                locked_until = ?,
                last_failure_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        ''', (
            scope, identifier, user_id, device_id, get_client_device_name(), get_client_ip(), get_user_agent(),
            next_attempt_count, lock_until, next_attempt_count, lock_until
        ))

        return {
            'attempts': next_attempt_count,
            'locked_until': lock_until,
            'max_attempts': max_attempts,
            'lockout_minutes': lockout_minutes,
            'device_id': device_id
        }

    def record_login_attempt(conn, email, success, user_id=None):
        conn.execute('''
            INSERT INTO login_attempts (email, ip_address, success)
            VALUES (?, ?, ?)
        ''', (email, get_client_ip(), 1 if success else 0))
        if success:
            ctx.logger.info('login_success email=%s user_id=%s ip=%s', email, user_id, get_client_ip())
        else:
            ctx.logger.warning('login_failed email=%s user_id=%s ip=%s', email, user_id, get_client_ip())

    def clear_login_failures(conn, user_id):
        conn.execute('''
            UPDATE users
            SET failed_login_attempts = 0,
                locked_until = NULL,
                last_failed_login_at = NULL,
                last_login = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (user_id,))
        upsert_user_device_activity(conn, user_id, {
            'failed_login_attempts': 0,
            'lock_reason': None,
            'locked_until': None,
            'last_login_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        })

    def register_failed_login(conn, user):
        max_attempts = max(1, get_numeric_setting(conn, 'max_login_attempts', 5))
        lockout_minutes = max(1, get_numeric_setting(conn, 'lockout_duration_minutes', 15))
        next_attempt_count = int(user['failed_login_attempts'] or 0) + 1
        lock_until = None

        if next_attempt_count >= max_attempts:
            lock_until = (datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)).strftime('%Y-%m-%d %H:%M:%S')

        conn.execute('''
            UPDATE users
            SET failed_login_attempts = ?,
                locked_until = ?,
                last_failed_login_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (next_attempt_count, lock_until, user['id']))

        upsert_user_device_activity(conn, user['id'], {
            'failed_login_attempts': next_attempt_count,
            'lock_reason': 'login' if lock_until else None,
            'locked_until': lock_until
        })

        return {
            'attempts': next_attempt_count,
            'locked_until': lock_until,
            'max_attempts': max_attempts,
            'lockout_minutes': lockout_minutes,
        }

    def is_user_locked(user):
        locked_until = user['locked_until'] if 'locked_until' in user.keys() else None
        if not locked_until:
            return False
        try:
            locked_until_dt = datetime.strptime(str(locked_until), '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
            return locked_until_dt > datetime.now(timezone.utc)
        except ValueError:
            return False

    @app.route('/api/auth/register', methods=['POST'])
    @ctx.limiter.limit("5 per hour")
    def register():
        try:
            data = request.get_json() or {}

            required_fields = ['name', 'email', 'password', 'phone']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                email = ctx.validate_email(data['email'])
                ctx.validate_password_strength(data['password'])
            except Exception as e:
                code = 'INVALID_EMAIL' if 'email' in str(e).lower() else 'WEAK_PASSWORD'
                return jsonify({'error': str(e), 'code': code}), 400

            account_type = normalize_account_type(data.get('account_type'))
            company_name = sanitize_plain_text(data.get('company_name'), 180)
            representative_name = sanitize_plain_text(data.get('representative_name'), 160)

            conn = ctx.get_db_connection()
            registration_enabled = is_setting_enabled(conn, 'registration_enabled', True)
            if not registration_enabled:
                conn.close()
                return jsonify({
                    'error': 'التسجيل متوقف حالياً من إعدادات المنصة',
                    'code': 'REGISTRATION_DISABLED'
                }), 403

            if account_type == 'company' and not is_setting_enabled(conn, 'company_accounts_enabled', True):
                conn.close()
                return jsonify({
                    'error': 'Company accounts are currently disabled from platform settings',
                    'code': 'COMPANY_ACCOUNTS_DISABLED'
                }), 403

            if account_type == 'company':
                if not company_name:
                    conn.close()
                    return jsonify({'error': 'Company name is required', 'code': 'MISSING_COMPANY_NAME'}), 400
                if not representative_name:
                    conn.close()
                    return jsonify({'error': 'Representative name is required', 'code': 'MISSING_COMPANY_REPRESENTATIVE'}), 400

            existing_user = conn.execute(
                'SELECT id FROM users WHERE email = ?',
                (email,)
            ).fetchone()

            if existing_user:
                conn.close()
                return jsonify({'error': 'Email already registered', 'code': 'EMAIL_EXISTS'}), 409

            email_verification_enabled = is_email_verification_enabled(conn)
            hashed_password = ctx.bcrypt.generate_password_hash(data['password']).decode('utf-8')
            referred_by_user_id = None
            user_country = resolve_user_country(data.get('country_code'))

            try:
                referred_by_user_id = resolve_referred_by_user_id(conn, data.get('referral_code'))
            except ValueError as exc:
                conn.close()
                return jsonify({'error': str(exc), 'code': 'INVALID_REFERRAL_CODE'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO users (
                    name, email, phone, password, role, account_type, is_active, email_verified, referred_by_user_id,
                    preferred_country_code, preferred_country_name, detected_country_code, detected_country_name
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                sanitize_plain_text(data['name'], 120),
                email,
                sanitize_plain_text(data['phone'], 40),
                hashed_password,
                'user',
                account_type,
                1,
                0 if email_verification_enabled else 1,
                referred_by_user_id,
                user_country['preferred_code'],
                user_country['preferred_name'],
                user_country['detected_code'],
                user_country['detected_name']
            ))

            user_id = cursor.lastrowid
            public_user_id = build_public_user_id(user_id)
            referral_code = build_referral_code(user_id)
            cursor.execute('''
                UPDATE users
                SET public_user_id = ?, referral_code = ?
                WHERE id = ?
            ''', (public_user_id, referral_code, user_id))

            currencies = conn.execute('SELECT id FROM currencies WHERE is_active = 1').fetchall()
            for currency in currencies:
                cursor.execute('''
                    INSERT INTO user_wallets (user_id, currency_id, address, balance)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, currency['id'], None, 0.0))

            if account_type == 'company':
                company_country = ctx.resolve_country_info(
                    str(data.get('company_country_code') or user_country['preferred_code']).strip().upper() or user_country['preferred_code']
                )
                cursor.execute('''
                    INSERT INTO company_profiles (
                        user_id, company_name, trade_name, registration_number, representative_name,
                        representative_title, company_email, company_phone, country_code, country_name,
                        city, address, website_url, description, verification_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
                ''', (
                    user_id,
                    company_name,
                    sanitize_plain_text(data.get('trade_name'), 180),
                    sanitize_plain_text(data.get('registration_number'), 120),
                    representative_name,
                    sanitize_plain_text(data.get('representative_title'), 140),
                    sanitize_plain_text(data.get('company_email') or email, 190),
                    sanitize_plain_text(data.get('company_phone') or data.get('phone'), 50),
                    company_country['code'],
                    company_country['name'],
                    sanitize_plain_text(data.get('company_city'), 120),
                    sanitize_plain_text(data.get('company_address'), 255),
                    sanitize_plain_text(data.get('company_website_url'), 255),
                    sanitize_plain_text(data.get('company_description'), 500)
                ))

            verification_code = None
            if email_verification_enabled:
                verification_code = ctx.create_email_verification_code(conn, user_id)

            conn.commit()

            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified
                     , auth_provider, google_sub, preferred_country_code, preferred_country_name, detected_country_code, detected_country_name
                FROM users WHERE id = ?
            ''', (user_id,)).fetchone()
            company_profile = load_company_profile(conn, user_id) if account_type == 'company' else None
            conn.close()
            ctx.log_audit_event(
                action='auth.register',
                user_id=user_id,
                entity_type='user',
                entity_id=user_id,
                new_value={'email': email, 'public_user_id': public_user_id}
            )

            if email_verification_enabled:
                delivery_status = ctx.send_verification_code_email(
                    email,
                    sanitize_plain_text(data['name'], 120),
                    verification_code
                )
                message = 'تم إنشاء الحساب وإرسال كود التحقق إلى بريدك الإلكتروني.'
                if not delivery_status:
                    message = 'تم إنشاء الحساب. تعذر إرسال الكود حالياً، ويمكنك إعادة الإرسال لاحقاً بعد تجهيز البريد.'
                return jsonify({
                    'success': True,
                    'message': message,
                    'data': {
                        'verification_required': True,
                        'email': email,
                        'delivery_sent': bool(delivery_status),
                        'user': build_user_payload(user, company_profile)
                    }
                }), 201

            access_token = ctx.create_access_token(
                identity=str(user_id),
                additional_claims={'role': 'user'}
            )

            return jsonify({
                'success': True,
                'message': 'تم تسجيل الحساب بنجاح',
                'data': {
                    'user': build_user_payload(user, company_profile),
                    'access_token': access_token
                }
            }), 201

        except Exception as e:
            print(f"Register error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/google', methods=['POST'])
    @ctx.limiter.limit("10 per hour")
    def google_auth():
        try:
            data = request.get_json() or {}
            google_token = str(data.get('id_token') or '').strip()
            if not google_token:
                return jsonify({'error': 'Google credential is required', 'code': 'MISSING_GOOGLE_CREDENTIAL'}), 400

            try:
                google_profile = ctx.verify_google_id_token(google_token)
            except Exception as exc:
                return jsonify({'error': str(exc), 'code': 'GOOGLE_TOKEN_INVALID'}), 400

            conn = ctx.get_db_connection()
            try:
                referred_by_user_id = resolve_referred_by_user_id(conn, data.get('referral_code'))
            except ValueError as exc:
                conn.close()
                return jsonify({'error': str(exc), 'code': 'INVALID_REFERRAL_CODE'}), 400

            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name, detected_country_code, detected_country_name
                FROM users
                WHERE google_sub = ? OR email = ?
                ORDER BY CASE WHEN google_sub = ? THEN 0 ELSE 1 END
                LIMIT 1
            ''', (google_profile['sub'], google_profile['email'], google_profile['sub'])).fetchone()

            is_new_user = False
            user_country = resolve_user_country(data.get('country_code'))
            if user:
                if not user['is_active']:
                    conn.close()
                    return jsonify({'error': 'Account is deactivated', 'code': 'ACCOUNT_INACTIVE'}), 403

                conn.execute('''
                    UPDATE users
                    SET google_sub = ?,
                        auth_provider = ?,
                        email_verified = 1,
                        email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                        avatar_url = ?,
                        detected_country_code = ?,
                        detected_country_name = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    google_profile['sub'],
                    merge_auth_provider(user['auth_provider'], 'google'),
                    google_profile['picture'],
                    user_country['detected_code'],
                    user_country['detected_name'],
                    user['id']
                ))
                clear_login_failures(conn, user['id'])
                conn.commit()
            else:
                generated_password = ctx.bcrypt.generate_password_hash(f"{google_profile['sub']}Aa1!").decode('utf-8')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO users (
                        name, email, phone, password, role, account_type, is_active, email_verified,
                        email_verified_at, public_user_id, referral_code, referred_by_user_id,
                        auth_provider, google_sub, avatar_url,
                        preferred_country_code, preferred_country_name, detected_country_code, detected_country_name
                    ) VALUES (?, ?, ?, ?, 'user', 'individual', 1, 1, CURRENT_TIMESTAMP, NULL, NULL, ?, 'google', ?, ?, ?, ?, ?, ?)
                ''', (
                    google_profile['name'],
                    google_profile['email'],
                    '',
                    generated_password,
                    referred_by_user_id,
                    google_profile['sub'],
                    google_profile['picture'],
                    user_country['preferred_code'],
                    user_country['preferred_name'],
                    user_country['detected_code'],
                    user_country['detected_name']
                ))
                user_id = cursor.lastrowid
                public_user_id = build_public_user_id(user_id)
                referral_code = build_referral_code(user_id)
                cursor.execute('''
                    UPDATE users
                    SET public_user_id = ?, referral_code = ?
                    WHERE id = ?
                ''', (public_user_id, referral_code, user_id))

                currencies = conn.execute('SELECT id FROM currencies WHERE is_active = 1').fetchall()
                for currency in currencies:
                    cursor.execute('''
                        INSERT INTO user_wallets (user_id, currency_id, address, balance)
                        VALUES (?, ?, ?, ?)
                    ''', (user_id, currency['id'], None, 0.0))

                conn.commit()
                is_new_user = True

            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name, detected_country_code, detected_country_name
                FROM users
                WHERE google_sub = ? OR email = ?
                ORDER BY CASE WHEN google_sub = ? THEN 0 ELSE 1 END
                LIMIT 1
            ''', (google_profile['sub'], google_profile['email'], google_profile['sub'])).fetchone()
            clear_login_failures(conn, user['id'])
            record_login_attempt(conn, user['email'], True, user['id'])
            company_profile = load_company_profile(conn, user['id']) if normalize_account_type(user['account_type']) == 'company' else None
            conn.commit()
            conn.close()

            ctx.log_audit_event(
                action='auth.google_register' if is_new_user else 'auth.google_login',
                user_id=user['id'],
                entity_type='user',
                entity_id=user['id'],
                new_value={'email': user['email'], 'auth_provider': 'google'}
            )

            access_token = ctx.create_access_token(
                identity=str(user['id']),
                additional_claims={'role': user['role']}
            )

            return jsonify({
                'success': True,
                'message': 'تم إنشاء الحساب عبر Google بنجاح' if is_new_user else 'تم تسجيل الدخول عبر Google بنجاح',
                'data': {
                    'user': build_user_payload(user, company_profile),
                    'access_token': access_token,
                    'is_new_user': is_new_user
                }
            }), 201 if is_new_user else 200

        except Exception as e:
            print(f"Google auth error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    @ctx.limiter.limit("10 per hour")
    def login():
        try:
            data = request.get_json() or {}

            if not data.get('email') or not data.get('password'):
                return jsonify({'error': 'Email and password required', 'code': 'MISSING_CREDENTIALS'}), 400

            conn = ctx.get_db_connection()
            submitted_email = data['email'].lower().strip()
            email_verification_enabled = is_email_verification_enabled(conn)
            max_attempts = max(1, get_numeric_setting(conn, 'device_login_attempts_limit', 6))
            lockout_minutes = max(1, get_numeric_setting(conn, 'device_lockout_duration_minutes', 60))
            device_id = get_client_device_id()
            device_record = get_device_attempt_record(conn, 'login', submitted_email, device_id)
            if is_device_locked(device_record):
                conn.close()
                return jsonify({
                    'error': 'هذا الجهاز محظور مؤقتًا من تسجيل الدخول بسبب كثرة المحاولات الفاشلة. أعد المحاولة بعد انتهاء مدة الحظر.',
                    'code': 'DEVICE_LOCKED',
                    'data': {
                        'locked_until': device_record['locked_until'],
                        'device_id': device_id
                    }
                }), 423
            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, password, role, account_type, is_active, phone, email_verified,
                       failed_login_attempts, locked_until, auth_provider, google_sub
                FROM users WHERE email = ?
            ''', (submitted_email,)).fetchone()

            if not user:
                register_device_failure(conn, 'login', submitted_email, max_attempts, lockout_minutes)
                record_login_attempt(conn, submitted_email, False)
                conn.commit()
                conn.close()
                ctx.log_security_event('auth.login_failed', 'warning', {'email': submitted_email, 'reason': 'user_not_found', 'device_id': device_id})
                return jsonify({'error': 'Invalid email or password', 'code': 'INVALID_CREDENTIALS'}), 401

            if not user['is_active']:
                conn.close()
                ctx.log_security_event(
                    event_type='auth.inactive_account_login_attempt',
                    severity='warning',
                    details={'email': submitted_email, 'device_id': device_id},
                    user_id=user['id'],
                )
                return jsonify({'error': 'Account is deactivated', 'code': 'ACCOUNT_INACTIVE'}), 403

            if is_user_locked(user):
                record_login_attempt(conn, submitted_email, False, user['id'])
                upsert_user_device_activity(conn, user['id'], {
                    'failed_login_attempts': int(user['failed_login_attempts'] or 0),
                    'lock_reason': 'login',
                    'locked_until': user['locked_until']
                })
                conn.commit()
                conn.close()
                ctx.log_security_event('auth.account_locked_login_attempt', 'warning', {'email': submitted_email, 'device_id': device_id}, user['id'])
                return jsonify({
                    'error': 'تم قفل الحساب مؤقتًا بسبب كثرة محاولات الدخول الفاشلة',
                    'code': 'ACCOUNT_LOCKED',
                    'data': {
                        'locked_until': user['locked_until']
                    }
                }), 423

            if not ctx.bcrypt.check_password_hash(user['password'], data['password']):
                lock_state = register_failed_login(conn, user)
                device_lock_state = register_device_failure(conn, 'login', submitted_email, max_attempts, lockout_minutes, user['id'])
                record_login_attempt(conn, submitted_email, False, user['id'])
                conn.commit()
                conn.close()
                ctx.log_security_event('auth.login_failed', 'warning', {
                    'email': submitted_email,
                    'attempts': lock_state['attempts'],
                    'device_attempts': device_lock_state['attempts'],
                    'device_id': device_lock_state['device_id']
                }, user['id'])
                if lock_state['locked_until'] or device_lock_state['locked_until']:
                    ctx.log_security_event('auth.account_locked', 'warning', {
                        'email': submitted_email,
                        'locked_until': device_lock_state['locked_until'] or lock_state['locked_until'],
                        'device_id': device_lock_state['device_id']
                    }, user['id'])
                    return jsonify({
                        'error': 'تم حظر هذا الجهاز مؤقتًا بسبب تكرار كلمة المرور الخاطئة.',
                        'code': 'DEVICE_LOCKED' if device_lock_state['locked_until'] else 'ACCOUNT_LOCKED',
                        'data': {
                            'locked_until': device_lock_state['locked_until'] or lock_state['locked_until'],
                            'attempts': device_lock_state['attempts'],
                            'device_id': device_lock_state['device_id']
                        }
                    }), 423
                return jsonify({'error': 'Invalid email or password', 'code': 'INVALID_CREDENTIALS'}), 401

            if email_verification_enabled and user['role'] != 'admin' and not user['email_verified']:
                record_login_attempt(conn, submitted_email, False, user['id'])
                conn.commit()
                conn.close()
                ctx.log_security_event('auth.email_not_verified_login', 'warning', {'email': submitted_email, 'device_id': device_id}, user['id'])
                return jsonify({
                    'error': 'يجب تأكيد البريد الإلكتروني أولاً',
                    'code': 'EMAIL_NOT_VERIFIED',
                    'data': {
                        'email': user['email']
                    }
                }), 403

            clear_login_failures(conn, user['id'])
            clear_device_failures(conn, 'login', submitted_email, user['id'])
            upsert_user_device_activity(conn, user['id'], {
                'last_login_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                'failed_login_attempts': 0,
                'lock_reason': None,
                'locked_until': None
            })
            record_login_attempt(conn, submitted_email, True, user['id'])
            company_profile = load_company_profile(conn, user['id']) if normalize_account_type(user['account_type']) == 'company' else None
            conn.commit()
            conn.close()
            ctx.log_audit_event(
                action='auth.login_success',
                user_id=user['id'],
                entity_type='user',
                entity_id=user['id'],
                new_value={'email': submitted_email, 'device_id': device_id}
            )

            access_token = ctx.create_access_token(
                identity=str(user['id']),
                additional_claims={'role': user['role']}
            )

            return jsonify({
                'success': True,
                'message': 'تم تسجيل الدخول بنجاح',
                'data': {
                    'user': build_user_payload(user, company_profile),
                    'access_token': access_token
                }
            }), 200

        except Exception as e:
            print(f"Login error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/verify-email', methods=['POST'])
    @ctx.limiter.limit("10 per hour")
    def verify_email():
        try:
            data = request.get_json() or {}
            email = data.get('email')
            code = str(data.get('code', '')).strip()

            if not email or not code:
                return jsonify({'error': 'Missing required fields', 'code': 'MISSING_FIELD'}), 400

            try:
                email = ctx.validate_email(email)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'INVALID_EMAIL'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, name, email, phone, role, account_type, is_active, email_verified
                       , public_user_id, referral_code, auth_provider, google_sub
                FROM users
                WHERE email = ?
            ''', (email,)).fetchone()

            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not user['is_active']:
                conn.close()
                return jsonify({'error': 'Account is deactivated', 'code': 'ACCOUNT_INACTIVE'}), 403

            if user['email_verified']:
                access_token = ctx.create_access_token(
                    identity=str(user['id']),
                    additional_claims={'role': user['role']}
                )
                conn.close()
                return jsonify({
                    'success': True,
                    'message': 'البريد الإلكتروني موثق بالفعل',
                    'data': {
                        'user': build_user_payload(user, load_company_profile(conn, user['id']) if normalize_account_type(user['account_type']) == 'company' else None),
                        'access_token': access_token
                    }
                }), 200

            code_row = conn.execute('''
                SELECT id
                FROM email_verification_codes
                WHERE user_id = ?
                  AND code = ?
                  AND used = 0
                  AND expires_at > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                LIMIT 1
            ''', (user['id'], code)).fetchone()

            if not code_row:
                conn.close()
                return jsonify({
                    'error': 'كود التحقق غير صحيح أو منتهي الصلاحية',
                    'code': 'INVALID_VERIFICATION_CODE'
                }), 400

            verified_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            conn.execute('UPDATE email_verification_codes SET used = 1 WHERE id = ?', (code_row['id'],))
            conn.execute(
                'UPDATE users SET email_verified = 1, email_verified_at = ? WHERE id = ?',
                (verified_at, user['id'])
            )
            conn.commit()

            updated_user = conn.execute('''
                SELECT id, name, email, phone, role, account_type, is_active, email_verified
                       , public_user_id, referral_code, auth_provider, google_sub
                FROM users
                WHERE id = ?
            ''', (user['id'],)).fetchone()
            company_profile = load_company_profile(conn, updated_user['id']) if normalize_account_type(updated_user['account_type']) == 'company' else None
            conn.close()

            access_token = ctx.create_access_token(
                identity=str(updated_user['id']),
                additional_claims={'role': updated_user['role']}
            )

            return jsonify({
                'success': True,
                'message': 'تم توثيق البريد الإلكتروني بنجاح',
                'data': {
                    'user': build_user_payload(updated_user, company_profile),
                    'access_token': access_token
                }
            }), 200

        except Exception as e:
            print(f"Verify email error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/resend-verification', methods=['POST'])
    @ctx.limiter.limit("5 per hour")
    def resend_verification():
        try:
            data = request.get_json() or {}
            email = data.get('email')

            if not email:
                return jsonify({'error': 'Missing required field: email', 'code': 'MISSING_FIELD'}), 400

            try:
                email = ctx.validate_email(email)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'INVALID_EMAIL'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, name, email, is_active, email_verified
                FROM users
                WHERE email = ?
            ''', (email,)).fetchone()

            if user and user['is_active'] and not user['email_verified']:
                code = ctx.create_email_verification_code(conn, user['id'])
                conn.commit()
                conn.close()
                delivery_status = ctx.send_verification_code_email(
                    user['email'],
                    user['name'] or 'المستخدم',
                    code
                )
                message = 'تم إرسال كود تحقق جديد إلى بريدك الإلكتروني.'
                if not delivery_status:
                    message = 'تم إنشاء كود جديد، لكن تعذر إرسال البريد حالياً. راجع إعدادات البريد ثم أعد المحاولة.'
                return jsonify({
                    'success': True,
                    'message': message,
                    'data': {
                        'delivery_sent': bool(delivery_status)
                    }
                }), 200

            conn.close()
            return jsonify({
                'success': True,
                'message': 'إذا كان الحساب يحتاج إلى التحقق فسيتم إرسال كود جديد.'
            }), 200

        except Exception as e:
            print(f"Resend verification error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/forgot-password', methods=['POST'])
    @ctx.limiter.limit("5 per hour")
    def forgot_password():
        try:
            data = request.get_json() or {}
            email = data.get('email')
            if not email:
                return jsonify({'error': 'Missing required field: email', 'code': 'MISSING_FIELD'}), 400

            try:
                email = ctx.validate_email(email)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'INVALID_EMAIL'}), 400

            conn = ctx.get_db_connection()
            max_attempts = max(1, get_numeric_setting(conn, 'device_reset_attempts_limit', 6))
            lockout_minutes = max(1, get_numeric_setting(conn, 'device_lockout_duration_minutes', 60))
            device_id = get_client_device_id()
            reset_device_record = get_device_attempt_record(conn, 'password_reset', email, device_id)
            if is_device_locked(reset_device_record):
                conn.close()
                return jsonify({
                    'error': 'هذا الجهاز محظور مؤقتًا من إعادة كلمة المرور بسبب كثرة المحاولات.',
                    'code': 'DEVICE_LOCKED',
                    'data': {
                        'locked_until': reset_device_record['locked_until'],
                        'device_id': device_id
                    }
                }), 423
            user = conn.execute('SELECT id, name, is_active FROM users WHERE email = ?', (email,)).fetchone()
            if user and user['is_active']:
                reset_link = ctx.create_password_reset_code(conn, user['id'])
                clear_device_failures(conn, 'password_reset', email, user['id'])
                upsert_user_device_activity(conn, user['id'], {
                    'last_password_reset_request_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                    'failed_reset_attempts': 0,
                    'lock_reason': None,
                    'locked_until': None
                })
                conn.commit()
                ctx.send_password_reset_email(email, user['name'] or 'المستخدم', reset_link)
            conn.close()
            return jsonify({
                'success': True,
                'message': 'If that email is registered, a password reset code has been sent.'
            }), 200

        except Exception as e:
            print(f"Forgot password error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/reset-password', methods=['POST'])
    def reset_password():
        try:
            data = request.get_json() or {}
            token = data.get('token')
            email = data.get('email')
            code = str(data.get('code', '')).strip()
            new_password = data.get('new_password')

            try:
                ctx.validate_password_strength(new_password)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'WEAK_PASSWORD'}), 400

            conn = ctx.get_db_connection()
            max_attempts = max(1, get_numeric_setting(conn, 'device_reset_attempts_limit', 6))
            lockout_minutes = max(1, get_numeric_setting(conn, 'device_lockout_duration_minutes', 60))
            device_id = get_client_device_id()
            if token:
                token_record = ctx.get_password_reset_token(token)
                if not token_record:
                    conn.close()
                    return jsonify({'error': 'Invalid or expired reset token', 'code': 'INVALID_RESET_TOKEN'}), 400

                password_hash = ctx.bcrypt.generate_password_hash(new_password).decode('utf-8')
                cursor = conn.cursor()
                cursor.execute(
                    'UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    (password_hash, token_record['user_id'])
                )
                cursor.execute('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', (token_record['id'],))
                upsert_user_device_activity(conn, token_record['user_id'], {
                    'last_password_reset_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                    'failed_reset_attempts': 0,
                    'lock_reason': None,
                    'locked_until': None
                })
                conn.commit()
                conn.close()
                ctx.log_audit_event(
                    action='auth.password_reset',
                    user_id=token_record['user_id'],
                    entity_type='user',
                    entity_id=token_record['user_id']
                )

                return jsonify({
                    'success': True,
                    'message': 'تم تحديث كلمة المرور بنجاح'
                }), 200

            if not email or not code or not new_password:
                conn.close()
                return jsonify({'error': 'Missing required fields', 'code': 'MISSING_FIELD'}), 400

            try:
                email = ctx.validate_email(email)
            except Exception as e:
                conn.close()
                return jsonify({'error': str(e), 'code': 'INVALID_EMAIL'}), 400

            reset_device_record = get_device_attempt_record(conn, 'password_reset', email, device_id)
            if is_device_locked(reset_device_record):
                conn.close()
                return jsonify({
                    'error': 'هذا الجهاز محظور مؤقتًا من إعادة كلمة المرور بسبب كثرة المحاولات.',
                    'code': 'DEVICE_LOCKED',
                    'data': {
                        'locked_until': reset_device_record['locked_until'],
                        'device_id': device_id
                    }
                }), 423

            user = conn.execute(
                'SELECT id, is_active FROM users WHERE email = ?',
                (email,)
            ).fetchone()
            if not user or not user['is_active']:
                conn.close()
                return jsonify({'error': 'Invalid reset request', 'code': 'INVALID_RESET_REQUEST'}), 400

            code_row = conn.execute('''
                SELECT id
                FROM password_reset_codes
                WHERE user_id = ?
                  AND code = ?
                  AND used = 0
                  AND expires_at > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                LIMIT 1
            ''', (user['id'], code)).fetchone()

            if not code_row:
                device_lock_state = register_device_failure(
                    conn,
                    'password_reset',
                    email,
                    max_attempts,
                    lockout_minutes,
                    user['id']
                )
                upsert_user_device_activity(conn, user['id'], {
                    'failed_reset_attempts': device_lock_state['attempts'],
                    'lock_reason': 'password_reset' if device_lock_state['locked_until'] else None,
                    'locked_until': device_lock_state['locked_until']
                })
                conn.commit()
                conn.close()
                return jsonify({
                    'error': 'تم حظر هذا الجهاز مؤقتًا بسبب تكرار كود إعادة التعيين الخاطئ.' if device_lock_state['locked_until'] else 'كود إعادة التعيين غير صحيح أو منتهي الصلاحية',
                    'code': 'DEVICE_LOCKED' if device_lock_state['locked_until'] else 'INVALID_RESET_CODE',
                    'data': {
                        'locked_until': device_lock_state['locked_until'],
                        'attempts': device_lock_state['attempts'],
                        'device_id': device_lock_state['device_id']
                    }
                }), 423 if device_lock_state['locked_until'] else 400

            password_hash = ctx.bcrypt.generate_password_hash(new_password).decode('utf-8')
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (password_hash, user['id'])
            )
            cursor.execute('UPDATE password_reset_codes SET used = 1 WHERE id = ?', (code_row['id'],))
            clear_device_failures(conn, 'password_reset', email, user['id'])
            upsert_user_device_activity(conn, user['id'], {
                'last_password_reset_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                'failed_reset_attempts': 0,
                'lock_reason': None,
                'locked_until': None
            })
            conn.commit()
            conn.close()
            ctx.log_audit_event(
                action='auth.password_reset',
                user_id=user['id'],
                entity_type='user',
                entity_id=user['id']
            )

            return jsonify({
                'success': True,
                'message': 'تم تحديث كلمة المرور بنجاح'
            }), 200

        except Exception as e:
            print(f"Reset password error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/logout', methods=['POST'])
    @ctx.jwt_required()
    def logout():
        return jsonify({
            'success': True,
            'message': 'تم تسجيل الخروج بنجاح'
        }), 200

    @app.route('/api/auth/profile', methods=['GET'])
    @ctx.jwt_required()
    def get_profile():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            ctx.accrue_investment_profits(conn, user_id)
            conn.commit()

            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, avatar_url, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users WHERE id = ?
            ''', (user_id,)).fetchone()

            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            wallets = conn.execute('''
                SELECT w.*, c.code, c.name as currency_name, c.symbol
                FROM user_wallets w
                JOIN currencies c ON w.currency_id = c.id
                WHERE w.user_id = ? AND c.is_active = 1
            ''', (user_id,)).fetchall()

            stats = conn.execute('''
                SELECT
                    COUNT(DISTINCT investment_id) as total_investments,
                    COALESCE(SUM(amount), 0) as total_invested,
                    COALESCE(SUM(returns), 0) as total_returns
                FROM user_investments
                WHERE user_id = ? AND status = 'active'
            ''', (user_id,)).fetchone()

            support = {
                'email': ctx.get_system_setting(conn, 'contact_email', 'support@invest-platform.com'),
                'phone': ctx.get_system_setting(conn, 'contact_phone', '+966500000000')
            }
            referral = {
                'bonus_rate': float(ctx.get_system_setting(conn, 'referral_bonus', 5) or 0),
                'referred_users_count': conn.execute(
                    'SELECT COUNT(*) FROM users WHERE referred_by_user_id = ?',
                    (user_id,)
                ).fetchone()[0],
                'total_earnings': conn.execute('''
                    SELECT COALESCE(SUM(amount), 0)
                    FROM transactions
                    WHERE user_id = ? AND type = 'referral_bonus' AND status = 'completed'
                ''', (user_id,)).fetchone()[0]
            }
            company_profile = load_company_profile(conn, user_id) if normalize_account_type(user['account_type']) == 'company' else None
            company_stats = None
            if company_profile:
                company_stats_row = conn.execute('''
                    SELECT
                        COUNT(*) as total_projects,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
                        COALESCE(SUM(total_amount), 0) as published_capital
                    FROM investments
                    WHERE added_by = ?
                ''', (user_id,)).fetchone()
                company_stats = {
                    'total_projects': int(company_stats_row['total_projects'] or 0),
                    'active_projects': int(company_stats_row['active_projects'] or 0),
                    'published_capital': float(company_stats_row['published_capital'] or 0),
                    'document_count': len(company_profile.get('document_urls') or [])
                }

            active_investments = conn.execute('''
                SELECT
                    ui.id,
                    ui.investment_id,
                    ui.amount,
                    ui.returns,
                    ui.investment_date,
                    i.name as project_name,
                    i.return_rate,
                    i.duration
                FROM user_investments ui
                JOIN investments i ON ui.investment_id = i.id
                WHERE ui.user_id = ? AND ui.status = 'active'
                ORDER BY ui.investment_date DESC
            ''', (user_id,)).fetchall()

            investments_list = []
            for item in active_investments:
                investments_list.append({
                    'id': item['id'],
                    'investment_id': item['investment_id'],
                    'amount': float(item['amount'] or 0),
                    'returns': float(item['returns'] or 0),
                    'investment_date': str(item['investment_date'] or ''),
                    'project_name': item['project_name'],
                    'return_rate': float(item['return_rate'] or 0),
                    'duration': int(item['duration'] or 0)
                })

            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'profile': build_user_payload(user, company_profile),
                    'wallets': [dict(w) for w in wallets],
                    'stats': dict(stats),
                    'support': support,
                    'referral': referral,
                    'company_stats': company_stats,
                    'active_investments': investments_list
                }
            }), 200

        except Exception as e:
            print(f"Profile error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/devices', methods=['GET'])
    @ctx.jwt_required()
    def get_known_devices():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            devices = conn.execute('''
                SELECT device_id, device_name, ip_address, user_agent, first_seen_at, last_seen_at,
                       last_login_at, last_password_reset_request_at, last_password_reset_at,
                       failed_login_attempts, failed_reset_attempts, lock_reason, locked_until
                FROM user_device_activity
                WHERE user_id = ?
                ORDER BY last_seen_at DESC
            ''', (user_id,)).fetchall()
            conn.close()

            current_device_id = get_client_device_id()
            return jsonify({
                'success': True,
                'data': {
                    'current_device_id': current_device_id,
                    'devices': [dict(device) for device in devices]
                }
            }), 200
        except Exception as e:
            print(f"Get known devices error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/profile', methods=['PUT'])
    @ctx.jwt_required()
    def update_profile():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            name = str(data.get('name') or '').strip()
            phone = str(data.get('phone') or '').strip()
            country_code = str(data.get('country_code') or '').strip().upper()

            if not name:
                return jsonify({'error': 'الاسم مطلوب', 'code': 'MISSING_NAME'}), 400

            country = ctx.resolve_country_info(country_code or 'SY')

            conn = ctx.get_db_connection()
            current_user = conn.execute('''
                SELECT id, account_type
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()
            if not current_user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            account_type = normalize_account_type(current_user['account_type'])
            conn.execute('''
                UPDATE users
                SET name = ?, phone = ?, preferred_country_code = ?, preferred_country_name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (name, phone, country['code'], country['name'], user_id))

            if account_type == 'company':
                existing_company = load_company_profile(conn, user_id) or {}
                company_country_code = str(
                    data.get('company_country_code')
                    or existing_company.get('country_code')
                    or country['code']
                ).strip().upper()
                company_country = ctx.resolve_country_info(company_country_code or country['code'])
                company_name = sanitize_plain_text(data.get('company_name') or existing_company.get('company_name'), 180)
                representative_name = sanitize_plain_text(data.get('representative_name') or existing_company.get('representative_name'), 180)

                if not company_name:
                    conn.close()
                    return jsonify({'error': 'اسم الشركة مطلوب', 'code': 'MISSING_COMPANY_NAME'}), 400

                if not representative_name:
                    conn.close()
                    return jsonify({'error': 'اسم ممثل الشركة مطلوب', 'code': 'MISSING_COMPANY_REPRESENTATIVE'}), 400

                company_values = (
                    company_name,
                    sanitize_plain_text(data.get('trade_name') or existing_company.get('trade_name'), 180),
                    sanitize_plain_text(data.get('registration_number') or existing_company.get('registration_number'), 120),
                    representative_name,
                    sanitize_plain_text(data.get('representative_title') or existing_company.get('representative_title'), 120),
                    sanitize_plain_text(data.get('company_email') or existing_company.get('company_email') or data.get('email'), 190),
                    sanitize_plain_text(data.get('company_phone') or existing_company.get('company_phone') or phone, 50),
                    company_country['code'],
                    company_country['name'],
                    sanitize_plain_text(data.get('company_city') or existing_company.get('city'), 120),
                    sanitize_plain_text(data.get('company_address') or existing_company.get('address'), 255),
                    sanitize_plain_text(data.get('company_website_url') or existing_company.get('website_url'), 255),
                    sanitize_plain_text(data.get('company_description') or existing_company.get('description'), 500),
                    sanitize_plain_text(data.get('company_logo_url') or existing_company.get('logo_url'), 255)
                )

                if existing_company:
                    conn.execute('''
                        UPDATE company_profiles
                        SET company_name = ?,
                            trade_name = ?,
                            registration_number = ?,
                            representative_name = ?,
                            representative_title = ?,
                            company_email = ?,
                            company_phone = ?,
                            country_code = ?,
                            country_name = ?,
                            city = ?,
                            address = ?,
                            website_url = ?,
                            description = ?,
                            logo_url = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                    ''', company_values + (user_id,))
                else:
                    conn.execute('''
                        INSERT INTO company_profiles (
                            user_id, company_name, trade_name, registration_number, representative_name,
                            representative_title, company_email, company_phone, country_code, country_name,
                            city, address, website_url, description, logo_url, verification_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
                    ''', (user_id,) + company_values)
            conn.commit()

            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()
            company_profile = load_company_profile(conn, user_id) if normalize_account_type(user['account_type']) == 'company' else None
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تحديث بيانات الحساب بنجاح',
                'data': {
                    'profile': build_user_payload(user, company_profile)
                }
            }), 200

        except Exception as e:
            print(f"Update profile error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/kyc/assets/upload', methods=['POST'])
    @ctx.jwt_required()
    def upload_account_kyc_assets():
        try:
            files = request.files.getlist('files')
            if not files:
                single_file = request.files.get('file')
                files = [single_file] if single_file else []

            valid_files = [file for file in files if file and file.filename]
            if not valid_files:
                return jsonify({'error': 'No files provided', 'code': 'NO_FILE'}), 400

            if len(valid_files) > 8:
                return jsonify({'error': 'Maximum 8 files per upload', 'code': 'TOO_MANY_FILES'}), 400

            uploaded_urls = []
            for file in valid_files:
                mime = str(file.mimetype or '').lower()
                if not (mime.startswith('image/') or mime == 'application/pdf'):
                    return jsonify({'error': 'KYC supports images or PDF only', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400

                safe_name = secure_filename(file.filename) or 'kyc-file'
                extension = os.path.splitext(safe_name)[1] or ('.pdf' if mime == 'application/pdf' else '.jpg')
                generated_name = f"account_kyc_{uuid.uuid4().hex[:18]}{extension}"
                save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], generated_name)
                file.save(save_path)
                uploaded_urls.append(f'/uploads/{generated_name}')

            return jsonify({
                'success': True,
                'message': 'تم رفع مستندات التحقق بنجاح',
                'data': {'file_urls': uploaded_urls}
            }), 201
        except Exception as e:
            print(f"Upload account kyc assets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/kyc', methods=['POST'])
    @ctx.jwt_required()
    def submit_account_kyc():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            full_name = sanitize_plain_text(data.get('full_name'), 160)
            document_type = str(data.get('document_type') or '').strip().lower()
            document_urls = data.get('document_urls') or []

            if not full_name:
                return jsonify({'error': 'الاسم الكامل مطلوب للتوثيق', 'code': 'MISSING_KYC_NAME'}), 400
            if document_type not in {'national_id', 'passport', 'residence', 'ownership'}:
                return jsonify({'error': 'نوع مستند التوثيق غير صالح', 'code': 'INVALID_KYC_DOCUMENT_TYPE'}), 400
            if not isinstance(document_urls, list) or not [str(url).strip() for url in document_urls if str(url).strip()]:
                return jsonify({'error': 'يجب رفع مستند واحد على الأقل للتوثيق', 'code': 'MISSING_KYC_DOCUMENTS'}), 400

            normalized_urls = []
            for item in document_urls:
                url = str(item or '').strip()
                if url and url not in normalized_urls:
                    normalized_urls.append(url)

            conn = ctx.get_db_connection()
            user = conn.execute('SELECT id, kyc_status FROM users WHERE id = ?', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            conn.execute('''
                UPDATE users
                SET kyc_status = 'pending',
                    kyc_document_urls_json = ?,
                    kyc_document_type = ?,
                    kyc_full_name = ?,
                    kyc_submitted_at = CURRENT_TIMESTAMP,
                    kyc_reviewed_at = NULL,
                    kyc_verified_at = NULL,
                    kyc_rejection_note = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (json.dumps(normalized_urls, ensure_ascii=False), document_type, full_name, user_id))
            conn.commit()

            updated_user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()
            company_profile = load_company_profile(conn, user_id) if normalize_account_type(updated_user['account_type']) == 'company' else None
            conn.close()

            ctx.log_audit_event(
                action='auth.kyc_submitted',
                user_id=user_id,
                entity_type='user',
                entity_id=user_id,
                new_value={'document_type': document_type, 'documents_count': len(normalized_urls)}
            )

            return jsonify({
                'success': True,
                'message': 'تم إرسال طلب توثيق الحساب للمراجعة',
                'data': {'profile': build_user_payload(updated_user, company_profile)}
            }), 200
        except Exception as e:
            print(f"Submit account kyc error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/company/assets/upload', methods=['POST'])
    @ctx.jwt_required()
    def upload_company_assets():
        try:
            files = request.files.getlist('files')
            if not files:
                single_file = request.files.get('file')
                files = [single_file] if single_file else []

            valid_files = [file for file in files if file and file.filename]
            if not valid_files:
                return jsonify({'error': 'No files provided', 'code': 'NO_FILE'}), 400

            if len(valid_files) > 10:
                return jsonify({'error': 'Maximum 10 files per upload', 'code': 'TOO_MANY_FILES'}), 400

            uploaded_urls = []
            for file in valid_files:
                mime = str(file.mimetype or '').lower()
                if not (mime.startswith('image/') or mime == 'application/pdf'):
                    return jsonify({'error': 'Company verification supports images or PDF only', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400

                safe_name = secure_filename(file.filename) or 'company-file'
                extension = os.path.splitext(safe_name)[1] or ('.pdf' if mime == 'application/pdf' else '.jpg')
                generated_name = f"company_file_{uuid.uuid4().hex[:18]}{extension}"
                save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], generated_name)
                file.save(save_path)
                uploaded_urls.append(f'/uploads/{generated_name}')

            return jsonify({
                'success': True,
                'message': 'تم رفع ملفات الشركة بنجاح',
                'data': {'file_urls': uploaded_urls}
            }), 201
        except Exception as e:
            print(f"Upload company assets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/company/verification-submit', methods=['POST'])
    @ctx.jwt_required()
    def submit_company_verification():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            document_urls = normalize_uploaded_url_list(data.get('document_urls') or [])
            logo_url = sanitize_plain_text(data.get('logo_url'), 255)

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()

            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if normalize_account_type(user['account_type']) != 'company':
                conn.close()
                return jsonify({'error': 'This action is available for company accounts only', 'code': 'COMPANY_ACCOUNT_REQUIRED'}), 403

            company_profile = load_company_profile(conn, user_id)
            if not company_profile:
                conn.close()
                return jsonify({'error': 'Company profile is incomplete', 'code': 'COMPANY_PROFILE_REQUIRED'}), 400

            if not str(company_profile.get('company_name') or '').strip():
                conn.close()
                return jsonify({'error': 'Company name is required before submission', 'code': 'MISSING_COMPANY_NAME'}), 400

            if not str(company_profile.get('representative_name') or '').strip():
                conn.close()
                return jsonify({'error': 'Representative name is required before submission', 'code': 'MISSING_COMPANY_REPRESENTATIVE'}), 400

            merged_document_urls = []
            existing_document_urls = company_profile.get('document_urls') or []
            for url in existing_document_urls + document_urls:
                normalized_url = str(url or '').strip()
                if normalized_url and normalized_url not in merged_document_urls:
                    merged_document_urls.append(normalized_url)

            if not merged_document_urls:
                conn.close()
                return jsonify({'error': 'Company verification requires at least one document', 'code': 'MISSING_COMPANY_DOCUMENTS'}), 400

            final_logo_url = logo_url or str(company_profile.get('logo_url') or '').strip()
            conn.execute('''
                UPDATE company_profiles
                SET logo_url = ?,
                    document_urls_json = ?,
                    verification_status = 'pending',
                    verification_note = NULL,
                    submitted_at = CURRENT_TIMESTAMP,
                    reviewed_at = NULL,
                    verified_at = NULL,
                    approved_by_user_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (
                final_logo_url,
                json.dumps(merged_document_urls, ensure_ascii=False),
                user_id
            ))
            conn.commit()

            refreshed_user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()
            refreshed_company = load_company_profile(conn, user_id)
            conn.close()

            ctx.log_audit_event(
                action='auth.company_verification_submitted',
                user_id=user_id,
                entity_type='company_profile',
                entity_id=user_id,
                new_value={'documents_count': len(merged_document_urls), 'logo_url': final_logo_url}
            )

            return jsonify({
                'success': True,
                'message': 'تم إرسال ملف الشركة للمراجعة',
                'data': {
                    'profile': build_user_payload(refreshed_user, refreshed_company)
                }
            }), 200
        except Exception as e:
            print(f"Submit company verification error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/change-password', methods=['POST'])
    @ctx.jwt_required()
    def change_password():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            current_password = data.get('current_password')
            new_password = data.get('new_password')

            if not current_password or not new_password:
                return jsonify({'error': 'Missing required fields', 'code': 'MISSING_FIELD'}), 400

            try:
                ctx.validate_password_strength(new_password)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'WEAK_PASSWORD'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute(
                'SELECT password FROM users WHERE id = ?',
                (user_id,)
            ).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not ctx.bcrypt.check_password_hash(user['password'], current_password):
                conn.close()
                return jsonify({'error': 'كلمة المرور الحالية غير صحيحة', 'code': 'INVALID_CURRENT_PASSWORD'}), 400

            password_hash = ctx.bcrypt.generate_password_hash(new_password).decode('utf-8')
            conn.execute(
                'UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (password_hash, user_id)
            )
            conn.commit()
            conn.close()
            ctx.log_audit_event(
                action='auth.change_password',
                user_id=user_id,
                entity_type='user',
                entity_id=user_id
            )

            return jsonify({
                'success': True,
                'message': 'تم تغيير كلمة المرور بنجاح'
            }), 200

        except Exception as e:
            print(f"Change password error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/auth/google/link', methods=['POST'])
    @ctx.jwt_required()
    def link_google_account():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            google_token = str(data.get('id_token') or '').strip()
            if not google_token:
                return jsonify({'error': 'Google credential is required', 'code': 'MISSING_GOOGLE_CREDENTIAL'}), 400

            try:
                google_profile = ctx.verify_google_id_token(google_token)
            except Exception as exc:
                return jsonify({'error': str(exc), 'code': 'GOOGLE_TOKEN_INVALID'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()

            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not user['is_active']:
                conn.close()
                return jsonify({'error': 'Account is deactivated', 'code': 'ACCOUNT_INACTIVE'}), 403

            if str(user['email'] or '').strip().lower() != google_profile['email']:
                conn.close()
                return jsonify({
                    'error': 'يجب أن يطابق بريد Google البريد المسجل في حسابك الحالي',
                    'code': 'GOOGLE_EMAIL_MISMATCH'
                }), 400

            linked_elsewhere = conn.execute('''
                SELECT id
                FROM users
                WHERE google_sub = ?
                  AND id != ?
                LIMIT 1
            ''', (google_profile['sub'], user_id)).fetchone()
            if linked_elsewhere:
                conn.close()
                return jsonify({
                    'error': 'هذا الحساب من Google مرتبط بمستخدم آخر بالفعل',
                    'code': 'GOOGLE_ALREADY_LINKED'
                }), 409

            conn.execute('''
                UPDATE users
                SET google_sub = ?,
                    auth_provider = ?,
                    avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                    email_verified = 1,
                    email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                google_profile['sub'],
                merge_auth_provider(user['auth_provider'], 'google'),
                google_profile['picture'],
                user_id
            ))
            conn.commit()

            updated_user = conn.execute('''
                SELECT id, public_user_id, referral_code, name, email, phone, role, account_type, created_at, is_active, email_verified,
                       auth_provider, google_sub, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at,
                       kyc_reviewed_at, kyc_rejection_note
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()
            company_profile = load_company_profile(conn, user_id) if normalize_account_type(updated_user['account_type']) == 'company' else None
            conn.close()

            ctx.log_audit_event(
                action='auth.google_linked',
                user_id=user_id,
                entity_type='user',
                entity_id=user_id,
                new_value={'email': updated_user['email'], 'auth_provider': updated_user['auth_provider']}
            )

            return jsonify({
                'success': True,
                'message': 'تم ربط حساب Google بحسابك بنجاح',
                'data': {
                    'profile': build_user_payload(updated_user, company_profile)
                }
            }), 200

        except Exception as e:
            print(f"Google link error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
