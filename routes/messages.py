import json
import os
import uuid
from datetime import datetime

from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename


def register_message_routes(app, ctx):
    def get_system_setting(conn, key, default=None):
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
        return value if value is not None else default

    def parse_multiline_urls(raw_value):
        text = str(raw_value or '').replace(',', '\n')
        return [item.strip() for item in text.splitlines() if item.strip()]

    def get_current_user(conn):
        user_id = int(ctx.get_jwt_identity())
        user = conn.execute(
            'SELECT id, name, role, public_user_id FROM users WHERE id = ? AND is_active = 1',
            (user_id,)
        ).fetchone()
        return user_id, user

    def ensure_participant(conn, conversation_id, user_id):
        return conn.execute(
            '''
            SELECT 1
            FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
            ''',
            (conversation_id, user_id)
        ).fetchone()

    def find_support_admin(conn):
        return conn.execute(
            '''
            SELECT id, name, public_user_id
            FROM users
            WHERE role = 'admin' AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
            '''
        ).fetchone()

    def normalize_support_text(value):
        return str(value or '').strip().lower()

    def build_support_ai_reply(conn, body, message_type='text'):
        ai_name = str(get_system_setting(conn, 'support_ai_name', 'مساعد المنصة الذكي') or 'مساعد المنصة الذكي').strip()
        escalation_notice = str(
            get_system_setting(
                conn,
                'support_ai_escalation_notice',
                'إذا كانت الحالة تحتاج متابعة أعمق فسيكمل فريق الإدارة الرد داخل نفس المحادثة.'
            ) or ''
        ).strip()
        text = normalize_support_text(body)

        if message_type in {'image', 'audio'} and not text:
            return {
                'body': f'{ai_name}: تم استلام الملف داخل المحادثة. إذا كان يحتاج مراجعة تفصيلية فسيكمل الأدمن المتابعة هنا.',
                'should_escalate': True
            }

        categories = [
            (
                {'ايداع', 'إيداع', 'deposit', 'tx hash', 'وصل المبلغ', 'تحويل للمحفظة'},
                'تحقق من العملة والشبكة والعنوان أولًا، ثم راقب حالة العملية داخل قسم المعاملات. وعند تفعيل التحقق on-chain يظهر الإيداع بعد المطابقة على الشبكة.'
            ),
            (
                {'سحب', 'withdraw', 'طلب السحب', 'كود السحب'},
                'تأكد من الرصيد ثم اطلب كود السحب من البريد وأدخل العنوان الصحيح. بعد التأكيد يظهر الطلب للمراجعة، وخلال 24 ساعة تتم متابعة التحويل حسب حالته.'
            ),
            (
                {'محفظة', 'wallet', 'عنوان', 'qr', 'شبكة', 'trc20', 'erc20', 'bep20', 'btc'},
                'من قسم المحفظة اختر العملة ثم الشبكة، وبعدها اربط العنوان أو أنشئ المحفظة المطلوبة. إذا لم يظهر العنوان فغالبًا لا توجد قناة استقبال مفعلة لهذه العملة أو الشبكة.'
            ),
            (
                {'استثمار', 'مشروع', 'invest', 'استثمر', 'رصيد غير كافي', 'الغاء الاستثمار'},
                'عند الضغط على الاستثمار يفحص النظام الرصيد أولًا، وإذا كان كافيًا يخصم المبلغ وتُسجل العملية مباشرة. ويمكنك مراجعة تفاصيل المشروع والعائد والمدة قبل التأكيد.'
            ),
            (
                {'kyc', 'توثيق', 'وثائق', 'هوية', 'جواز', 'verification'},
                'حالة التوثيق تظهر في الحساب. ارفع الوثائق بصورة واضحة ومطابقة لبيانات الحساب، وبعد الإرسال تبقى الحالة قيد المراجعة حتى يعتمدها الأدمن أو يطلب إعادة الرفع.'
            ),
            (
                {'دخول', 'login', 'تسجيل الدخول', 'كلمة مرور', 'password', 'نسيت كلمة المرور', 'google'},
                'إذا كانت المشكلة في الدخول فتحقق من البريد وكلمة المرور أولًا، واستخدم استعادة كلمة المرور عند الحاجة. وإذا كان الحساب غير موثق فسيطلب النظام إكمال التحقق قبل بعض الإجراءات.'
            ),
            (
                {'رسائل', 'message', 'محادثة', 'اتصال', 'call', 'mic', 'microphone', 'صوت', 'تسجيل صوتي'},
                'في قسم الرسائل يمكنك بدء محادثة عبر رقم الحساب العام، وإرسال نص أو صورة أو صوت، كما يمكن قبول أو إنهاء الاتصال من نفس الواجهة بعد السماح للمتصفح بالميكروفون.'
            )
        ]

        difficult_keywords = {
            'error', '500', 'internal server', 'لا يعمل', 'مشكلة', 'مشكله', 'تعذر',
            'فشل', 'مرفوض', 'محظور', 'اختفى', 'مفقود', 'bug', 'ثغرة', 'اختراق'
        }

        matched_reply = ''
        for keywords, reply in categories:
            if any(keyword.lower() in text for keyword in keywords):
                matched_reply = reply
                break

        should_escalate = any(keyword in text for keyword in difficult_keywords) or len(text) >= 260
        if not matched_reply:
            matched_reply = 'استلمت رسالتك، وأقرب خطوة الآن هي مراجعة القسم المرتبط بالمشكلة ثم إعادة المحاولة بخطوات مرتبة. وإذا بقيت الحالة غير واضحة فسيتم تصعيدها للإدارة.'
            should_escalate = True

        if should_escalate and escalation_notice:
            matched_reply = f'{matched_reply} {escalation_notice}'
        elif not should_escalate:
            matched_reply = f'{matched_reply} وإذا احتجت متابعة بشرية فالإدارة موجودة داخل نفس المحادثة.'

        return {
            'body': f'{ai_name}: {matched_reply}',
            'should_escalate': should_escalate
        }

    def create_support_ai_message(conn, conversation_id, admin_user_id, body, message_type='text'):
        if not bool(get_system_setting(conn, 'support_ai_enabled', True)):
            return None

        reply = build_support_ai_reply(conn, body, message_type)
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO messages (conversation_id, sender_id, body, message_type, message_origin, attachment_url)
            VALUES (?, ?, ?, 'text', 'assistant', NULL)
            ''',
            (conversation_id, admin_user_id, reply['body'])
        )
        cursor.execute(
            '''
            UPDATE conversations
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''',
            (conversation_id,)
        )
        return cursor.lastrowid

    def build_call_payload(conn, call_id):
        row = conn.execute(
            '''
            SELECT
                cs.id,
                cs.conversation_id,
                cs.initiated_by,
                cs.call_type,
                cs.status,
                cs.created_at,
                cs.accepted_at,
                cs.ended_at,
                cs.ended_by,
                cs.last_signal_at,
                initiator.name AS initiator_name,
                initiator.public_user_id AS initiator_public_user_id,
                ended_user.name AS ended_by_name
            FROM call_sessions cs
            JOIN users initiator ON initiator.id = cs.initiated_by
            LEFT JOIN users ended_user ON ended_user.id = cs.ended_by
            WHERE cs.id = ?
            ''',
            (call_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_active_call(conn, conversation_id):
        row = conn.execute(
            '''
            SELECT id
            FROM call_sessions
            WHERE conversation_id = ?
              AND status IN ('ringing', 'active')
            ORDER BY id DESC
            LIMIT 1
            ''',
            (conversation_id,)
        ).fetchone()
        return build_call_payload(conn, row['id']) if row else None

    def build_conversation_payload(conn, conversation_id, user_id):
        conversation = conn.execute(
            '''
            SELECT id, kind, title, created_at, updated_at
            FROM conversations
            WHERE id = ?
            ''',
            (conversation_id,)
        ).fetchone()
        if not conversation:
            return None

        participants = conn.execute(
            '''
            SELECT u.id, u.name, u.public_user_id, u.role
            FROM conversation_participants cp
            JOIN users u ON u.id = cp.user_id
            WHERE cp.conversation_id = ?
            ORDER BY u.role DESC, u.name ASC
            ''',
            (conversation_id,)
        ).fetchall()

        last_message = conn.execute(
            '''
            SELECT
                m.id,
                m.body,
                m.message_type,
                m.message_origin,
                m.attachment_url,
                m.read_at,
                m.created_at,
                u.name AS sender_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
            ''',
            (conversation_id,)
        ).fetchone()

        unread_count = conn.execute(
            '''
            SELECT COUNT(*) AS total
            FROM messages
            WHERE conversation_id = ?
              AND sender_id != ?
              AND read_at IS NULL
            ''',
            (conversation_id, user_id)
        ).fetchone()

        participant_dicts = [dict(row) for row in participants]
        other_participants = [p for p in participant_dicts if p['id'] != user_id]
        counterpart = other_participants[0] if other_participants else (participant_dicts[0] if participant_dicts else None)

        payload = dict(conversation)
        payload['participants'] = participant_dicts
        payload['counterpart'] = counterpart
        payload['last_message'] = dict(last_message) if last_message else None
        payload['unread_count'] = int((unread_count or {'total': 0})['total'] or 0)
        payload['active_call'] = get_active_call(conn, conversation_id)
        return payload

    def ensure_call_access(conn, call_id, user_id):
        call = conn.execute(
            '''
            SELECT cs.id, cs.conversation_id, cs.status
            FROM call_sessions cs
            JOIN conversation_participants cp ON cp.conversation_id = cs.conversation_id
            WHERE cs.id = ? AND cp.user_id = ?
            LIMIT 1
            ''',
            (call_id, user_id)
        ).fetchone()
        return dict(call) if call else None

    def serialize_message_rows(rows):
        return [dict(row) for row in rows]

    @app.route('/api/messages/conversations', methods=['GET'])
    @ctx.jwt_required()
    @ctx.limiter.limit("1500 per hour", override_defaults=True)
    def get_conversations():
        try:
            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            rows = conn.execute(
                '''
                SELECT c.id
                FROM conversations c
                JOIN conversation_participants cp ON cp.conversation_id = c.id
                WHERE cp.user_id = ?
                ORDER BY c.updated_at DESC, c.id DESC
                ''',
                (user_id,)
            ).fetchall()

            conversations = [build_conversation_payload(conn, row['id'], user_id) for row in rows]
            conn.close()

            return jsonify({'success': True, 'data': {'conversations': conversations}}), 200
        except Exception as e:
            print(f"Get conversations error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/conversations', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("180 per hour", override_defaults=True)
    def start_conversation():
        try:
            data = request.get_json() or {}
            target_type = str(data.get('target_type') or 'support').strip().lower()

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if target_type == 'support':
                counterpart = find_support_admin(conn)
                if not counterpart:
                    conn.close()
                    return jsonify({'error': 'Support admin not found', 'code': 'SUPPORT_NOT_AVAILABLE'}), 404
                title = 'الدعم والمساعدة'
                kind = 'support'
            else:
                public_user_id = str(data.get('recipient_public_id') or '').strip()
                if not public_user_id:
                    conn.close()
                    return jsonify({'error': 'Recipient public user ID is required', 'code': 'MISSING_RECIPIENT'}), 400

                counterpart = conn.execute(
                    '''
                    SELECT id, name, public_user_id, role
                    FROM users
                    WHERE public_user_id = ? AND role = 'user' AND is_active = 1
                    ''',
                    (public_user_id,)
                ).fetchone()
                if not counterpart:
                    conn.close()
                    return jsonify({'error': 'Recipient not found', 'code': 'RECIPIENT_NOT_FOUND'}), 404
                if counterpart['id'] == user_id:
                    conn.close()
                    return jsonify({'error': 'You cannot message yourself', 'code': 'SELF_MESSAGE_NOT_ALLOWED'}), 400
                title = f"محادثة مع {counterpart['name']}"
                kind = 'direct'

            existing = conn.execute(
                '''
                SELECT c.id
                FROM conversations c
                JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
                JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
                WHERE c.kind = ?
                LIMIT 1
                ''',
                (user_id, counterpart['id'], kind)
            ).fetchone()

            if existing:
                payload = build_conversation_payload(conn, existing['id'], user_id)
                conn.close()
                return jsonify({'success': True, 'data': {'conversation': payload}}), 200

            cursor = conn.cursor()
            cursor.execute(
                '''
                INSERT INTO conversations (kind, title, created_by, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ''',
                (kind, title, user_id)
            )
            conversation_id = cursor.lastrowid
            cursor.executemany(
                '''
                INSERT INTO conversation_participants (conversation_id, user_id)
                VALUES (?, ?)
                ''',
                [(conversation_id, user_id), (conversation_id, counterpart['id'])]
            )
            conn.commit()

            payload = build_conversation_payload(conn, conversation_id, user_id)
            conn.close()
            return jsonify({'success': True, 'message': 'تم إنشاء المحادثة بنجاح', 'data': {'conversation': payload}}), 201
        except Exception as e:
            print(f"Start conversation error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/conversations/<int:conversation_id>', methods=['GET'])
    @ctx.jwt_required()
    @ctx.limiter.limit("1500 per hour", override_defaults=True)
    def get_conversation_messages(conversation_id):
        try:
            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not ensure_participant(conn, conversation_id, user_id):
                conn.close()
                return jsonify({'error': 'Conversation not accessible', 'code': 'CONVERSATION_FORBIDDEN'}), 403

            conn.execute(
                '''
                UPDATE messages
                SET read_at = CURRENT_TIMESTAMP
                WHERE conversation_id = ?
                  AND sender_id != ?
                  AND read_at IS NULL
                ''',
                (conversation_id, user_id)
            )
            conn.commit()

            conversation = build_conversation_payload(conn, conversation_id, user_id)
            messages = conn.execute(
                '''
                SELECT
                    m.id,
                    m.body,
                    m.message_type,
                    m.message_origin,
                    m.attachment_url,
                    m.read_at,
                    m.created_at,
                    m.sender_id,
                    u.name AS sender_name,
                    u.public_user_id AS sender_public_user_id
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.conversation_id = ?
                ORDER BY m.created_at ASC, m.id ASC
                ''',
                (conversation_id,)
            ).fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'conversation': conversation,
                    'messages': serialize_message_rows(messages)
                }
            }), 200
        except Exception as e:
            print(f"Get conversation messages error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/conversations/<int:conversation_id>/messages', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("360 per hour", override_defaults=True)
    def send_message(conversation_id):
        try:
            data = request.get_json() or {}
            body = str(data.get('body') or '').strip()
            message_type = str(data.get('message_type') or 'text').strip().lower()
            attachment_url = str(data.get('attachment_url') or '').strip()

            if message_type not in {'text', 'image', 'audio'}:
                return jsonify({'error': 'Invalid message type', 'code': 'INVALID_MESSAGE_TYPE'}), 400
            if not body and not attachment_url:
                return jsonify({'error': 'Message body or attachment required', 'code': 'EMPTY_MESSAGE'}), 400

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not ensure_participant(conn, conversation_id, user_id):
                conn.close()
                return jsonify({'error': 'Conversation not accessible', 'code': 'CONVERSATION_FORBIDDEN'}), 403

            conversation = conn.execute(
                '''
                SELECT id, kind
                FROM conversations
                WHERE id = ?
                ''',
                (conversation_id,)
            ).fetchone()

            cursor = conn.cursor()
            cursor.execute(
                '''
                INSERT INTO messages (conversation_id, sender_id, body, message_type, message_origin, attachment_url)
                VALUES (?, ?, ?, ?, 'user', ?)
                ''',
                (conversation_id, user_id, body, message_type, attachment_url or None)
            )
            message_id = cursor.lastrowid
            assistant_message_id = None
            if conversation and str(conversation['kind'] or '') == 'support' and str(user['role'] or '') != 'admin':
                support_admin = find_support_admin(conn)
                if support_admin:
                    assistant_message_id = create_support_ai_message(
                        conn,
                        conversation_id,
                        int(support_admin['id']),
                        body,
                        message_type
                    )
            cursor.execute(
                '''
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (conversation_id,)
            )
            conn.commit()

            message = conn.execute(
                '''
                SELECT
                    m.id,
                    m.body,
                    m.message_type,
                    m.message_origin,
                    m.attachment_url,
                    m.read_at,
                    m.created_at,
                    m.sender_id,
                    u.name AS sender_name,
                    u.public_user_id AS sender_public_user_id
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.id = ?
                ''',
                (message_id,)
            ).fetchone()

            assistant_message = None
            if assistant_message_id:
                assistant_message = conn.execute(
                    '''
                    SELECT
                        m.id,
                        m.body,
                        m.message_type,
                        m.message_origin,
                        m.attachment_url,
                        m.read_at,
                        m.created_at,
                        m.sender_id,
                        u.name AS sender_name,
                        u.public_user_id AS sender_public_user_id
                    FROM messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.id = ?
                    ''',
                    (assistant_message_id,)
                ).fetchone()
            conn.close()

            payload = {'message_item': dict(message)}
            if assistant_message:
                payload['assistant_message_item'] = dict(assistant_message)

            return jsonify({'success': True, 'message': 'تم إرسال الرسالة', 'data': payload}), 201
        except Exception as e:
            print(f"Send message error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/messages/<int:message_id>', methods=['DELETE'])
    @ctx.jwt_required()
    @ctx.limiter.limit("180 per hour", override_defaults=True)
    def delete_message_for_everyone(message_id):
        try:
            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            message = conn.execute(
                '''
                SELECT id, conversation_id, sender_id
                FROM messages
                WHERE id = ?
                ''',
                (message_id,)
            ).fetchone()

            if not message:
                conn.close()
                return jsonify({'error': 'Message not found', 'code': 'MESSAGE_NOT_FOUND'}), 404

            if not ensure_participant(conn, message['conversation_id'], user_id):
                conn.close()
                return jsonify({'error': 'Conversation not accessible', 'code': 'CONVERSATION_FORBIDDEN'}), 403

            if int(message['sender_id']) != int(user_id):
                conn.close()
                return jsonify({'error': 'Only the sender can delete this message for everyone', 'code': 'DELETE_NOT_ALLOWED'}), 403

            conn.execute('DELETE FROM messages WHERE id = ?', (message_id,))
            conn.execute(
                '''
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (message['conversation_id'],)
            )
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'تم حذف الرسالة لدى الجميع'}), 200
        except Exception as e:
            print(f"Delete message error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/conversations/<int:conversation_id>/call', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("120 per hour", override_defaults=True)
    def start_call(conversation_id):
        try:
            data = request.get_json() or {}
            call_type = str(data.get('call_type') or 'audio').strip().lower()
            if call_type != 'audio':
                return jsonify({'error': 'Only audio calls are supported', 'code': 'UNSUPPORTED_CALL_TYPE'}), 400

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            if not ensure_participant(conn, conversation_id, user_id):
                conn.close()
                return jsonify({'error': 'Conversation not accessible', 'code': 'CONVERSATION_FORBIDDEN'}), 403

            existing_for_conversation = conn.execute(
                '''
                SELECT id
                FROM call_sessions
                WHERE conversation_id = ?
                  AND status IN ('ringing', 'active')
                ORDER BY id DESC
                LIMIT 1
                ''',
                (conversation_id,)
            ).fetchone()
            if existing_for_conversation:
                payload = build_call_payload(conn, existing_for_conversation['id'])
                conn.close()
                return jsonify({'success': True, 'data': {'call': payload}}), 200

            user_active_call = conn.execute(
                '''
                SELECT cs.id
                FROM call_sessions cs
                JOIN conversation_participants cp ON cp.conversation_id = cs.conversation_id
                WHERE cp.user_id = ?
                  AND cs.status IN ('ringing', 'active')
                ORDER BY cs.id DESC
                LIMIT 1
                ''',
                (user_id,)
            ).fetchone()
            if user_active_call:
                payload = build_call_payload(conn, user_active_call['id'])
                conn.close()
                return jsonify({
                    'error': 'An active call already exists for this user',
                    'code': 'CALL_ALREADY_ACTIVE',
                    'data': {'call': payload}
                }), 409

            cursor = conn.cursor()
            cursor.execute(
                '''
                INSERT INTO call_sessions (conversation_id, initiated_by, call_type, status, last_signal_at)
                VALUES (?, ?, ?, 'ringing', CURRENT_TIMESTAMP)
                ''',
                (conversation_id, user_id, call_type)
            )
            call_id = cursor.lastrowid
            cursor.execute(
                '''
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (conversation_id,)
            )
            conn.commit()

            payload = build_call_payload(conn, call_id)
            conn.close()
            return jsonify({'success': True, 'message': 'تم بدء الاتصال', 'data': {'call': payload}}), 201
        except Exception as e:
            print(f"Start call error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/calls/<int:call_id>', methods=['GET'])
    @ctx.jwt_required()
    @ctx.limiter.limit("1500 per hour", override_defaults=True)
    def get_call(call_id):
        try:
            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            accessible_call = ensure_call_access(conn, call_id, user_id)
            if not accessible_call:
                conn.close()
                return jsonify({'error': 'Call not accessible', 'code': 'CALL_FORBIDDEN'}), 403

            payload = build_call_payload(conn, call_id)
            conn.close()
            return jsonify({'success': True, 'data': {'call': payload}}), 200
        except Exception as e:
            print(f"Get call error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/calls/<int:call_id>/action', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("240 per hour", override_defaults=True)
    def act_on_call(call_id):
        try:
            data = request.get_json() or {}
            action = str(data.get('action') or '').strip().lower()
            if action not in {'accept', 'reject', 'end'}:
                return jsonify({'error': 'Invalid call action', 'code': 'INVALID_CALL_ACTION'}), 400

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            accessible_call = ensure_call_access(conn, call_id, user_id)
            if not accessible_call:
                conn.close()
                return jsonify({'error': 'Call not accessible', 'code': 'CALL_FORBIDDEN'}), 403

            current = build_call_payload(conn, call_id)
            if not current:
                conn.close()
                return jsonify({'error': 'Call not found', 'code': 'CALL_NOT_FOUND'}), 404

            if action == 'accept':
                if current['status'] != 'ringing':
                    conn.close()
                    return jsonify({'error': 'Call is no longer ringing', 'code': 'CALL_NOT_RINGING'}), 409
                conn.execute(
                    '''
                    UPDATE call_sessions
                    SET status = 'active',
                        accepted_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    ''',
                    (call_id,)
                )
            elif action == 'reject':
                if current['status'] not in {'ringing', 'active'}:
                    conn.close()
                    return jsonify({'error': 'Call already closed', 'code': 'CALL_ALREADY_CLOSED'}), 409
                conn.execute(
                    '''
                    UPDATE call_sessions
                    SET status = 'rejected',
                        ended_at = CURRENT_TIMESTAMP,
                        ended_by = ?
                    WHERE id = ?
                    ''',
                    (user_id, call_id)
                )
            else:
                if current['status'] not in {'ringing', 'active'}:
                    conn.close()
                    return jsonify({'error': 'Call already closed', 'code': 'CALL_ALREADY_CLOSED'}), 409
                conn.execute(
                    '''
                    UPDATE call_sessions
                    SET status = 'ended',
                        ended_at = CURRENT_TIMESTAMP,
                        ended_by = ?
                    WHERE id = ?
                    ''',
                    (user_id, call_id)
                )

            conn.commit()
            payload = build_call_payload(conn, call_id)
            conn.close()
            return jsonify({'success': True, 'message': 'تم تحديث حالة الاتصال', 'data': {'call': payload}}), 200
        except Exception as e:
            print(f"Call action error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/calls/<int:call_id>/signal', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("1800 per hour", override_defaults=True)
    def add_call_signal(call_id):
        try:
            data = request.get_json() or {}
            signal_type = str(data.get('signal_type') or '').strip().lower()
            payload = data.get('payload')
            if signal_type not in {'offer', 'answer', 'ice-candidate'}:
                return jsonify({'error': 'Invalid signal type', 'code': 'INVALID_SIGNAL_TYPE'}), 400

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            accessible_call = ensure_call_access(conn, call_id, user_id)
            if not accessible_call:
                conn.close()
                return jsonify({'error': 'Call not accessible', 'code': 'CALL_FORBIDDEN'}), 403

            current = build_call_payload(conn, call_id)
            if not current or current['status'] not in {'ringing', 'active'}:
                conn.close()
                return jsonify({'error': 'Call is not active', 'code': 'CALL_NOT_ACTIVE'}), 409

            cursor = conn.cursor()
            cursor.execute(
                '''
                INSERT INTO call_signals (call_id, sender_id, signal_type, payload)
                VALUES (?, ?, ?, ?)
                ''',
                (call_id, user_id, signal_type, json.dumps(payload))
            )
            signal_id = cursor.lastrowid
            cursor.execute(
                '''
                UPDATE call_sessions
                SET last_signal_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''',
                (call_id,)
            )
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'data': {'signal_id': signal_id}}), 201
        except Exception as e:
            print(f"Add call signal error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/calls/<int:call_id>/signals', methods=['GET'])
    @ctx.jwt_required()
    @ctx.limiter.limit("2400 per hour", override_defaults=True)
    def get_call_signals(call_id):
        try:
            after_id = int(request.args.get('after_id', 0))

            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            accessible_call = ensure_call_access(conn, call_id, user_id)
            if not accessible_call:
                conn.close()
                return jsonify({'error': 'Call not accessible', 'code': 'CALL_FORBIDDEN'}), 403

            signals = conn.execute(
                '''
                SELECT id, call_id, sender_id, signal_type, payload, created_at
                FROM call_signals
                WHERE call_id = ? AND id > ?
                ORDER BY id ASC
                ''',
                (call_id, after_id)
            ).fetchall()
            payload = build_call_payload(conn, call_id)
            conn.close()

            items = []
            for row in signals:
                item = dict(row)
                try:
                    item['payload'] = json.loads(item.get('payload') or 'null')
                except json.JSONDecodeError:
                    item['payload'] = None
                items.append(item)

            return jsonify({'success': True, 'data': {'call': payload, 'signals': items}}), 200
        except Exception as e:
            print(f"Get call signals error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/rtc-config', methods=['GET'])
    @ctx.jwt_required()
    @ctx.limiter.limit("300 per hour", override_defaults=True)
    def get_rtc_config():
        try:
            conn = ctx.get_db_connection()
            user_id, user = get_current_user(conn)
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            stun_urls = parse_multiline_urls(get_system_setting(conn, 'rtc_stun_urls', 'stun:stun.l.google.com:19302'))
            turn_enabled = bool(get_system_setting(conn, 'rtc_turn_enabled', False))
            turn_url = str(get_system_setting(conn, 'rtc_turn_url', '') or '').strip()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'stun_urls': stun_urls or ['stun:stun.l.google.com:19302'],
                    'turn_enabled': turn_enabled,
                    'turn_configured': bool(turn_url)
                }
            }), 200
        except Exception as e:
            print(f"Get RTC config error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/messages/upload', methods=['POST'])
    @ctx.jwt_required()
    @ctx.limiter.limit("240 per hour", override_defaults=True)
    def upload_message_attachment():
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file provided', 'code': 'NO_FILE'}), 400

            file = request.files['file']
            if not file or not file.filename:
                return jsonify({'error': 'No file provided', 'code': 'NO_FILE'}), 400

            mime = str(file.mimetype or '').lower()
            if mime.startswith('image/'):
                message_type = 'image'
            elif mime.startswith('audio/'):
                message_type = 'audio'
            else:
                return jsonify({'error': 'Only image and audio files are supported', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400

            safe_name = secure_filename(file.filename) or 'attachment'
            extension = os.path.splitext(safe_name)[1] or ('.jpg' if message_type == 'image' else '.webm')
            generated_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:10]}{extension}"
            save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], generated_name)
            file.save(save_path)

            return jsonify({
                'success': True,
                'message': 'تم رفع الملف بنجاح',
                'data': {
                    'attachment_url': f'/uploads/{generated_name}',
                    'message_type': message_type
                }
            }), 201
        except Exception as e:
            print(f"Upload message attachment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
