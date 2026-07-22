import codecs

rest_of_file = r'''
    @app.route('/api/transactions/withdraw/request-code', methods=['POST'])
    @ctx.jwt_required()
    def request_withdraw_code():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}

            required_fields = ['currency', 'network', 'amount', 'wallet_address']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                amount = ctx.parse_positive_float(data['amount'], 'amount')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_AMOUNT'}), 400

            currency_code = data['currency'].upper()
            network_code = data['network'].upper()
            wallet_address = str(data['wallet_address']).strip()

            conn = ctx.get_db_connection()
            if not is_setting_enabled(conn, 'withdraw_enabled', True):
                conn.close()
                return jsonify({
                    'error': 'السحب متوقف حالياً من إعدادات المنصة',
                    'code': 'WITHDRAW_DISABLED'
                }), 403

            currency_id, network_id, currency_full, fee, total_amount, error = load_withdrawal_context(
                conn, user_id, currency_code, network_code, amount
            )
            if error:
                conn.close()
                payload, status_code = error
                return jsonify(payload), status_code

            user = conn.execute('SELECT name, email FROM users WHERE id = ?', (user_id,)).fetchone()
            if not user:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            code = ctx.create_withdrawal_verification_code(
                conn,
                user_id,
                currency_id,
                network_id,
                amount,
                wallet_address
            )
            conn.commit()
            conn.close()

            email_sent = ctx.send_email(
                subject='كود توثيق طلب السحب',
                recipients=[user['email']],
                text_body=f'كود توثيق السحب الخاص بك هو: {code}',
                html_body=f"""
                    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
                        <h2>توثيق طلب السحب</h2>
                        <p>مرحباً {user["name"] or "المستخدم"},</p>
                        <p>أدخل الكود التالي لتأكيد طلب السحب ومتابعة المراجعة:</p>
                        <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0a7c3d;">
                            {code}
                        </div>
                        <p>قيمة السحب: {amount} {currency_code}</p>
                        <p>الرسوم: {fee:.8f} {currency_code}</p>
                        <p>الإجمالي المحجوز: {total_amount:.8f} {currency_code}</p>
                        <p>صلاحية الكود 10 دقائق فقط.</p>
                    </div>
                """
            )

            if not email_sent:
                return jsonify({
                    'error': 'تعذر إرسال كود التوثيق إلى البريد الإلكتروني',
                    'code': 'WITHDRAW_EMAIL_SEND_FAILED',
                    'details': ctx.get_last_email_error()
                }), 400

            return jsonify({
                'success': True,
                'message': 'تم إرسال كود توثيق السحب إلى بريدك الإلكتروني',
                'data': {
                    'amount': amount,
                    'fee': fee,
                    'total': total_amount,
                    'expires_in_minutes': 10
                }
            }), 200

        except Exception as e:
            print(f"Withdraw code request error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/transactions/withdraw', methods=['POST'])
    @ctx.jwt_required()
    def withdraw():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}

            required_fields = ['currency', 'network', 'amount', 'wallet_address']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                amount = ctx.parse_positive_float(data['amount'], 'amount')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_AMOUNT'}), 400

            currency_code = data['currency'].upper()
            network_code = data['network'].upper()
            wallet_address = str(data['wallet_address']).strip()
            verification_code = str(data.get('verification_code', '')).strip()
            conn = ctx.get_db_connection()

            if not is_setting_enabled(conn, 'withdraw_enabled', True):
                conn.close()
                return jsonify({
                    'error': 'السحب متوقف حالياً من إعدادات المنصة',
                    'code': 'WITHDRAW_DISABLED'
                }), 403

            currency_id, network_id, currency_full, fee, total_amount, error = load_withdrawal_context(
                conn, user_id, currency_code, network_code, amount
            )
            if error:
                conn.close()
                payload, status_code = error
                return jsonify(payload), status_code

            if not verification_code:
                conn.close()
                return jsonify({
                    'error': 'Verification code required',
                    'code': 'MISSING_VERIFICATION_CODE'
                }), 400

            code_row = conn.execute("""
                SELECT id
                FROM withdrawal_verification_codes
                WHERE user_id = ?
                  AND currency_id = ?
                  AND network_id = ?
                  AND amount = ?
                  AND wallet_address = ?
                  AND code = ?
                  AND used = 0
                  AND expires_at > CURRENT_TIMESTAMP
                ORDER BY created_at DESC
                LIMIT 1
            """, (user_id, currency_id, network_id, amount, wallet_address, verification_code)).fetchone()

            if not code_row:
                conn.close()
                return jsonify({
                    'error': 'Invalid or expired withdrawal verification code',
                    'code': 'INVALID_WITHDRAW_VERIFICATION_CODE'
                }), 400

            cursor = conn.cursor()
            cursor.execute('UPDATE withdrawal_verification_codes SET used = 1 WHERE id = ?', (code_row['id'],))
            cursor.execute("""
                UPDATE user_wallets
                SET balance = balance - ?, pending_balance = pending_balance + ?
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            """, (total_amount, total_amount, user_id, currency_id, total_amount))

            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor.execute("""
                INSERT INTO withdrawal_requests (
                    user_id, currency_id, network_id, amount, fee,
                    wallet_address, status, admin_note
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (
                user_id,
                currency_id,
                network_id,
                amount,
                fee,
                wallet_address,
                data.get('note', '')
            ))

            withdrawal_id = cursor.lastrowid
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تقديم طلب السحب بنجاح',
                'data': {
                    'withdrawal_id': withdrawal_id,
                    'status': 'pending',
                    'amount': amount,
                    'fee': fee,
                    'total': total_amount
                }
            }), 201

        except Exception as e:
            print(f"Withdraw error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/transactions/internal-transfer', methods=['POST'])
    @ctx.jwt_required()
    def internal_transfer():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}

            required_fields = ['recipient_public_id', 'currency', 'network', 'amount']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            recipient_public_id = str(data.get('recipient_public_id') or '').strip()
            if not recipient_public_id.isdigit():
                return jsonify({'error': 'رقم الحساب المستلم يجب أن يكون رقمياً', 'code': 'INVALID_RECIPIENT'}), 400

            if recipient_public_id == str(100000 + user_id):
                return jsonify({'error': 'You cannot transfer to your own account', 'code': 'SELF_TRANSFER_NOT_ALLOWED'}), 400

            try:
                amount = ctx.parse_positive_float(data['amount'], 'amount')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_AMOUNT'}), 400

            currency_code = str(data['currency']).upper().strip()
            network_code = str(data['network']).upper().strip()
            note = str(data.get('note') or '').strip()

            conn = ctx.get_db_connection()

            if not is_setting_enabled(conn, 'internal_transfer_enabled', True):
                conn.close()
                return jsonify({
                    'error': 'Internal transfers are currently disabled',
                    'code': 'INTERNAL_TRANSFER_DISABLED'
                }), 403

            sender = conn.execute(
                'SELECT id, role, is_active, public_user_id FROM users WHERE id = ?',
                (user_id,)
            ).fetchone()
            recipient = conn.execute(
                'SELECT id, role, is_active, public_user_id FROM users WHERE public_user_id = ?',
                (recipient_public_id,)
            ).fetchone()

            if not sender or not sender['is_active']:
                conn.close()
                return jsonify({'error': 'Sender account unavailable', 'code': 'SENDER_NOT_FOUND'}), 404

            if not recipient or not recipient['is_active']:
                conn.close()
                return jsonify({'error': 'Recipient user not found', 'code': 'RECIPIENT_NOT_FOUND'}), 404

            currency = conn.execute(
                'SELECT id FROM currencies WHERE code = ? AND is_active = 1',
                (currency_code,)
            ).fetchone()
            if not currency:
                conn.close()
                return jsonify({'error': f'Currency {currency_code} not found', 'code': 'INVALID_CURRENCY'}), 400

            candidate_codes = get_network_candidates(currency_code, network_code)
            placeholders = ', '.join(['?'] * len(candidate_codes))
            params = [currency['id'], *candidate_codes]
            network = conn.execute(f"""
                SELECT id, code
                FROM networks
                WHERE currency_id = ? AND is_active = 1 AND UPPER(code) IN ({placeholders})
                ORDER BY id ASC
                LIMIT 1
            """, params).fetchone()

            if not network:
                conn.close()
                return jsonify({'error': f'Network {network_code} not found', 'code': 'INVALID_NETWORK'}), 400

            sender_wallet = conn.execute("""
                SELECT balance
                FROM user_wallets
                WHERE user_id = ? AND currency_id = ?
            """, (user_id, currency['id'])).fetchone()

            if not sender_wallet or float(sender_wallet['balance']) < amount:
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor = conn.cursor()
            cursor.execute("""
                UPDATE user_wallets
                SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            """, (amount, user_id, currency['id'], amount))

            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor.execute("""
                UPDATE user_wallets
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            """, (amount, recipient['id'], currency['id']))

            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO user_wallets (user_id, currency_id, address, balance)
                    VALUES (?, ?, ?, ?)
                """, (recipient['id'], currency['id'], None, amount))

            sender_note = f'تحويل داخلي إلى الحساب {recipient["public_user_id"]}'
            recipient_note = f'تحويل داخلي من الحساب {sender["public_user_id"]}'
            if note:
                sender_note = f'{sender_note} - {note}'
                recipient_note = f'{recipient_note} - {note}'

            cursor.execute("""
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'internal_transfer_sent', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
            """, (user_id, currency['id'], network['id'], amount, sender_note))

            cursor.execute("""
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'internal_transfer_received', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
            """, (recipient['id'], currency['id'], network['id'], amount, recipient_note))

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تنفيذ التحويل الداخلي بنجاح',
                'data': {
                    'recipient_public_id': recipient['public_user_id'],
                    'amount': amount,
                    'currency': currency_code,
                    'network': network['code']
                }
            }), 201

        except Exception as e:
            print(f"Internal transfer error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/transactions', methods=['GET'])
    @ctx.jwt_required()
    def get_transactions():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()

            transactions = conn.execute("""
                SELECT
                    'transaction' as entry_source,
                    t.id,
                    t.type,
                    t.status,
                    t.amount,
                    COALESCE(c.code, '-') as currency_code,
                    COALESCE(c.symbol, '-') as currency_symbol,
                    COALESCE(n.name, '-') as network_name,
                    COALESCE(n.code, '-') as network_code,
                    t.admin_wallet_address,
                    NULL as wallet_address,
                    t.tx_hash,
                    NULL as fee,
                    t.amount as total_amount,
                    t.created_at as date,
                    t.note,
                    t.verified_at,
                    t.admin_note,
                    NULL as processed_at
                FROM transactions t
                LEFT JOIN currencies c ON t.currency_id = c.id
                LEFT JOIN networks n ON t.network_id = n.id
                WHERE t.user_id = ?
            """, (user_id,)).fetchall()

            withdrawals = conn.execute("""
                SELECT
                    'withdrawal_request' as entry_source,
                    w.id,
                    'withdraw' as type,
                    w.status,
                    w.amount,
                    COALESCE(c.code, '-') as currency_code,
                    COALESCE(c.symbol, '-') as currency_symbol,
                    COALESCE(n.name, '-') as network_name,
                    COALESCE(n.code, '-') as network_code,
                    NULL as admin_wallet_address,
                    w.wallet_address,
                    NULL as tx_hash,
                    w.fee,
                    (w.amount + w.fee) as total_amount,
                    w.created_at as date,
                    '' as note,
                    NULL as verified_at,
                    w.admin_note,
                    w.processed_at
                FROM withdrawal_requests w
                LEFT JOIN currencies c ON w.currency_id = c.id
                LEFT JOIN networks n ON w.network_id = n.id
                WHERE w.user_id = ?
            """, (user_id,)).fetchall()

            conn.close()

            combined = [dict(t) for t in transactions] + [dict(w) for w in withdrawals]
            combined.sort(key=lambda item: str(item.get('date') or ''), reverse=True)

            return jsonify({
                'success': True,
                'data': {
                    'transactions': combined[:100]
                }
            }), 200

        except Exception as e:
            print(f"Get transactions error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/transactions/export/csv', methods=['GET'])
    @ctx.jwt_required()
    def export_transactions_csv():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()

            transactions = conn.execute("""
                SELECT t.id, t.type, t.status, t.amount, COALESCE(c.code, '-') as currency_code,
                       COALESCE(n.name, '-') as network_name, t.amount as total_amount, t.created_at as date, t.note
                FROM transactions t
                LEFT JOIN currencies c ON t.currency_id = c.id
                LEFT JOIN networks n ON t.network_id = n.id
                WHERE t.user_id = ?
            """, (user_id,)).fetchall()

            withdrawals = conn.execute("""
                SELECT w.id, 'withdraw' as type, w.status, w.amount, COALESCE(c.code, '-') as currency_code,
                       COALESCE(n.name, '-') as network_name, (w.amount + w.fee) as total_amount, w.created_at as date, '' as note
                FROM withdrawal_requests w
                LEFT JOIN currencies c ON w.currency_id = c.id
                LEFT JOIN networks n ON w.network_id = n.id
                WHERE w.user_id = ?
            """, (user_id,)).fetchall()

            conn.close()

            combined = [dict(t) for t in transactions] + [dict(w) for w in withdrawals]
            combined.sort(key=lambda item: str(item.get('date') or ''), reverse=True)

            output = io.StringIO()
            writer = csv.writer(output)
            output.write('\ufeff')
            writer.writerow(['التاريخ', 'النوع', 'الحالة', 'المبلغ', 'العملة', 'الشبكة', 'الإجمالي مع الرسوم', 'ملاحظات'])

            def translate_type(t):
                types = {'deposit': 'إيداع', 'withdraw': 'سحب', 'internal_transfer_sent': 'تحويل داخلي (صادر)', 'internal_transfer_received': 'تحويل داخلي (وارد)'}
                return types.get(t, t)
                
            def translate_status(s):
                statuses = {'pending': 'قيد الانتظار', 'completed': 'مكتمل', 'rejected': 'مرفوض'}
                return statuses.get(s, s)

            for item in combined:
                date_str = str(item.get('date') or '')[:19]
                writer.writerow([date_str, translate_type(item.get('type')), translate_status(item.get('status')),
                                 item.get('amount'), item.get('currency_code'), item.get('network_name'),
                                 item.get('total_amount'), item.get('note') or ''])

            return Response(output.getvalue(), mimetype='text/csv; charset=utf-8', headers={"Content-Disposition": "attachment;filename=wallet_transactions.csv"})

        except Exception as e:
            print(f"Export CSV error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/withdrawals', methods=['GET'])
    @ctx.admin_required
    def admin_get_withdrawals():
        try:
            status = str(request.args.get('status', 'pending') or 'pending').strip().lower()
            conn = ctx.get_db_connection()

            query = """
                SELECT
                    w.*,
                    u.name as user_name,
                    u.email as user_email,
                    c.code as currency_code,
                    c.symbol as currency_symbol,
                    n.name as network_name
                FROM withdrawal_requests w
                JOIN users u ON w.user_id = u.id
                JOIN currencies c ON w.currency_id = c.id
                JOIN networks n ON w.network_id = n.id
            """
            params = []
            if status != 'all':
                query += ' WHERE w.status = ?'
                params.append(status)

            query += ' ORDER BY w.created_at DESC'
            withdrawals = conn.execute(query, params).fetchall()

            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'withdrawals': [dict(w) for w in withdrawals],
                    'total': len(withdrawals)
                }
            }), 200

        except Exception as e:
            print(f"Admin withdrawals error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/withdrawals/<int:withdrawal_id>/process', methods=['POST'])
    @ctx.admin_required
    def admin_process_withdrawal(withdrawal_id):
        try:
            data = request.get_json(silent=True) or {}
            action = data.get('action')
            note = data.get('note', '')

            if action not in ['approve', 'reject']:
                return jsonify({'error': 'Invalid action', 'code': 'INVALID_ACTION'}), 400

            conn = ctx.get_db_connection()
            withdrawal = conn.execute('SELECT * FROM withdrawal_requests WHERE id = ?', (withdrawal_id,)).fetchone()
            if not withdrawal:
                conn.close()
                return jsonify({'error': 'Withdrawal not found', 'code': 'WITHDRAWAL_NOT_FOUND'}), 404
            if withdrawal['status'] != 'pending':
                conn.close()
                return jsonify({'error': 'Withdrawal already processed', 'code': 'ALREADY_PROCESSED'}), 400

            cursor = conn.cursor()
            if action == 'approve':
                cursor.execute("""
                    UPDATE withdrawal_requests
                    SET status = 'completed', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                """, (note, withdrawal_id))
                cursor.execute("""
                    UPDATE user_wallets
                    SET pending_balance = pending_balance - ?
                    WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
                """, (
                    withdrawal['amount'] + withdrawal['fee'],
                    withdrawal['user_id'],
                    withdrawal['currency_id'],
                    withdrawal['amount'] + withdrawal['fee']
                ))
                if cursor.rowcount == 0:
                    conn.rollback()
                    conn.close()
                    return jsonify({'error': 'Pending balance mismatch', 'code': 'PENDING_BALANCE_MISMATCH'}), 409
                message = 'تمت الموافقة على طلب السحب'
            else:
                cursor.execute("""
                    UPDATE withdrawal_requests
                    SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                """, (note, withdrawal_id))
                cursor.execute("""
                    UPDATE user_wallets
                    SET balance = balance + ?, pending_balance = pending_balance - ?
                    WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
                """, (
                    withdrawal['amount'] + withdrawal['fee'],
                    withdrawal['amount'] + withdrawal['fee'],
                    withdrawal['user_id'],
                    withdrawal['currency_id'],
                    withdrawal['amount'] + withdrawal['fee']
                ))
                if cursor.rowcount == 0:
                    conn.rollback()
                    conn.close()
                    return jsonify({'error': 'Pending balance mismatch', 'code': 'PENDING_BALANCE_MISMATCH'}), 409
                message = 'تم رفض طلب السحب وإرجاع المبلغ'

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': message}), 200

        except Exception as e:
            print(f"Process withdrawal error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/withdrawals/<int:withdrawal_id>/approve', methods=['POST'])
    @ctx.admin_required
    def admin_approve_withdrawal(withdrawal_id):
        try:
            data = request.get_json(silent=True) or {}
            note = data.get('note', '')
            conn = ctx.get_db_connection()
            withdrawal = conn.execute('SELECT * FROM withdrawal_requests WHERE id = ?', (withdrawal_id,)).fetchone()
            if not withdrawal:
                conn.close()
                return jsonify({'error': 'Withdrawal not found', 'code': 'WITHDRAWAL_NOT_FOUND'}), 404
            if withdrawal['status'] != 'pending':
                conn.close()
                return jsonify({'error': 'Withdrawal already processed', 'code': 'ALREADY_PROCESSED'}), 400

            cursor = conn.cursor()
            cursor.execute("""
                UPDATE withdrawal_requests
                SET status = 'completed', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                WHERE id = ?
            """, (note, withdrawal_id))
            cursor.execute("""
                UPDATE user_wallets
                SET pending_balance = pending_balance - ?
                WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
            """, (
                withdrawal['amount'] + withdrawal['fee'],
                withdrawal['user_id'],
                withdrawal['currency_id'],
                withdrawal['amount'] + withdrawal['fee']
            ))
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Pending balance mismatch', 'code': 'PENDING_BALANCE_MISMATCH'}), 409

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': 'تمت الموافقة على طلب السحب'}), 200

        except Exception as e:
            print(f"Approve withdrawal error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/withdrawals/<int:withdrawal_id>/reject', methods=['POST'])
    @ctx.admin_required
    def admin_reject_withdrawal(withdrawal_id):
        try:
            data = request.get_json(silent=True) or {}
            note = data.get('note', '')
            conn = ctx.get_db_connection()
            withdrawal = conn.execute('SELECT * FROM withdrawal_requests WHERE id = ?', (withdrawal_id,)).fetchone()
            if not withdrawal:
                conn.close()
                return jsonify({'error': 'Withdrawal not found', 'code': 'WITHDRAWAL_NOT_FOUND'}), 404
            if withdrawal['status'] != 'pending':
                conn.close()
                return jsonify({'error': 'Withdrawal already processed', 'code': 'ALREADY_PROCESSED'}), 400

            cursor = conn.cursor()
            cursor.execute("""
                UPDATE withdrawal_requests
                SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                WHERE id = ?
            """, (note, withdrawal_id))
            cursor.execute("""
                UPDATE user_wallets
                SET balance = balance + ?, pending_balance = pending_balance - ?
                WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
            """, (
                withdrawal['amount'] + withdrawal['fee'],
                withdrawal['amount'] + withdrawal['fee'],
                withdrawal['user_id'],
                withdrawal['currency_id'],
                withdrawal['amount'] + withdrawal['fee']
            ))
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Pending balance mismatch', 'code': 'PENDING_BALANCE_MISMATCH'}), 409

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': 'تم رفض طلب السحب وإرجاع المبلغ'}), 200

        except Exception as e:
            print(f"Reject withdrawal error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/deposits', methods=['GET'])
    @ctx.admin_required
    def admin_get_deposits():
        try:
            status = str(request.args.get('status', 'completed') or 'completed').strip().lower()
            conn = ctx.get_db_connection()

            query = """
                SELECT
                    t.*,
                    u.name as user_name,
                    u.email as user_email,
                    c.code as currency_code,
                    c.symbol as currency_symbol,
                    n.name as network_name
                FROM transactions t
                JOIN users u ON t.user_id = u.id
                JOIN currencies c ON t.currency_id = c.id
                JOIN networks n ON t.network_id = n.id
                WHERE t.type = 'deposit'
            """
            params = []

            if status != 'all':
                query += ' AND t.status = ?'
                params.append(status)

            query += ' ORDER BY t.created_at DESC'
            deposits = conn.execute(query, params).fetchall()

            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'deposits': [dict(d) for d in deposits],
                    'total': len(deposits)
                }
            }), 200

        except Exception as e:
            print(f"Admin deposits error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/deposits/<int:deposit_id>/verify', methods=['POST'])
    @ctx.admin_required
    def admin_verify_deposit(deposit_id):
        try:
            data = request.get_json()
            action = data.get('action')
            note = data.get('note', '')

            if action not in ['confirm', 'reject']:
                return jsonify({'error': 'Invalid action', 'code': 'INVALID_ACTION'}), 400

            conn = ctx.get_db_connection()
            deposit = conn.execute("""
                SELECT * FROM transactions WHERE id = ? AND type = 'deposit'
            """, (deposit_id,)).fetchone()

            if not deposit:
                conn.close()
                return jsonify({'error': 'Deposit not found', 'code': 'DEPOSIT_NOT_FOUND'}), 404
            if deposit['status'] != 'pending':
                conn.close()
                return jsonify({'error': 'Deposit already processed', 'code': 'ALREADY_PROCESSED'}), 400

            cursor = conn.cursor()
            if action == 'confirm':
                cursor.execute("""
                    UPDATE transactions
                    SET status = 'completed', verified_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                """, (note, deposit_id))
                cursor.execute("""
                    INSERT INTO user_wallets (
                        user_id, currency_id, address, balance, pending_balance, created_at, updated_at
                    ) VALUES (?, ?, NULL, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, currency_id) DO UPDATE SET
                        balance = COALESCE(user_wallets.balance, 0) + excluded.balance,
                        updated_at = CURRENT_TIMESTAMP
                """, (deposit['user_id'], deposit['currency_id'], deposit['amount']))
                cursor.execute("""
                    UPDATE admin_wallets
                    SET current_balance = current_balance + ?,
                        total_received = total_received + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE currency_id = ?
                      AND network_id = ?
                      AND address = ?
                      AND is_active = 1
                """, (
                    deposit['amount'],
                    deposit['amount'],
                    deposit['currency_id'],
                    deposit['network_id'],
                    deposit['admin_wallet_address']
                ))
                if cursor.rowcount == 0:
                    cursor.execute("""
                        UPDATE admin_wallets
                        SET current_balance = current_balance + ?,
                            total_received = total_received + ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = (
                            SELECT id
                            FROM admin_wallets
                            WHERE currency_id = ?
                              AND network_id = ?
                              AND is_active = 1
                            ORDER BY id ASC
                            LIMIT 1
                        )
                    """, (
                        deposit['amount'],
                        deposit['amount'],
                        deposit['currency_id'],
                        deposit['network_id']
                    ))
                message = 'تم تأكيد الإيداع بنجاح'
            else:
                cursor.execute("""
                    UPDATE transactions
                    SET status = 'rejected', verified_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                """, (note, deposit_id))
                message = 'تم رفض الإيداع'

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': message}), 200

        except Exception as e:
            print(f"Verify deposit error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
'''

with codecs.open('routes/transactions.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '@app.route(\'/api/transactions/withdraw/request-code' in l:
        break
        
final_lines = lines[:i]
with codecs.open('routes/transactions.py', 'w', encoding='utf-8') as f:
    f.writelines(final_lines)
    f.write(rest_of_file)
