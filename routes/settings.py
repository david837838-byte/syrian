import json
import os
import sqlite3
import uuid
from datetime import datetime

from flask import current_app, jsonify, request, send_file


def register_settings_routes(app, ctx):
    def get_setting_value(conn, key, default=None):
        row = conn.execute(
            'SELECT value, data_type FROM system_settings WHERE key = ?',
            (key,)
        ).fetchone()
        if not row:
            return default

        value = row['value']
        data_type = str(row['data_type'] or '').lower()
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
            except (TypeError, json.JSONDecodeError):
                return default
        return value

    def get_backup_folder():
        folder = current_app.config.get('BACKUP_FOLDER', 'backups')
        os.makedirs(folder, exist_ok=True)
        return folder

    def get_database_path():
        return current_app.config.get('DATABASE_PATH', 'database.db')

    def list_backup_files():
        folder = get_backup_folder()
        backups = []
        for name in os.listdir(folder):
            if not name.lower().endswith('.db'):
                continue
            path = os.path.join(folder, name)
            if not os.path.isfile(path):
                continue
            stat = os.stat(path)
            backups.append({
                'filename': name,
                'size_bytes': stat.st_size,
                'created_at': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            })
        backups.sort(key=lambda item: item['created_at'], reverse=True)
        return backups

    def cleanup_old_backups(max_count):
        try:
            max_count = max(1, int(max_count))
        except (TypeError, ValueError):
            max_count = 10

        backups = list_backup_files()
        for backup in backups[max_count:]:
            backup_path = os.path.join(get_backup_folder(), backup['filename'])
            if os.path.isfile(backup_path):
                os.remove(backup_path)

    def create_backup_snapshot(prefix='platform_backup'):
        backup_folder = get_backup_folder()
        db_path = get_database_path()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f'{prefix}_{timestamp}.db'
        backup_path = os.path.join(backup_folder, filename)

        source = sqlite3.connect(db_path)
        destination = sqlite3.connect(backup_path)
        try:
            source.backup(destination)
        finally:
            destination.close()
            source.close()
        return filename

    def get_media_upload_folder():
        upload_root = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        folder = os.path.join(upload_root, 'site_videos')
        os.makedirs(folder, exist_ok=True)
        return folder

    @app.route('/api/settings', methods=['GET'])
    def get_settings():
        try:
            public_launch_keys = (
                'maintenance_mode',
                'maintenance_message',
                'real_money_enabled',
                'legacy_wallet_section_enabled',
                'real_wallets_section_enabled',
                'financial_channels_enabled',
                'real_crypto_wallet_creation_enabled'
            )

            try:
                ctx.verify_jwt_in_request(optional=True)
                user_id = ctx.get_jwt_identity()
            except Exception:
                user_id = None

            conn = ctx.get_db_connection()
            user_role = None
            if user_id:
                user = conn.execute(
                    'SELECT role FROM users WHERE id = ?',
                    (int(user_id),)
                ).fetchone()
                user_role = user['role'] if user else None

            if user_role == 'admin':
                settings = conn.execute('''
                    SELECT * FROM system_settings
                    ORDER BY category, key
                ''').fetchall()
            else:
                settings = conn.execute('''
                    SELECT * FROM system_settings
                    WHERE category IN ('general', 'financial', 'marketing', 'contact')
                       OR key IN (?, ?, ?, ?, ?, ?, ?)
                    ORDER BY category, key
                ''', public_launch_keys).fetchall()

            currencies = conn.execute('''
                SELECT * FROM currencies WHERE is_active = 1 ORDER BY code
            ''').fetchall()
            networks = conn.execute('''
                SELECT
                    id,
                    currency_id,
                    name,
                    code,
                    is_active,
                    fee_percentage,
                    fee_fixed,
                    min_amount
                FROM networks
                WHERE is_active = 1
                ORDER BY currency_id, id
            ''').fetchall()
            conn.close()

            settings_dict = {}
            for setting in settings:
                value = setting['value']
                if setting['data_type'] == 'number':
                    try:
                        value = float(value) if '.' in str(value) else int(value)
                    except (TypeError, ValueError):
                        value = setting['value']
                elif setting['data_type'] == 'boolean':
                    value = str(value).lower() == 'true'
                elif setting['data_type'] == 'json':
                    try:
                        value = json.loads(value)
                    except Exception:
                        value = [] if str(value).startswith('[') else {}

                settings_dict[setting['key']] = {
                    'value': value,
                    'type': setting['data_type'],
                    'category': setting['category'],
                    'description': setting['description'],
                    'editable': bool(setting['is_editable'])
                }

            return jsonify({
                'success': True,
                'data': {
                    'settings': settings_dict,
                    'currencies': [dict(c) for c in currencies],
                    'networks': [dict(n) for n in networks]
                }
            }), 200

        except Exception as e:
            print(f"Get settings error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings', methods=['PUT'])
    @ctx.admin_required
    def update_settings():
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided', 'code': 'NO_DATA'}), 400

            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            for key, value in data.items():
                setting = cursor.execute(
                    'SELECT data_type, is_editable FROM system_settings WHERE key = ?',
                    (key,)
                ).fetchone()
                if not setting or not setting['is_editable']:
                    continue

                if setting['data_type'] == 'boolean':
                    value_str = 'true' if value else 'false'
                elif setting['data_type'] == 'number':
                    value_str = str(value)
                elif setting['data_type'] == 'json':
                    value_str = json.dumps(value)
                else:
                    value_str = str(value)

                cursor.execute('''
                    UPDATE system_settings
                    SET value = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE key = ?
                ''', (value_str, key))
                if key == 'mail_sender_name':
                    current_app.config['MAIL_SENDER_NAME'] = value_str
                elif key == 'mail_server':
                    current_app.config['MAIL_SERVER'] = value_str
                elif key == 'mail_port':
                    try:
                        current_app.config['MAIL_PORT'] = int(value_str)
                    except (TypeError, ValueError):
                        current_app.config['MAIL_PORT'] = 587
                elif key == 'mail_use_tls':
                    current_app.config['MAIL_USE_TLS'] = str(value_str).lower() == 'true'
                elif key == 'mail_username':
                    current_app.config['MAIL_USERNAME'] = value_str
                elif key == 'mail_password':
                    current_app.config['MAIL_PASSWORD'] = value_str
                elif key == 'mail_default_sender':
                    current_app.config['MAIL_DEFAULT_SENDER'] = value_str

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تحديث الإعدادات بنجاح'
            }), 200

        except Exception as e:
            print(f"Update settings error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/test-email', methods=['POST'])
    @ctx.admin_required
    def send_test_email():
        try:
            data = request.get_json() or {}
            recipient = data.get('email')
            if not recipient:
                return jsonify({'error': 'Missing required field: email', 'code': 'MISSING_FIELD'}), 400

            try:
                recipient = ctx.validate_email(recipient)
            except Exception as e:
                return jsonify({'error': str(e), 'code': 'INVALID_EMAIL'}), 400

            success = ctx.send_email(
                subject='رسالة تجريبية من إعدادات المنصة',
                recipients=[recipient],
                text_body='هذه رسالة تجريبية للتأكد من أن إعدادات البريد تعمل بشكل صحيح.',
                html_body='''
                    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
                        <h2>نجح اختبار البريد</h2>
                        <p>إذا وصلتك هذه الرسالة فهذا يعني أن إعدادات SMTP الحالية تعمل بشكل صحيح.</p>
                        <p>يمكنك الآن تجربة إنشاء حساب جديد واستلام كود التحقق على هذا البريد.</p>
                    </div>
                '''
            )

            if not success:
                return jsonify({
                    'error': 'تعذر إرسال الرسالة التجريبية. راجع إعدادات SMTP والبريد المرسل.',
                    'code': 'EMAIL_SEND_FAILED',
                    'details': ctx.get_last_email_error()
                }), 400

            return jsonify({
                'success': True,
                'message': 'تم إرسال الرسالة التجريبية بنجاح',
                'data': {
                    'status': 'success'
                }
            }), 200

        except Exception as e:
            print(f"Send test email error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/upload-video', methods=['POST'])
    @ctx.admin_required
    def upload_settings_video():
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'لم يتم إرسال ملف الفيديو', 'code': 'MISSING_FILE'}), 400

            file = request.files['file']
            if not file or not file.filename:
                return jsonify({'error': 'اسم الملف غير صالح', 'code': 'INVALID_FILE'}), 400

            extension = os.path.splitext(file.filename)[1].lower()
            allowed_extensions = {'.mp4', '.webm', '.ogg', '.mov', '.m4v'}
            if extension not in allowed_extensions:
                return jsonify({
                    'error': 'صيغة الفيديو غير مدعومة. استخدم MP4 أو MOV أو WebM أو OGG',
                    'code': 'UNSUPPORTED_VIDEO_FORMAT'
                }), 400

            upload_folder = get_media_upload_folder()
            generated_name = f"site_video_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:10]}{extension}"
            save_path = os.path.join(upload_folder, generated_name)
            file.save(save_path)

            public_url = f"/uploads/site_videos/{generated_name}"
            return jsonify({
                'success': True,
                'message': 'تم رفع الفيديو بنجاح',
                'data': {
                    'file_url': public_url,
                    'filename': generated_name
                }
            }), 201
        except Exception as e:
            print(f"Settings video upload error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/backups', methods=['GET'])
    @ctx.admin_required
    def list_backups():
        try:
            return jsonify({
                'success': True,
                'data': {
                    'backups': list_backup_files()
                }
            }), 200
        except Exception as e:
            print(f"List backups error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/backups/create', methods=['POST'])
    @ctx.admin_required
    def create_backup():
        try:
            conn = ctx.get_db_connection()
            retention_count = get_setting_value(conn, 'backup_retention_count', 10)
            conn.close()
            filename = create_backup_snapshot()
            cleanup_old_backups(retention_count)

            ctx.log_audit_event(
                action='admin.backup_create',
                user_id=int(ctx.get_jwt_identity()),
                entity_type='system_backup',
                new_value={'filename': filename}
            )

            return jsonify({
                'success': True,
                'message': 'تم إنشاء النسخة الاحتياطية بنجاح',
                'data': {
                    'filename': filename,
                    'backups': list_backup_files()
                }
            }), 201
        except Exception as e:
            print(f"Create backup error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/backups/download/<path:filename>', methods=['GET'])
    @ctx.admin_required
    def download_backup(filename):
        try:
            safe_name = os.path.basename(filename)
            backup_path = os.path.join(get_backup_folder(), safe_name)
            if not os.path.isfile(backup_path):
                return jsonify({'error': 'Backup not found', 'code': 'BACKUP_NOT_FOUND'}), 404
            return send_file(backup_path, as_attachment=True, download_name=safe_name)
        except Exception as e:
            print(f"Download backup error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/settings/backups/restore', methods=['POST'])
    @ctx.admin_required
    def restore_backup():
        try:
            data = request.get_json() or {}
            filename = os.path.basename(str(data.get('filename') or '').strip())
            if not filename:
                return jsonify({'error': 'Backup filename is required', 'code': 'MISSING_BACKUP_FILENAME'}), 400

            backup_path = os.path.join(get_backup_folder(), filename)
            if not os.path.isfile(backup_path):
                return jsonify({'error': 'Backup not found', 'code': 'BACKUP_NOT_FOUND'}), 404

            validation_conn = sqlite3.connect(backup_path)
            try:
                tables = {
                    row[0] for row in validation_conn.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    ).fetchall()
                }
                required_tables = {'users', 'system_settings', 'transactions', 'investments'}
                if not required_tables.issubset(tables):
                    return jsonify({'error': 'Backup structure is invalid', 'code': 'INVALID_BACKUP_FILE'}), 400
            finally:
                validation_conn.close()

            conn = ctx.get_db_connection()
            retention_count = get_setting_value(conn, 'backup_retention_count', 10)
            auto_backup_before_restore = bool(get_setting_value(conn, 'backup_auto_create_before_restore', True))
            conn.close()

            pre_restore_backup = None
            if auto_backup_before_restore:
                pre_restore_backup = create_backup_snapshot(prefix='pre_restore_backup')

            db_path = get_database_path()
            source = sqlite3.connect(backup_path)
            destination = sqlite3.connect(db_path)
            try:
                source.backup(destination)
            finally:
                destination.close()
                source.close()
            cleanup_old_backups(retention_count)

            ctx.log_audit_event(
                action='admin.backup_restore',
                user_id=int(ctx.get_jwt_identity()),
                entity_type='system_backup',
                new_value={'filename': filename, 'pre_restore_backup': pre_restore_backup}
            )

            return jsonify({
                'success': True,
                'message': 'تمت استعادة النسخة الاحتياطية بنجاح',
                'data': {
                    'filename': filename,
                    'pre_restore_backup': pre_restore_backup
                }
            }), 200
        except Exception as e:
            print(f"Restore backup error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
