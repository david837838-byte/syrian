import json
import os

from flask import current_app, jsonify, request


def register_admin_routes(app, ctx):
    def parse_json_list(raw_value):
        if not raw_value:
            return []
        try:
            parsed = json.loads(raw_value)
            return parsed if isinstance(parsed, list) else []
        except (TypeError, json.JSONDecodeError):
            return []

    def coerce_setting_value(raw_value, data_type, default=None):
        normalized_type = str(data_type or '').lower()
        if normalized_type == 'boolean':
            return str(raw_value).lower() == 'true'
        if normalized_type == 'number':
            try:
                return float(raw_value) if '.' in str(raw_value) else int(raw_value)
            except (TypeError, ValueError):
                return default
        if normalized_type == 'json':
            try:
                return json.loads(raw_value)
            except (TypeError, json.JSONDecodeError):
                return default
        return raw_value

    def get_settings_map(conn):
        rows = conn.execute('''
            SELECT key, value, data_type
            FROM system_settings
        ''').fetchall()
        return {
            row['key']: coerce_setting_value(row['value'], row['data_type'], row['value'])
            for row in rows
        }

    def build_launch_readiness_report(conn):
        settings = get_settings_map(conn)
        launch_networks = settings.get('launch_networks') or []
        if not isinstance(launch_networks, list):
            launch_networks = []

        active_receiving_wallets = conn.execute(
            'SELECT COUNT(*) AS count FROM admin_wallets WHERE is_active = 1'
        ).fetchone()['count']
        active_pool_wallets = conn.execute(
            'SELECT COUNT(*) AS count FROM real_crypto_wallet_pool WHERE is_active = 1'
        ).fetchone()['count']
        active_financial_channels = conn.execute(
            'SELECT COUNT(*) AS count FROM financial_channels WHERE is_active = 1'
        ).fetchone()['count']

        def check(status, key, label, message, category='general'):
            return {
                'key': key,
                'label': label,
                'status': status,
                'message': message,
                'category': category
            }

        checks = []

        secret_key = str(current_app.config.get('SECRET_KEY') or '')
        jwt_secret = str(current_app.config.get('JWT_SECRET_KEY') or '')
        secrets_ok = (
            secret_key
            and jwt_secret
            and 'change-in-production' not in secret_key
            and 'change-in-production' not in jwt_secret
            and secret_key != 'dev-secret-key-change-in-production'
            and jwt_secret != 'jwt-secret-key-change-in-production'
        )
        checks.append(check(
            'pass' if secrets_ok else 'fail',
            'secrets',
            'المفاتيح السرية',
            'المفاتيح السرية مضبوطة بشكل مناسب.' if secrets_ok else 'لا تزال مفاتيح SECRET_KEY أو JWT_SECRET_KEY على القيم الافتراضية.',
            'security'
        ))

        allowed_origins = [item.strip() for item in str(os.environ.get('ALLOWED_ORIGINS', '') or '').split(',') if item.strip()]
        production_like = str(os.environ.get('FLASK_ENV', 'development')).lower() == 'production'
        localhost_only = all('localhost' in item or '127.0.0.1' in item for item in allowed_origins) if allowed_origins else True
        origins_ready = (not production_like) or (allowed_origins and not localhost_only)
        checks.append(check(
            'pass' if origins_ready else 'warn',
            'origins',
            'النطاقات المسموح بها',
            'تم ضبط ALLOWED_ORIGINS لنطاقات الإطلاق.' if origins_ready else 'ما زالت ALLOWED_ORIGINS محصورة محليًا أو غير مضبوطة للإنتاج.',
            'security'
        ))

        mail_ready = all([
            settings.get('mail_server'),
            settings.get('mail_port'),
            settings.get('mail_username'),
            settings.get('mail_password'),
            settings.get('mail_default_sender')
        ])
        checks.append(check(
            'pass' if mail_ready else 'fail',
            'mail',
            'إرسال البريد',
            'إعدادات البريد مكتملة لإرسال الأكواد والإشعارات.' if mail_ready else 'إعدادات SMTP أو البريد المرسل ما زالت ناقصة.',
            'communication'
        ))

        legal_ready = all(len(str(settings.get(key) or '').strip()) >= 20 for key in (
            'terms_of_use_text', 'privacy_policy_text', 'risk_disclosure_text'
        ))
        checks.append(check(
            'pass' if legal_ready else 'warn',
            'legal',
            'النصوص القانونية',
            'الشروط والخصوصية وإفصاح المخاطر جاهزة.' if legal_ready else 'بعض النصوص القانونية قصيرة جدًا أو غير مكتملة.',
            'operations'
        ))

        backups_ready = int(settings.get('backup_retention_count') or 0) >= 3
        checks.append(check(
            'pass' if backups_ready else 'warn',
            'backups',
            'سياسة النسخ الاحتياطي',
            f"الاحتفاظ التلقائي مضبوط على {int(settings.get('backup_retention_count') or 0)} نسخة." if backups_ready else 'عدد النسخ الاحتياطية المحتفظ بها منخفض، والأفضل 3 فأكثر.',
            'operations'
        ))

        checks.append(check(
            'pass' if active_receiving_wallets > 0 else 'fail',
            'receiving_wallets',
            'محافظ الاستقبال',
            f'يوجد {active_receiving_wallets} محافظ استقبال مفعلة.' if active_receiving_wallets > 0 else 'لا توجد أي محفظة استقبال مفعلة حالياً.',
            'money'
        ))

        checks.append(check(
            'pass' if launch_networks else 'fail',
            'launch_networks',
            'شبكات الإطلاق',
            f"الشبكات المحددة: {', '.join(launch_networks)}." if launch_networks else 'لم يتم تحديد أي شبكة للإطلاق الحقيقي.',
            'money'
        ))

        real_money_enabled = bool(settings.get('real_money_enabled', False))
        deposit_mode = str(settings.get('deposit_verification_mode') or 'simulated').lower()
        deposit_provider = str(settings.get('deposit_verification_provider') or 'tatum').strip().lower()
        deposit_provider_api_key = str(settings.get('real_wallet_provider_api_key') or '').strip()
        deposit_ready = (
            (not real_money_enabled)
            or (
                deposit_mode == 'onchain'
                and (
                    deposit_provider != 'tatum'
                    or bool(deposit_provider_api_key)
                )
            )
        )
        checks.append(check(
            'pass' if deposit_ready else 'fail',
            'deposit_mode',
            'تحقق الإيداع',
            'تم تفعيل تحقق on-chain للإيداع.' if deposit_ready else 'الوضع الحقيقي مفعّل لكن تحقق الإيداع ما زال على وضع المحاكاة.',
            'money'
        ))

        generation_mode = str(settings.get('real_wallet_generation_mode') or 'manual_pool').lower()
        provider_api_key = str(settings.get('real_wallet_provider_api_key') or '').strip()
        provider_ready = True
        provider_message = 'إنشاء المحافظ الحقيقية جاهز وفق الوضع الحالي.'
        if generation_mode in {'tatum_xpub', 'hybrid'}:
            provider_ready = bool(provider_api_key)
            provider_message = 'تم إدخال مفتاح API الخاص بإنشاء المحافظ.' if provider_ready else 'وضع إنشاء المحافظ يتطلب مفتاح API للمزود لكنه غير موجود.'
        checks.append(check(
            'pass' if provider_ready else 'fail',
            'wallet_provider',
            'مزود المحافظ الحقيقية',
            provider_message,
            'money'
        ))

        xpub_requirements = {
            'TRC20': str(settings.get('real_wallet_xpub_tron') or '').strip(),
            'ERC20': str(settings.get('real_wallet_xpub_ethereum') or '').strip(),
            'BEP20': str(settings.get('real_wallet_xpub_bsc') or '').strip(),
            'BTC': str(settings.get('real_wallet_xpub_bitcoin') or '').strip(),
        }
        missing_xpub_networks = [
            network for network in launch_networks
            if generation_mode in {'tatum_xpub', 'hybrid'} and not xpub_requirements.get(str(network).upper(), '')
        ]
        checks.append(check(
            'pass' if not missing_xpub_networks else 'fail',
            'xpub_networks',
            'XPUB للشبكات',
            'تم توفير XPUB للشبكات المطلوبة.' if not missing_xpub_networks else f"ينقص XPUB للشبكات التالية: {', '.join(missing_xpub_networks)}.",
            'money'
        ))

        pool_ready = active_pool_wallets > 0 or generation_mode != 'manual_pool'
        checks.append(check(
            'pass' if pool_ready else 'warn',
            'wallet_pool',
            'مخزون المحافظ الحقيقية',
            f'يوجد {active_pool_wallets} محافظ حقيقية متاحة بالمخزون.' if active_pool_wallets > 0 else 'وضع المخزون اليدوي مفعّل لكن لا توجد محافظ جاهزة داخله.',
            'money'
        ))

        checks.append(check(
            'pass' if active_financial_channels > 0 else 'warn',
            'financial_channels',
            'القنوات المالية الإضافية',
            f'يوجد {active_financial_channels} قنوات مالية مفعلة.' if active_financial_channels > 0 else 'لا توجد بعد قنوات بنكية أو PayPal أو Wish Money مفعلة.',
            'money'
        ))

        turn_enabled = bool(settings.get('rtc_turn_enabled', False))
        turn_ready = (not turn_enabled) or all([
            settings.get('rtc_turn_url'),
            settings.get('rtc_turn_username'),
            settings.get('rtc_turn_password')
        ])
        checks.append(check(
            'pass' if turn_ready else 'warn',
            'turn',
            'خدمة TURN للاتصال',
            'إعدادات TURN كاملة.' if turn_ready else 'تم تفعيل TURN لكن بياناته غير مكتملة.',
            'communication'
        ))

        google_ready = bool(str(current_app.config.get('GOOGLE_CLIENT_ID') or '').strip())
        checks.append(check(
            'pass' if google_ready else 'warn',
            'google',
            'تسجيل الدخول عبر Google',
            'ربط Google جاهز.' if google_ready else 'GOOGLE_CLIENT_ID غير مضبوط بعد.',
            'communication'
        ))

        status_weights = {'pass': 1.0, 'warn': 0.5, 'fail': 0.0}
        readiness_percent = round(
            (sum(status_weights.get(item['status'], 0.0) for item in checks) / max(len(checks), 1)) * 100
        )
        blockers = [item for item in checks if item['status'] == 'fail']
        warnings = [item for item in checks if item['status'] == 'warn']

        return {
            'environment': {
                'flask_env': os.environ.get('FLASK_ENV', 'development'),
                'real_money_enabled': real_money_enabled,
                'generation_mode': generation_mode,
                'deposit_verification_mode': deposit_mode,
                'withdraw_execution_mode': str(settings.get('withdraw_execution_mode') or 'admin_approval'),
            },
            'counts': {
                'active_receiving_wallets': active_receiving_wallets,
                'active_pool_wallets': active_pool_wallets,
                'active_financial_channels': active_financial_channels,
                'launch_networks': len(launch_networks),
            },
            'summary': {
                'readiness_percent': readiness_percent,
                'total_checks': len(checks),
                'blocking_checks': len(blockers),
                'warning_checks': len(warnings),
                'status': 'ready' if not blockers and readiness_percent >= 85 else 'attention'
            },
            'checks': checks,
            'blockers': blockers,
            'warnings': warnings
        }

    def build_kyc_screening(user):
        document_urls = parse_json_list(user['kyc_document_urls_json'])
        expected_country_name = user['preferred_country_name'] or user['detected_country_name'] or 'غير محدد'
        expected_country_code = user['preferred_country_code'] or user['detected_country_code'] or ''
        checks = []
        score = 100

        checks.append({
            'key': 'documents_present',
            'label': 'وجود وثائق مرفوعة',
            'status': 'pass' if document_urls else 'fail',
            'message': f'تم العثور على {len(document_urls)} ملف' if document_urls else 'لا توجد أي وثيقة مرفوعة'
        })
        if not document_urls:
            score -= 55

        duplicate_count = len(document_urls) - len(set(document_urls))
        checks.append({
            'key': 'duplicate_files',
            'label': 'عدم تكرار الملفات',
            'status': 'pass' if duplicate_count == 0 else 'warn',
            'message': 'كل الملفات مختلفة' if duplicate_count == 0 else f'يوجد {duplicate_count} ملف مكرر'
        })
        if duplicate_count:
            score -= min(20, duplicate_count * 10)

        allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.pdf'}
        invalid_files = [
            url for url in document_urls
            if not any(str(url).lower().endswith(ext) for ext in allowed_extensions)
        ]
        checks.append({
            'key': 'allowed_extensions',
            'label': 'امتدادات مقبولة',
            'status': 'pass' if not invalid_files else 'warn',
            'message': 'كل الملفات بصيغ مألوفة' if not invalid_files else f'هناك {len(invalid_files)} ملف بامتداد غير معتاد'
        })
        if invalid_files:
            score -= min(25, len(invalid_files) * 8)

        full_name_ok = len(str(user['kyc_full_name'] or '').strip()) >= 5
        checks.append({
            'key': 'full_name_present',
            'label': 'الاسم الكامل واضح',
            'status': 'pass' if full_name_ok else 'warn',
            'message': str(user['kyc_full_name'] or '').strip() or 'لم يتم إدخال اسم واضح'
        })
        if not full_name_ok:
            score -= 10

        checks.append({
            'key': 'expected_country',
            'label': 'الدولة المرجعية للمراجعة',
            'status': 'pass' if expected_country_code else 'warn',
            'message': expected_country_name
        })
        if not expected_country_code:
            score -= 10

        score = max(0, min(100, score))
        risk_level = 'low' if score >= 80 else 'medium' if score >= 55 else 'high'
        summary = (
            'الفحص الذكي الأولي يرى أن الوثائق منظمة وقابلة للمراجعة.'
            if risk_level == 'low'
            else 'الفحص الذكي الأولي يحتاج مراجعة بشرية أدق لبعض النقاط.'
            if risk_level == 'medium'
            else 'الفحص الذكي الأولي رصد مؤشرات تستدعي تدقيقًا يدويًا مباشرًا.'
        )

        return {
            'score': score,
            'risk_level': risk_level,
            'expected_country_code': expected_country_code,
            'expected_country_name': expected_country_name,
            'checks': checks,
            'summary': summary,
            'note': 'هذا فحص ذكي أولي داخل المنصة وليس بديلاً عن المراجعة البشرية أو خدمة تحقق خارجية.'
        }

    @app.route('/api/admin/dashboard', methods=['GET'])
    @ctx.admin_required
    def admin_dashboard():
        try:
            conn = ctx.get_db_connection()
            ctx.accrue_investment_profits(conn)
            conn.commit()

            stats = conn.execute('''
                SELECT
                    (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
                    (SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = 1) as active_users,
                    (SELECT COALESCE(SUM(total_amount), 0) FROM investments) as total_investments,
                    (SELECT COALESCE(SUM(collected), 0) FROM investments) as total_collected,
                    (SELECT COALESCE(SUM(returns), 0) FROM user_investments) as total_profits,
                    (SELECT COUNT(*) FROM investments WHERE status = 'active') as active_projects,
                    (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals,
                    (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'pending') as pending_withdrawals_amount,
                    (SELECT COUNT(*) FROM transactions WHERE status = 'pending' AND type = 'deposit') as pending_deposits,
                    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'pending' AND type = 'deposit') as pending_deposits_amount,
                    (SELECT COUNT(*) FROM users WHERE role = 'user' AND kyc_status = 'pending') as pending_kyc_reviews,
                    (SELECT COUNT(*) FROM user_device_activity WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) as locked_devices,
                    (SELECT COUNT(*) FROM user_device_activity) as monitored_devices,
                    (SELECT COUNT(*) FROM security_logs WHERE created_at >= datetime('now', '-1 day')) as security_events_last_24h
            ''').fetchone()

            recent_users = conn.execute('''
                SELECT id, name, email, phone, created_at, is_active
                FROM users WHERE role = 'user'
                ORDER BY created_at DESC LIMIT 10
            ''').fetchall()

            recent_investments = conn.execute('''
                SELECT i.*, u.name as admin_name
                FROM investments i
                LEFT JOIN users u ON i.added_by = u.id
                ORDER BY i.created_at DESC LIMIT 10
            ''').fetchall()

            recent_security_events = conn.execute('''
                SELECT s.id, s.event_type, s.severity, s.details, s.ip_address, s.created_at,
                       u.name as user_name, u.email as user_email
                FROM security_logs s
                LEFT JOIN users u ON s.user_id = u.id
                ORDER BY s.created_at DESC
                LIMIT 8
            ''').fetchall()

            recent_device_activity = conn.execute('''
                SELECT d.device_id, d.device_name, d.ip_address, d.last_seen_at, d.lock_reason, d.locked_until,
                       u.id as user_id, u.name as user_name, u.email as user_email, u.public_user_id
                FROM user_device_activity d
                JOIN users u ON d.user_id = u.id
                ORDER BY d.last_seen_at DESC
                LIMIT 8
            ''').fetchall()

            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'stats': dict(stats),
                    'recent_users': [dict(u) for u in recent_users],
                    'recent_investments': [dict(i) for i in recent_investments],
                    'recent_security_events': [dict(event) for event in recent_security_events],
                    'recent_device_activity': [dict(device) for device in recent_device_activity]
                }
            }), 200

        except Exception as e:
            print(f"Admin dashboard error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/profits/accrue', methods=['POST'])
    @ctx.admin_required
    def admin_accrue_profits():
        try:
            conn = ctx.get_db_connection()
            result = ctx.accrue_investment_profits(conn)
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تنفيذ احتساب الأرباح التلقائي',
                'data': result
            }), 200

        except Exception as e:
            print(f"Admin accrue profits error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users', methods=['GET'])
    @ctx.admin_required
    def admin_get_users():
        try:
            page = request.args.get('page', 1, type=int)
            limit = request.args.get('limit', 20, type=int)
            offset = (page - 1) * limit
            conn = ctx.get_db_connection()

            users = conn.execute('''
                SELECT
                    u.*,
                    (SELECT COUNT(*) FROM user_investments WHERE user_id = u.id) as total_investments,
                    (SELECT COALESCE(SUM(amount), 0) FROM user_investments WHERE user_id = u.id) as total_invested,
                    (SELECT company_name FROM company_profiles WHERE user_id = u.id LIMIT 1) as company_name,
                    (SELECT verification_status FROM company_profiles WHERE user_id = u.id LIMIT 1) as company_verification_status,
                    (SELECT COUNT(*) FROM investments WHERE added_by = u.id) as company_projects_count,
                    (SELECT COUNT(*) FROM user_device_activity WHERE user_id = u.id) as device_count,
                    (SELECT ip_address FROM user_device_activity WHERE user_id = u.id ORDER BY last_seen_at DESC LIMIT 1) as last_ip_address,
                    (SELECT device_name FROM user_device_activity WHERE user_id = u.id ORDER BY last_seen_at DESC LIMIT 1) as last_device_name,
                    (SELECT last_seen_at FROM user_device_activity WHERE user_id = u.id ORDER BY last_seen_at DESC LIMIT 1) as last_device_seen_at,
                    (SELECT MAX(locked_until) FROM user_device_activity WHERE user_id = u.id) as device_locked_until
                FROM users u
                WHERE role = 'user'
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (limit, offset)).fetchall()

            total = conn.execute('SELECT COUNT(*) as count FROM users WHERE role = "user"').fetchone()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'users': [dict(u) for u in users],
                    'pagination': {
                        'page': page,
                        'limit': limit,
                        'total': total['count'],
                        'pages': (total['count'] + limit - 1) // limit
                    }
                }
            }), 200

        except Exception as e:
            print(f"Admin users error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>/kyc-details', methods=['GET'])
    @ctx.admin_required
    def admin_user_kyc_details(user_id):
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, public_user_id, name, email, phone, created_at, kyc_status, kyc_document_urls_json,
                       kyc_document_type, kyc_full_name, kyc_submitted_at, kyc_verified_at, kyc_reviewed_at,
                       kyc_rejection_note, preferred_country_code, preferred_country_name,
                       detected_country_code, detected_country_name
                FROM users
                WHERE id = ? AND role = 'user'
            ''', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            recent_devices = conn.execute('''
                SELECT device_id, device_name, ip_address, user_agent, last_seen_at, last_login_at,
                       failed_login_attempts, failed_reset_attempts, lock_reason, locked_until
                FROM user_device_activity
                WHERE user_id = ?
                ORDER BY last_seen_at DESC
                LIMIT 5
            ''', (user_id,)).fetchall()
            conn.close()

            user_payload = dict(user)
            user_payload['kyc_document_urls'] = parse_json_list(user['kyc_document_urls_json'])
            ctx.log_audit_event(
                action='admin.kyc_view',
                user_id=admin_user_id,
                entity_type='user',
                entity_id=user_id
            )

            return jsonify({
                'success': True,
                'data': {
                    'user': user_payload,
                    'smart_screening': build_kyc_screening(user),
                    'recent_devices': [dict(device) for device in recent_devices]
                }
            }), 200

        except Exception as e:
            print(f"Admin user kyc details error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>/devices', methods=['GET'])
    @ctx.admin_required
    def admin_user_devices(user_id):
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, public_user_id, name, email
                FROM users
                WHERE id = ? AND role = 'user'
            ''', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            devices = conn.execute('''
                SELECT device_id, device_name, ip_address, user_agent, first_seen_at, last_seen_at,
                       last_login_at, last_password_reset_request_at, last_password_reset_at,
                       failed_login_attempts, failed_reset_attempts, lock_reason, locked_until
                FROM user_device_activity
                WHERE user_id = ?
                ORDER BY last_seen_at DESC
            ''', (user_id,)).fetchall()
            conn.close()
            ctx.log_audit_event(
                action='admin.devices_view',
                user_id=admin_user_id,
                entity_type='user',
                entity_id=user_id
            )

            return jsonify({
                'success': True,
                'data': {
                    'user': dict(user),
                    'devices': [dict(device) for device in devices]
                }
            }), 200

        except Exception as e:
            print(f"Admin user devices error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>/company-details', methods=['GET'])
    @ctx.admin_required
    def admin_user_company_details(user_id):
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, public_user_id, name, email, phone, account_type, kyc_status
                FROM users
                WHERE id = ? AND role = 'user'
            ''', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if str(user['account_type'] or '').strip().lower() != 'company':
                conn.close()
                return jsonify({'error': 'User is not a company account', 'code': 'COMPANY_ACCOUNT_REQUIRED'}), 400

            company = conn.execute('''
                SELECT *
                FROM company_profiles
                WHERE user_id = ?
                LIMIT 1
            ''', (user_id,)).fetchone()
            if not company:
                conn.close()
                return jsonify({'error': 'Company profile not found', 'code': 'COMPANY_PROFILE_NOT_FOUND'}), 404

            projects = conn.execute('''
                SELECT id, name, total_amount, status, created_at
                FROM investments
                WHERE added_by = ?
                ORDER BY created_at DESC
                LIMIT 8
            ''', (user_id,)).fetchall()
            conn.close()

            company_payload = dict(company)
            company_payload['document_urls'] = parse_json_list(company_payload.get('document_urls_json'))

            ctx.log_audit_event(
                action='admin.company_view',
                user_id=admin_user_id,
                entity_type='company_profile',
                entity_id=user_id
            )

            return jsonify({
                'success': True,
                'data': {
                    'user': dict(user),
                    'company': company_payload,
                    'projects': [dict(project) for project in projects]
                }
            }), 200
        except Exception as e:
            print(f"Admin company details error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/security/overview', methods=['GET'])
    @ctx.admin_required
    def admin_security_overview():
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            summary = conn.execute('''
                SELECT
                    (SELECT COUNT(*) FROM user_device_activity) as monitored_devices,
                    (SELECT COUNT(*) FROM user_device_activity WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) as locked_devices,
                    (SELECT COUNT(*) FROM security_logs WHERE created_at >= datetime('now', '-1 day')) as events_last_24h,
                    (SELECT COUNT(*) FROM users WHERE role = 'user' AND kyc_status = 'pending') as pending_kyc_reviews
            ''').fetchone()

            devices = conn.execute('''
                SELECT d.device_id, d.device_name, d.ip_address, d.last_seen_at, d.last_login_at,
                       d.failed_login_attempts, d.failed_reset_attempts, d.lock_reason, d.locked_until,
                       u.id as user_id, u.name as user_name, u.email as user_email, u.public_user_id
                FROM user_device_activity d
                JOIN users u ON d.user_id = u.id
                ORDER BY
                    CASE WHEN d.locked_until IS NOT NULL AND d.locked_until > CURRENT_TIMESTAMP THEN 0 ELSE 1 END,
                    d.last_seen_at DESC
                LIMIT 30
            ''').fetchall()

            logs = conn.execute('''
                SELECT s.id, s.event_type, s.severity, s.details, s.ip_address, s.created_at,
                       u.id as user_id, u.name as user_name, u.email as user_email, u.public_user_id
                FROM security_logs s
                LEFT JOIN users u ON s.user_id = u.id
                ORDER BY s.created_at DESC
                LIMIT 30
            ''').fetchall()

            audit_logs = conn.execute('''
                SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_value, a.new_value,
                       a.ip_address, a.user_agent, a.status, a.created_at,
                       u.name as user_name, u.email as user_email
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.created_at DESC
                LIMIT 30
            ''').fetchall()
            conn.close()

            parsed_logs = []
            for row in logs:
                entry = dict(row)
                try:
                    entry['details'] = json.loads(entry['details']) if entry.get('details') else {}
                except (TypeError, json.JSONDecodeError):
                    entry['details'] = {'raw': entry.get('details')}
                parsed_logs.append(entry)

            parsed_audit_logs = []
            for row in audit_logs:
                entry = dict(row)
                for payload_key in ('old_value', 'new_value'):
                    try:
                        entry[payload_key] = json.loads(entry[payload_key]) if entry.get(payload_key) else {}
                    except (TypeError, json.JSONDecodeError):
                        entry[payload_key] = {'raw': entry.get(payload_key)}
                parsed_audit_logs.append(entry)

            ctx.log_audit_event(
                action='admin.security_overview_view',
                user_id=admin_user_id,
                entity_type='security',
                entity_id=None
            )

            return jsonify({
                'success': True,
                'data': {
                    'summary': dict(summary),
                    'devices': [dict(device) for device in devices],
                    'logs': parsed_logs,
                    'audit_logs': parsed_audit_logs
                }
            }), 200

        except Exception as e:
            print(f"Admin security overview error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/readiness', methods=['GET'])
    @ctx.admin_required
    def admin_launch_readiness():
        try:
            conn = ctx.get_db_connection()
            report = build_launch_readiness_report(conn)
            conn.close()

            return jsonify({
                'success': True,
                'data': report
            }), 200
        except Exception as e:
            print(f"Admin readiness error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>/kyc-review', methods=['POST'])
    @ctx.admin_required
    def review_user_kyc(user_id):
        try:
            data = request.get_json() or {}
            action = str(data.get('action') or '').strip().lower()
            note = str(data.get('note') or '').strip()
            admin_user_id = int(ctx.get_jwt_identity())

            if action not in {'approve', 'reject'}:
                return jsonify({'error': 'Invalid review action', 'code': 'INVALID_KYC_ACTION'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, name, email, kyc_status, kyc_document_urls_json
                FROM users
                WHERE id = ? AND role = 'user'
            ''', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if action == 'approve':
                conn.execute('''
                    UPDATE users
                    SET kyc_status = 'verified',
                        kyc_verified_at = CURRENT_TIMESTAMP,
                        kyc_reviewed_at = CURRENT_TIMESTAMP,
                        kyc_rejection_note = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (user_id,))
                message = 'تم اعتماد توثيق الحساب بنجاح'
            else:
                conn.execute('''
                    UPDATE users
                    SET kyc_status = 'rejected',
                        kyc_reviewed_at = CURRENT_TIMESTAMP,
                        kyc_rejection_note = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (note or 'تم رفض طلب التوثيق ويحتاج إلى إعادة التقديم', user_id))
                message = 'تم رفض طلب التوثيق'

            conn.commit()
            conn.close()
            ctx.log_audit_event(
                action=f'admin.kyc_{action}',
                user_id=admin_user_id,
                entity_type='user',
                entity_id=user_id,
                new_value={'note': note}
            )
            return jsonify({'success': True, 'message': message}), 200
        except Exception as e:
            print(f"Review user kyc error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>/company-review', methods=['POST'])
    @ctx.admin_required
    def review_company_profile(user_id):
        try:
            data = request.get_json() or {}
            action = str(data.get('action') or '').strip().lower()
            note = str(data.get('note') or '').strip()
            admin_user_id = int(ctx.get_jwt_identity())

            if action not in {'approve', 'reject'}:
                return jsonify({'error': 'Invalid company review action', 'code': 'INVALID_COMPANY_ACTION'}), 400

            conn = ctx.get_db_connection()
            user = conn.execute('''
                SELECT id, name, email, account_type
                FROM users
                WHERE id = ? AND role = 'user'
            ''', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if str(user['account_type'] or '').strip().lower() != 'company':
                conn.close()
                return jsonify({'error': 'User is not a company account', 'code': 'COMPANY_ACCOUNT_REQUIRED'}), 400

            company = conn.execute('SELECT id FROM company_profiles WHERE user_id = ?', (user_id,)).fetchone()
            if not company:
                conn.close()
                return jsonify({'error': 'Company profile not found', 'code': 'COMPANY_PROFILE_NOT_FOUND'}), 404

            if action == 'approve':
                conn.execute('''
                    UPDATE company_profiles
                    SET verification_status = 'verified',
                        verification_note = NULL,
                        reviewed_at = CURRENT_TIMESTAMP,
                        verified_at = CURRENT_TIMESTAMP,
                        approved_by_user_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ''', (admin_user_id, user_id))
                message = 'تم اعتماد ملف الشركة بنجاح'
            else:
                conn.execute('''
                    UPDATE company_profiles
                    SET verification_status = 'rejected',
                        verification_note = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        verified_at = NULL,
                        approved_by_user_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ''', (note or 'يرجى تعديل بيانات أو وثائق الشركة ثم إعادة الإرسال', admin_user_id, user_id))
                message = 'تم رفض ملف الشركة'

            conn.commit()
            conn.close()

            ctx.log_audit_event(
                action=f'admin.company_{action}',
                user_id=admin_user_id,
                entity_type='company_profile',
                entity_id=user_id,
                new_value={'note': note}
            )

            return jsonify({'success': True, 'message': message}), 200
        except Exception as e:
            print(f"Review company profile error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_user(user_id):
        try:
            if user_id == 1:
                return jsonify({'error': 'Cannot delete admin user', 'code': 'CANNOT_DELETE_ADMIN'}), 403

            admin_user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            target_user = conn.execute('SELECT id, email, public_user_id FROM users WHERE id = ? AND role != "admin"', (user_id,)).fetchone()
            if not target_user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
            cursor = conn.cursor()
            cursor.execute('DELETE FROM user_wallets WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM users WHERE id = ? AND role != "admin"', (user_id,))
            conn.commit()
            conn.close()
            ctx.log_audit_event(
                action='admin.user_delete',
                user_id=admin_user_id,
                entity_type='user',
                entity_id=user_id,
                old_value={'email': target_user['email'], 'public_user_id': target_user['public_user_id']}
            )

            return jsonify({'success': True, 'message': 'تم حذف المستخدم بنجاح'}), 200

        except Exception as e:
            print(f"Delete user error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
    @ctx.admin_required
    def update_user(user_id):
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            
            name = data.get('name')
            email = data.get('email')
            phone = data.get('phone')
            role = data.get('role')
            is_active = data.get('is_active')
            kyc_status = data.get('kyc_status')
            balance = data.get('balance', 0.0)
            password = data.get('password')

            if not email:
                return jsonify({'error': 'Email is required', 'code': 'EMAIL_REQUIRED'}), 400

            conn = ctx.get_db_connection()
            target_user = conn.execute('SELECT id, email, role FROM users WHERE id = ?', (user_id,)).fetchone()
            if not target_user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            # Prevent updating main admin user role to user
            if user_id == 1 and role != 'admin':
                conn.close()
                return jsonify({'error': 'Cannot change super admin role', 'code': 'CANNOT_CHANGE_SUPER_ADMIN_ROLE'}), 403

            cursor = conn.cursor()
            
            # If password is provided, generate new hash
            if password and str(password).strip():
                hashed_password = ctx.bcrypt.generate_password_hash(str(password).strip()).decode('utf-8')
                cursor.execute('''
                    UPDATE users 
                    SET name = ?, email = ?, phone = ?, role = ?, is_active = ?, kyc_status = ?, balance = ?, password = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (name, email, phone, role, 1 if is_active else 0, kyc_status, balance, hashed_password, user_id))
            else:
                cursor.execute('''
                    UPDATE users 
                    SET name = ?, email = ?, phone = ?, role = ?, is_active = ?, kyc_status = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (name, email, phone, role, 1 if is_active else 0, kyc_status, balance, user_id))

            conn.commit()
            conn.close()

            ctx.log_audit_event(
                action='admin.user_update',
                user_id=admin_user_id,
                entity_type='user',
                entity_id=user_id,
                new_value={
                    'name': name,
                    'email': email,
                    'phone': phone,
                    'role': role,
                    'is_active': is_active,
                    'kyc_status': kyc_status,
                    'balance': balance,
                    'password_changed': bool(password)
                }
            )

            return jsonify({'success': True, 'message': 'تم تحديث بيانات المستخدم بنجاح'}), 200
        except Exception as e:
            print(f"Update user error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
