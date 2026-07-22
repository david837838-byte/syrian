from datetime import datetime, timezone

from flask import jsonify, request

from blockchain_service import (
    BlockchainConfigurationError,
    BlockchainProvisioningError,
    fetch_tatum_transaction_metadata,
    match_tatum_transaction_transfer,
)


def register_transaction_routes(app, ctx):
    def is_setting_enabled(conn, key, default=True):
        row = conn.execute(
            'SELECT value FROM system_settings WHERE key = ?',
            (key,)
        ).fetchone()
        if not row:
            return default
        return str(row['value']).lower() == 'true'

    def get_setting_value(conn, key, default=None):
        row = conn.execute(
            'SELECT value, data_type FROM system_settings WHERE key = ?',
            (key,)
        ).fetchone()
        if not row:
            return default

        value = row['value']
        data_type = row['data_type'] if 'data_type' in row.keys() else None
        if data_type == 'boolean':
            return str(value).lower() == 'true'
        if data_type == 'number':
            try:
                return float(value) if '.' in str(value) else int(value)
            except (TypeError, ValueError):
                return default
        return value if value not in (None, '') else default

    def format_hours_value(hours_value):
        try:
            numeric_value = float(hours_value)
        except (TypeError, ValueError):
            return str(hours_value)

        if numeric_value.is_integer():
            return str(int(numeric_value))
        return f'{numeric_value:.2f}'.rstrip('0').rstrip('.')

    def validate_recent_deposit_tx_hash(conn, currency_code, network_code, tx_hash, expected_address, expected_amount):
        provider_name = str(
            get_setting_value(conn, 'deposit_verification_provider', 'tatum') or 'tatum'
        ).strip().lower()
        provider_api_key = str(
            get_setting_value(conn, 'real_wallet_provider_api_key', '') or ''
        ).strip()
        provider_base_url = str(
            get_setting_value(conn, 'real_wallet_provider_base_url', 'https://api.tatum.io')
            or 'https://api.tatum.io'
        ).strip()
        eth_testnet_type = str(
            get_setting_value(conn, 'real_wallet_eth_testnet_type', 'ethereum-sepolia')
            or 'ethereum-sepolia'
        ).strip()
        max_age_hours = get_setting_value(conn, 'deposit_tx_max_age_hours', 24)

        try:
            max_age_hours = float(max_age_hours)
        except (TypeError, ValueError):
            max_age_hours = 24.0

        if provider_name != 'tatum':
            return ({
                'error': f'Unsupported deposit verification provider: {provider_name}',
                'code': 'DEPOSIT_VERIFICATION_PROVIDER_UNSUPPORTED'
            }, 400), None

        try:
            tx_metadata = fetch_tatum_transaction_metadata(
                provider_api_key,
                provider_base_url,
                network_code,
                tx_hash,
                eth_testnet_type=eth_testnet_type,
            )
        except BlockchainConfigurationError as exc:
            return ({
                'error': f'Deposit verification is not configured yet: {exc}',
                'code': 'DEPOSIT_VERIFICATION_NOT_CONFIGURED'
            }, 400), None
        except BlockchainProvisioningError as exc:
            return ({
                'error': f'Unable to verify this TX hash right now: {exc}',
                'code': 'DEPOSIT_VERIFICATION_UNAVAILABLE'
            }, 502), None

        if tx_metadata.get('confirmed') is not True:
            return ({
                'error': 'The TX hash is not confirmed on-chain yet',
                'code': 'TX_NOT_CONFIRMED'
            }, 400), None

        tx_timestamp = tx_metadata.get('timestamp')
        if not tx_timestamp:
            return ({
                'error': 'The blockchain provider did not return a usable timestamp for this TX hash',
                'code': 'TX_TIMESTAMP_UNAVAILABLE'
            }, 400), None

        now_utc = datetime.now(timezone.utc)
        age_seconds = (now_utc - tx_timestamp).total_seconds()

        if age_seconds < -300:
            return ({
                'error': 'The TX hash timestamp appears to be in the future',
                'code': 'TX_TIMESTAMP_INVALID'
            }, 400), None

        if max_age_hours > 0 and age_seconds > (max_age_hours * 3600):
            return ({
                'error': f'This TX hash is too old. Maximum allowed age is {format_hours_value(max_age_hours)} hours',
                'code': 'TX_TOO_OLD',
                'details': {
                    'currency': str(currency_code or '').upper(),
                    'network': str(network_code or '').upper(),
                    'max_age_hours': max_age_hours,
                    'tx_timestamp': tx_timestamp.isoformat()
                }
            }, 400), None

        try:
            transfer_match = match_tatum_transaction_transfer(
                tx_metadata.get('raw') or {},
                currency_code,
                network_code,
                expected_address,
                expected_amount,
            )
        except BlockchainConfigurationError as exc:
            return ({
                'error': f'Deposit transaction validation is not fully configured: {exc}',
                'code': 'DEPOSIT_VALIDATION_CONFIG_ERROR'
            }, 400), None

        if not transfer_match.get('address_matched'):
            return ({
                'error': 'This TX hash does not send funds to the configured receiving wallet',
                'code': 'TX_RECIPIENT_MISMATCH',
                'details': {
                    'currency': str(currency_code or '').upper(),
                    'network': str(network_code or '').upper(),
                    'expected_address': expected_address,
                }
            }, 400), None

        if not transfer_match.get('amount_matched'):
            return ({
                'error': 'The TX hash amount does not match the deposit amount you entered',
                'code': 'TX_AMOUNT_MISMATCH',
                'details': {
                    'currency': str(currency_code or '').upper(),
                    'network': str(network_code or '').upper(),
                    'expected_amount': expected_amount,
                    'detected_amount': transfer_match.get('detected_amount'),
                    'expected_address': expected_address,
                }
            }, 400), None

        return None, tx_metadata

    def get_network_candidates(currency_code, network_code):
        normalized_currency = str(currency_code or '').upper().strip()
        normalized_network = str(network_code or '').upper().strip()

        aliases = {
            ('ETH', 'ERC20'): ['ETH', 'ERC20'],
            ('ETH', 'ETH'): ['ETH', 'ERC20'],
            ('BNB', 'BEP20'): ['BSC', 'BEP20'],
            ('BNB', 'BSC'): ['BSC', 'BEP20'],
        }

        return aliases.get((normalized_currency, normalized_network), [normalized_network])

    def resolve_currency_network(conn, currency_id, currency_code, network_code):
        for candidate in get_network_candidates(currency_code, network_code):
            network = conn.execute('''
                SELECT id, code, name
                FROM networks
                WHERE currency_id = ? AND UPPER(code) = ? AND is_active = 1
                ORDER BY id
                LIMIT 1
            ''', (currency_id, str(candidate).upper())).fetchone()
            if network:
                return network
        return None

    def load_withdrawal_context(conn, user_id, currency_code, network_code, amount):
        currency = conn.execute('SELECT id FROM currencies WHERE code = ? AND is_active = 1', (currency_code,)).fetchone()
        if not currency:
            return None, None, None, None, None, ({'error': f'Currency {currency_code} not found', 'code': 'INVALID_CURRENCY'}, 400)

        currency_id = currency['id']
        network = resolve_currency_network(conn, currency_id, currency_code, network_code)
        if not network:
            return None, None, None, None, None, ({'error': f'Network {network_code} not found', 'code': 'INVALID_NETWORK'}, 400)

        network_id = network['id']
        currency_full = conn.execute('''
            SELECT c.*, n.fee_percentage, n.fee_fixed, n.min_amount
            FROM currencies c
            JOIN networks n ON n.currency_id = c.id
            WHERE c.id = ? AND n.id = ? AND c.is_active = 1 AND n.is_active = 1
        ''', (currency_id, network_id)).fetchone()

        if not currency_full:
            return None, None, None, None, None, ({'error': 'Invalid currency or network', 'code': 'INVALID_CURRENCY_NETWORK'}, 400)

        fee = (amount * currency_full['fee_percentage'] / 100) + currency_full['fee_fixed']
        total_amount = amount + fee

        if amount < currency_full['min_withdraw']:
            return None, None, None, None, None, ({
                'error': f'Minimum withdrawal is {currency_full["min_withdraw"]} {currency_full["code"]}',
                'code': 'MIN_WITHDRAW'
            }, 400)

        wallet = conn.execute('''
            SELECT balance FROM user_wallets
            WHERE user_id = ? AND currency_id = ?
        ''', (user_id, currency_id)).fetchone()

        if not wallet or wallet['balance'] < total_amount:
            return None, None, None, None, None, ({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}, 400)

        return currency_id, network_id, currency_full, fee, total_amount, None

    @app.route('/api/transactions/deposit', methods=['POST'])
    @ctx.jwt_required()
    def deposit():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}

            required_fields = ['currency', 'network', 'amount']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                amount = ctx.parse_positive_float(data['amount'], 'amount')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_AMOUNT'}), 400

            currency_code = data['currency'].upper()
            network_code = data['network'].upper()
            conn = ctx.get_db_connection()

            if not is_setting_enabled(conn, 'deposit_enabled', True):
                conn.close()
                return jsonify({
                    'error': 'الإيداع متوقف حالياً من إعدادات المنصة',
                    'code': 'DEPOSIT_DISABLED'
                }), 403

            deposit_verification_mode = str(
                get_setting_value(conn, 'deposit_verification_mode', 'simulated') or 'simulated'
            ).strip().lower()

            currency = conn.execute('SELECT id FROM currencies WHERE code = ? AND is_active = 1', (currency_code,)).fetchone()
            if not currency:
                conn.close()
                return jsonify({'error': f'Currency {currency_code} not found', 'code': 'INVALID_CURRENCY'}), 400

            currency_id = currency['id']
            network = resolve_currency_network(conn, currency_id, currency_code, network_code)
            if not network:
                conn.close()
                return jsonify({'error': f'Network {network_code} not found', 'code': 'INVALID_NETWORK'}), 400

            network_id = network['id']
            currency_full = conn.execute('''
                SELECT c.*, n.fee_fixed, n.min_amount
                FROM currencies c
                JOIN networks n ON n.currency_id = c.id
                WHERE c.id = ? AND n.id = ? AND c.is_active = 1 AND n.is_active = 1
            ''', (currency_id, network_id)).fetchone()

            if not currency_full:
                conn.close()
                return jsonify({'error': 'Invalid currency or network', 'code': 'INVALID_CURRENCY_NETWORK'}), 400

            if amount < currency_full['min_deposit']:
                conn.close()
                return jsonify({
                    'error': f'Minimum deposit is {currency_full["min_deposit"]} {currency_full["code"]}',
                    'code': 'MIN_DEPOSIT'
                }), 400

            admin_wallet = conn.execute('''
                SELECT * FROM admin_wallets
                WHERE currency_id = ? AND network_id = ? AND is_active = 1
                LIMIT 1
            ''', (currency_id, network_id)).fetchone()

            if not admin_wallet:
                conn.close()
                return jsonify({
                    'error': f'محفظة استقبال {currency_code} على شبكة {network_code} غير متوفرة حالياً. يرجى الاتصال بفريق الدعم.',
                    'code': 'RECEIVING_WALLET_NOT_CONFIGURED',
                    'details': {
                        'currency': currency_code,
                        'network': network_code,
                        'message': 'يجب على مدير النظام إضافة محفظة استقبال في الإعدادات'
                    }
                }), 400

            tx_hash = str(data.get('tx_hash') or '').strip()
            if deposit_verification_mode == 'onchain' and not tx_hash:
                conn.close()
                return jsonify({'error': 'TX Hash is required when on-chain verification is enabled', 'code': 'TX_HASH_REQUIRED'}), 400

            if tx_hash:
                existing_tx = conn.execute('''
                    SELECT id FROM transactions
                    WHERE type = 'deposit' AND LOWER(COALESCE(tx_hash, '')) = LOWER(?)
                ''', (tx_hash,)).fetchone()
                if existing_tx:
                    conn.close()
                    return jsonify({'error': 'Transaction hash already submitted', 'code': 'DUPLICATE_TX_HASH'}), 409

            if deposit_verification_mode == 'onchain':
                validation_error, _tx_metadata = validate_recent_deposit_tx_hash(
                    conn,
                    currency_code,
                    network_code,
                    tx_hash,
                    admin_wallet['address'],
                    amount,
                )
                if validation_error:
                    conn.close()
                    payload, status_code = validation_error
                    return jsonify(payload), status_code

            cursor = conn.cursor()
            deposit_status = 'completed'
            cursor.execute('''
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'deposit', ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                currency_id,
                network_id,
                amount,
                tx_hash or None,
                admin_wallet['address'],
                deposit_status,
                data.get('note', ''),
                datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            ))

            transaction_id = cursor.lastrowid

            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            ''', (amount, user_id, currency_id))

            cursor.execute('''
                UPDATE admin_wallets
                SET current_balance = current_balance + ?,
                    total_received = total_received + ?
                WHERE id = ?
            ''', (amount, amount, admin_wallet['id']))

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تأكيد الإيداع فورياً وإضافة الرصيد إلى محفظتك'
                    if deposit_verification_mode == 'onchain'
                    else 'تم الإيداع فورياً بنجاح',
                'data': {
                    'transaction_id': transaction_id,
                    'status': deposit_status,
                    'admin_wallet': admin_wallet['address'],
                    'amount': amount,
                    'verified_on_chain': deposit_verification_mode == 'onchain'
                }
            }), 201

        except Exception as e:
            print(f"Deposit error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

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
                html_body=f'''
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
                '''
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

            code_row = conn.execute('''
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
            ''', (user_id, currency_id, network_id, amount, wallet_address, verification_code)).fetchone()

            if not code_row:
                conn.close()
                return jsonify({
                    'error': 'Invalid or expired withdrawal verification code',
                    'code': 'INVALID_WITHDRAW_VERIFICATION_CODE'
                }), 400

            cursor = conn.cursor()
            cursor.execute('UPDATE withdrawal_verification_codes SET used = 1 WHERE id = ?', (code_row['id'],))
            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance - ?, pending_balance = pending_balance + ?
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            ''', (total_amount, total_amount, user_id, currency_id, total_amount))

            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor.execute('''
                INSERT INTO withdrawal_requests (
                    user_id, currency_id, network_id, amount, fee,
                    wallet_address, status, admin_note
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            ''', (
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
            network = conn.execute(f'''
                SELECT id, code
                FROM networks
                WHERE currency_id = ? AND is_active = 1 AND UPPER(code) IN ({placeholders})
                ORDER BY id ASC
                LIMIT 1
            ''', params).fetchone()

            if not network:
                conn.close()
                return jsonify({'error': f'Network {network_code} not found', 'code': 'INVALID_NETWORK'}), 400

            sender_wallet = conn.execute('''
                SELECT balance
                FROM user_wallets
                WHERE user_id = ? AND currency_id = ?
            ''', (user_id, currency['id'])).fetchone()

            if not sender_wallet or float(sender_wallet['balance']) < amount:
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            ''', (amount, user_id, currency['id'], amount))

            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            ''', (amount, recipient['id'], currency['id']))

            if cursor.rowcount == 0:
                cursor.execute('''
                    INSERT INTO user_wallets (user_id, currency_id, address, balance)
                    VALUES (?, ?, ?, ?)
                ''', (recipient['id'], currency['id'], None, amount))

            sender_note = f'تحويل داخلي إلى الحساب {recipient["public_user_id"]}'
            recipient_note = f'تحويل داخلي من الحساب {sender["public_user_id"]}'
            if note:
                sender_note = f'{sender_note} - {note}'
                recipient_note = f'{recipient_note} - {note}'

            cursor.execute('''
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'internal_transfer_sent', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
            ''', (user_id, currency['id'], network['id'], amount, sender_note))

            cursor.execute('''
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount,
                    tx_hash, admin_wallet_address, status, note, verified_at
                ) VALUES (?, 'internal_transfer_received', ?, ?, ?, NULL, NULL, 'completed', ?, CURRENT_TIMESTAMP)
            ''', (recipient['id'], currency['id'], network['id'], amount, recipient_note))

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

            transactions = conn.execute('''
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
            ''', (user_id,)).fetchall()

            withdrawals = conn.execute('''
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
            ''', (user_id,)).fetchall()

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

    @app.route('/api/admin/withdrawals', methods=['GET'])
    @ctx.admin_required
    def admin_get_withdrawals():
        try:
            status = str(request.args.get('status', 'pending') or 'pending').strip().lower()
            conn = ctx.get_db_connection()

            query = '''
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
            '''
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
                cursor.execute('''
                    UPDATE withdrawal_requests
                    SET status = 'completed', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                ''', (note, withdrawal_id))
                cursor.execute('''
                    UPDATE user_wallets
                    SET pending_balance = pending_balance - ?
                    WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
                ''', (
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
                cursor.execute('''
                    UPDATE withdrawal_requests
                    SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                ''', (note, withdrawal_id))
                cursor.execute('''
                    UPDATE user_wallets
                    SET balance = balance + ?, pending_balance = pending_balance - ?
                    WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
                ''', (
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
            cursor.execute('''
                UPDATE withdrawal_requests
                SET status = 'completed', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                WHERE id = ?
            ''', (note, withdrawal_id))
            cursor.execute('''
                UPDATE user_wallets
                SET pending_balance = pending_balance - ?
                WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
            ''', (
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
            cursor.execute('''
                UPDATE withdrawal_requests
                SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_note = ?
                WHERE id = ?
            ''', (note, withdrawal_id))
            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance + ?, pending_balance = pending_balance - ?
                WHERE user_id = ? AND currency_id = ? AND pending_balance >= ?
            ''', (
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

            query = '''
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
            '''
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
            deposit = conn.execute('''
                SELECT * FROM transactions WHERE id = ? AND type = 'deposit'
            ''', (deposit_id,)).fetchone()

            if not deposit:
                conn.close()
                return jsonify({'error': 'Deposit not found', 'code': 'DEPOSIT_NOT_FOUND'}), 404
            if deposit['status'] != 'pending':
                conn.close()
                return jsonify({'error': 'Deposit already processed', 'code': 'ALREADY_PROCESSED'}), 400

            cursor = conn.cursor()
            if action == 'confirm':
                cursor.execute('''
                    UPDATE transactions
                    SET status = 'completed', verified_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                ''', (note, deposit_id))
                cursor.execute('''
                    INSERT INTO user_wallets (
                        user_id, currency_id, address, balance, pending_balance, created_at, updated_at
                    ) VALUES (?, ?, NULL, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, currency_id) DO UPDATE SET
                        balance = COALESCE(user_wallets.balance, 0) + excluded.balance,
                        updated_at = CURRENT_TIMESTAMP
                ''', (deposit['user_id'], deposit['currency_id'], deposit['amount']))
                cursor.execute('''
                    UPDATE admin_wallets
                    SET current_balance = current_balance + ?,
                        total_received = total_received + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE currency_id = ?
                      AND network_id = ?
                      AND address = ?
                      AND is_active = 1
                ''', (
                    deposit['amount'],
                    deposit['amount'],
                    deposit['currency_id'],
                    deposit['network_id'],
                    deposit['admin_wallet_address']
                ))
                if cursor.rowcount == 0:
                    cursor.execute('''
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
                    ''', (
                        deposit['amount'],
                        deposit['amount'],
                        deposit['currency_id'],
                        deposit['network_id']
                    ))
                message = 'تم تأكيد الإيداع بنجاح'
            else:
                cursor.execute('''
                    UPDATE transactions
                    SET status = 'rejected', verified_at = CURRENT_TIMESTAMP, admin_note = ?
                    WHERE id = ?
                ''', (note, deposit_id))
                message = 'تم رفض الإيداع'

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': message}), 200

        except Exception as e:
            print(f"Verify deposit error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
