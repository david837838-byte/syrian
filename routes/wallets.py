import os

from flask import jsonify, request

from blockchain_service import (
    BlockchainConfigurationError,
    BlockchainProvisioningError,
    generate_tatum_address_from_xpub,
)


def register_wallet_routes(app, ctx):
    FINANCIAL_CHANNEL_TYPES = {
        'crypto': 'قناة كريبتو',
        'bank': 'حساب بنكي',
        'paypal': 'PayPal',
        'wish_money': 'Wish Money',
        'manual': 'قناة يدوية'
    }

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

    def parse_public_user_ids(raw_value):
        if isinstance(raw_value, list):
            values = raw_value
        else:
            values = str(raw_value or '').replace('\n', ',').split(',')
        return sorted({str(value).strip() for value in values if str(value).strip()})

    def resolve_access_users(conn, public_user_ids):
        if not public_user_ids:
            return []

        placeholders = ', '.join(['?'] * len(public_user_ids))
        users = conn.execute(f'''
            SELECT id, public_user_id, name
            FROM users
            WHERE role = 'user' AND public_user_id IN ({placeholders})
            ORDER BY public_user_id
        ''', public_user_ids).fetchall()

        found_ids = {str(user['public_user_id']) for user in users}
        missing = [public_id for public_id in public_user_ids if public_id not in found_ids]
        if missing:
            raise ValueError(f'Unknown public user IDs: {", ".join(missing)}')

        return users

    def normalize_country_code(value):
        return str(value or '').strip().upper()[:8]

    def normalize_channel_type(value):
        normalized = str(value or 'crypto').strip().lower()
        return normalized if normalized in FINANCIAL_CHANNEL_TYPES else 'manual'

    def get_setting_value(conn, key, fallback=''):
        row = conn.execute(
            'SELECT value, data_type FROM system_settings WHERE key = ?',
            (key,)
        ).fetchone()
        if not row:
            return fallback

        value = row['value']
        data_type = row['data_type']
        if data_type == 'boolean':
            return str(value).lower() == 'true'
        if data_type == 'number':
            try:
                return float(value) if '.' in str(value) else int(value)
            except (TypeError, ValueError):
                return fallback
        return value if value not in (None, '') else fallback

    def is_real_money_enabled(conn):
        return bool(get_setting_value(conn, 'real_money_enabled', True))

    def is_real_wallets_section_enabled(conn):
        return bool(get_setting_value(conn, 'real_wallets_section_enabled', True))

    def get_real_wallet_provider_xpub(settings, network_code):
        normalized_network = str(network_code or '').upper().strip()
        if normalized_network == 'TRC20':
            return str(settings.get('xpub_tron') or '').strip()
        if normalized_network in ('ERC20', 'ETH'):
            return str(settings.get('xpub_ethereum') or '').strip()
        if normalized_network in ('BEP20', 'BSC'):
            return str(settings.get('xpub_bsc') or '').strip()
        if normalized_network == 'BTC':
            return str(settings.get('xpub_bitcoin') or '').strip()
        return ''

    def get_real_wallet_generation_settings(conn):
        return {
            'mode': str(get_setting_value(conn, 'real_wallet_generation_mode', 'manual_pool') or 'manual_pool').strip().lower(),
            'provider': str(get_setting_value(conn, 'real_wallet_blockchain_provider', 'tatum') or 'tatum').strip().lower(),
            'api_key': str(
                os.environ.get('TATUM_API_KEY')
                or get_setting_value(conn, 'real_wallet_provider_api_key', '')
                or ''
            ).strip(),
            'base_url': str(
                os.environ.get('TATUM_BASE_URL')
                or get_setting_value(conn, 'real_wallet_provider_base_url', 'https://api.tatum.io')
                or 'https://api.tatum.io'
            ).strip(),
            'eth_testnet_type': str(
                os.environ.get('TATUM_ETH_TESTNET_TYPE')
                or get_setting_value(conn, 'real_wallet_eth_testnet_type', 'ethereum-sepolia')
                or 'ethereum-sepolia'
            ).strip(),
            'xpub_tron': str(os.environ.get('REAL_WALLET_XPUB_TRON') or get_setting_value(conn, 'real_wallet_xpub_tron', '') or '').strip(),
            'xpub_ethereum': str(os.environ.get('REAL_WALLET_XPUB_ETHEREUM') or get_setting_value(conn, 'real_wallet_xpub_ethereum', '') or '').strip(),
            'xpub_bsc': str(os.environ.get('REAL_WALLET_XPUB_BSC') or get_setting_value(conn, 'real_wallet_xpub_bsc', '') or '').strip(),
            'xpub_bitcoin': str(os.environ.get('REAL_WALLET_XPUB_BITCOIN') or get_setting_value(conn, 'real_wallet_xpub_bitcoin', '') or '').strip(),
        }

    def get_company_wallet_setup_fee(conn):
        return {
            'value': round(max(0.0, float(get_setting_value(conn, 'company_wallet_setup_fee_amount', 15) or 0)), 8),
            'currency': str(get_setting_value(conn, 'company_wallet_setup_fee_currency', 'USDT') or 'USDT').strip().upper(),
            'network': str(get_setting_value(conn, 'company_wallet_setup_fee_network', 'TRC20') or 'TRC20').strip().upper()
        }

    def charge_company_wallet_setup_fee_if_needed(conn, user_id, wallet_label='company wallet'):
        company_row = conn.execute('''
            SELECT
                u.id,
                u.account_type,
                cp.id as company_profile_id,
                COALESCE(cp.wallet_setup_fee_paid, 0) as wallet_setup_fee_paid
            FROM users u
            LEFT JOIN company_profiles cp ON cp.user_id = u.id
            WHERE u.id = ?
        ''', (user_id,)).fetchone()

        if not company_row or str(company_row['account_type'] or '').strip().lower() != 'company':
            return {'applied': False, 'charged': False, 'fee': None, 'transaction_id': None}

        if not company_row['company_profile_id']:
            raise ValueError('COMPANY_PROFILE_REQUIRED')

        if bool(company_row['wallet_setup_fee_paid']):
            return {'applied': False, 'charged': False, 'fee': None, 'transaction_id': None}

        fee = get_company_wallet_setup_fee(conn)
        fee_value = float(fee['value'] or 0)

        if fee_value <= 0:
            conn.execute('''
                UPDATE company_profiles
                SET wallet_setup_fee_paid = 1,
                    wallet_setup_fee_paid_at = CURRENT_TIMESTAMP,
                    wallet_setup_fee_transaction_id = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            ''', (user_id,))
            return {'applied': True, 'charged': False, 'fee': fee, 'transaction_id': None}

        currency = conn.execute(
            'SELECT id, code FROM currencies WHERE code = ? AND is_active = 1',
            (fee['currency'],)
        ).fetchone()
        if not currency:
            raise RuntimeError('COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED')

        network = conn.execute(
            'SELECT id, code FROM networks WHERE currency_id = ? AND code = ? AND is_active = 1',
            (currency['id'], fee['network'])
        ).fetchone()
        if not network:
            raise RuntimeError('COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED')

        admin_wallet = conn.execute('''
            SELECT id, address
            FROM admin_wallets
            WHERE currency_id = ? AND network_id = ? AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
        ''', (currency['id'], network['id'])).fetchone()
        if not admin_wallet:
            raise LookupError('COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED')

        wallet = conn.execute('''
            SELECT balance
            FROM user_wallets
            WHERE user_id = ? AND currency_id = ?
        ''', (user_id, currency['id'])).fetchone()
        if not wallet or float(wallet['balance'] or 0) < fee_value:
            raise PermissionError(f'Insufficient balance to pay company wallet setup fee of {fee_value:.8f} {fee["currency"]}')

        cursor = conn.cursor()
        cursor.execute('''
            UPDATE user_wallets
            SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = ? AND balance >= ?
        ''', (fee_value, user_id, currency['id'], fee_value))
        if cursor.rowcount == 0:
            raise PermissionError('Insufficient balance')

        cursor.execute('''
            UPDATE admin_wallets
            SET current_balance = current_balance + ?,
                total_received = total_received + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (fee_value, fee_value, admin_wallet['id']))

        cursor.execute('''
            INSERT INTO transactions (
                user_id, type, currency_id, network_id, amount, tx_hash,
                admin_wallet_address, status, note, verified_at
            ) VALUES (?, 'company_wallet_setup_fee', ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
        ''', (
            user_id,
            currency['id'],
            network['id'],
            fee_value,
            f'company-wallet-fee-{wallet_label}-{os.urandom(6).hex()}',
            admin_wallet['address'],
            f'Company wallet setup fee for {wallet_label}'
        ))
        transaction_id = cursor.lastrowid

        cursor.execute('''
            UPDATE company_profiles
            SET wallet_setup_fee_paid = 1,
                wallet_setup_fee_paid_at = CURRENT_TIMESTAMP,
                wallet_setup_fee_transaction_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        ''', (transaction_id, user_id))

        return {'applied': True, 'charged': True, 'fee': fee, 'transaction_id': transaction_id}

    def get_next_real_wallet_index(conn, currency_id, network_id):
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO real_wallet_generation_counters (currency_id, network_id, next_index)
            VALUES (?, ?, 0)
        ''', (currency_id, network_id))
        row = conn.execute('''
            SELECT next_index
            FROM real_wallet_generation_counters
            WHERE currency_id = ? AND network_id = ?
        ''', (currency_id, network_id)).fetchone()
        next_index = int(row['next_index']) if row else 0
        cursor.execute('''
            UPDATE real_wallet_generation_counters
            SET next_index = ?, updated_at = CURRENT_TIMESTAMP
            WHERE currency_id = ? AND network_id = ?
        ''', (next_index + 1, currency_id, network_id))
        return next_index

    def serialize_financial_channel(row):
        item = dict(row)
        item['country_code'] = normalize_country_code(item.get('country_code'))
        item['channel_type'] = normalize_channel_type(item.get('channel_type'))
        item['channel_type_label'] = FINANCIAL_CHANNEL_TYPES.get(item['channel_type'], 'قناة مالية')
        item['effective_identifier'] = (
            item.get('linked_wallet_address')
            or item.get('account_identifier')
            or ''
        )
        item['effective_label'] = (
            item.get('account_label')
            or item.get('linked_wallet_label')
            or item.get('title')
            or ''
        )
        item['supports_copy'] = bool(item['effective_identifier'])
        return item

    def serialize_real_user_wallet(row):
        item = dict(row)
        item['is_active'] = bool(item.get('is_active', True))
        item['supports_copy'] = bool(str(item.get('address') or '').strip())
        item['status_label'] = 'نشطة' if item['is_active'] and str(item.get('status') or 'active') == 'active' else 'موقوفة'
        item['network_display'] = item.get('network_name') or item.get('network_code') or ''
        item['fee_percentage'] = float(item.get('fee_percentage') or 0)
        item['fee_fixed'] = float(item.get('fee_fixed') or 0)
        item['min_amount'] = float(item.get('min_amount') or 0)
        item['min_deposit'] = float(item.get('min_deposit') or 0)
        item['min_withdraw'] = float(item.get('min_withdraw') or 0)
        return item

    def serialize_real_pool_wallet(row):
        item = dict(row)
        item['is_active'] = bool(item.get('is_active', True))
        item['is_assigned'] = bool(item.get('assigned_user_id'))
        item['assigned_public_user_id'] = item.get('assigned_public_user_id') or ''
        item['assigned_user_name'] = item.get('assigned_user_name') or ''
        return item

    @app.route('/api/wallets/balance', methods=['GET'])
    @ctx.jwt_required()
    def get_wallets_balance():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            ctx.accrue_investment_profits(conn, user_id)
            conn.commit()

            wallets = conn.execute('''
                SELECT
                    w.id,
                    c.id as currency_id,
                    c.code,
                    c.name as currency_name,
                    c.symbol,
                    w.address,
                    w.balance,
                    w.pending_balance,
                    c.min_deposit,
                    c.min_withdraw
                FROM user_wallets w
                JOIN currencies c ON w.currency_id = c.id
                WHERE w.user_id = ? AND c.is_active = 1
                ORDER BY c.code
            ''', (user_id,)).fetchall()

            admin_wallets = conn.execute('''
                SELECT
                    a.id,
                    c.code,
                    c.name as currency_name,
                    c.symbol,
                    n.name as network_name,
                    n.code as network_code,
                    n.fee_percentage,
                    n.fee_fixed,
                    a.address,
                    a.label
                FROM admin_wallets a
                JOIN currencies c ON a.currency_id = c.id
                JOIN networks n ON a.network_id = n.id
                WHERE a.is_active = 1
                ORDER BY c.code, n.name
            ''').fetchall()

            special_wallets = []
            if is_real_money_enabled(conn) and is_real_wallets_section_enabled(conn):
                special_wallets = conn.execute('''
                    SELECT
                        p.id,
                        p.title,
                        p.description,
                        p.access_note,
                        p.is_active,
                        c.id as currency_id,
                        c.code,
                        c.name as currency_name,
                        c.symbol,
                        n.id as network_id,
                        n.name as network_name,
                        n.code as network_code,
                        a.id as admin_wallet_id,
                        a.address,
                        a.label as admin_wallet_label
                    FROM wallet_profiles p
                    JOIN wallet_profile_access pa ON pa.profile_id = p.id AND pa.user_id = ? AND pa.is_active = 1
                    JOIN currencies c ON p.currency_id = c.id
                    JOIN networks n ON p.network_id = n.id
                    LEFT JOIN admin_wallets a ON p.admin_wallet_id = a.id
                    WHERE p.is_active = 1
                    ORDER BY p.created_at DESC, p.id DESC
                ''', (user_id,)).fetchall()

            conn.close()

            wallets_list = [dict(w) for w in wallets]
            admin_wallets_list = [dict(a) for a in admin_wallets]
            special_wallets_list = [dict(p) for p in special_wallets]

            return jsonify({
                'success': True,
                'data': {
                    'user_wallets': wallets_list,
                    'admin_wallets': admin_wallets_list,
                    'special_wallets': special_wallets_list,
                    'total_balance': sum(w['balance'] for w in wallets_list)
                }
            }), 200

        except Exception as e:
            print(f"Wallets balance error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/wallets/financial-channels', methods=['GET'])
    @ctx.jwt_required()
    def get_financial_channels():
        try:
            user_id = int(ctx.get_jwt_identity())
            requested_country_code = normalize_country_code(request.args.get('country_code'))
            conn = ctx.get_db_connection()

            if not is_real_money_enabled(conn) or not bool(get_setting_value(conn, 'financial_channels_enabled', True)):
                conn.close()
                return jsonify({
                    'success': True,
                    'data': {
                        'channels': [],
                        'selected_country_code': requested_country_code or ''
                    }
                }), 200

            user = conn.execute('''
                SELECT preferred_country_code, detected_country_code
                FROM users
                WHERE id = ?
            ''', (user_id,)).fetchone()

            selected_country_code = requested_country_code or normalize_country_code(
                user['preferred_country_code'] if user and user['preferred_country_code'] else (
                    user['detected_country_code'] if user and user['detected_country_code'] else 'SY'
                )
            ) or 'SY'

            params = []
            country_filter = "TRIM(COALESCE(fc.country_code, '')) = ''"
            if selected_country_code:
                country_filter = f"({country_filter} OR UPPER(fc.country_code) = ?)"
                params.append(selected_country_code)

            rows = conn.execute(f'''
                SELECT
                    fc.id,
                    fc.channel_type,
                    fc.title,
                    fc.description,
                    fc.country_code,
                    fc.country_name,
                    fc.currency_id,
                    fc.network_id,
                    fc.admin_wallet_id,
                    fc.account_label,
                    fc.account_identifier,
                    fc.extra_details,
                    fc.instructions,
                    fc.is_active,
                    fc.display_order,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.code as network_code,
                    n.name as network_name,
                    a.address as linked_wallet_address,
                    a.label as linked_wallet_label
                FROM financial_channels fc
                LEFT JOIN currencies c ON fc.currency_id = c.id
                LEFT JOIN networks n ON fc.network_id = n.id
                LEFT JOIN admin_wallets a ON fc.admin_wallet_id = a.id
                WHERE fc.is_active = 1 AND {country_filter}
                ORDER BY fc.display_order ASC, fc.id DESC
            ''', params).fetchall()
            conn.close()

            channels = [serialize_financial_channel(row) for row in rows]
            return jsonify({
                'success': True,
                'data': {
                    'channels': channels,
                    'selected_country_code': selected_country_code
                }
            }), 200

        except Exception as e:
            print(f"Get financial channels error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/wallets/real-crypto', methods=['GET'])
    @ctx.jwt_required()
    def get_real_crypto_wallets():
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            if not is_real_money_enabled(conn) or not is_real_wallets_section_enabled(conn):
                conn.close()
                return jsonify({
                    'success': True,
                    'data': {
                        'wallets': []
                    }
                }), 200

            rows = conn.execute('''
                SELECT
                    rw.id,
                    rw.user_id,
                    rw.currency_id,
                    rw.network_id,
                    rw.pool_wallet_id,
                    rw.address,
                    rw.label,
                    rw.provider_name,
                    rw.status,
                    rw.assigned_at,
                    rw.last_synced_at,
                    rp.is_active,
                    c.code as currency_code,
                    c.name as currency_name,
                    c.symbol,
                    c.min_deposit,
                    c.min_withdraw,
                    n.code as network_code,
                    n.name as network_name,
                    n.fee_percentage,
                    n.fee_fixed,
                    n.min_amount
                FROM real_user_wallets rw
                JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
                JOIN currencies c ON c.id = rw.currency_id
                JOIN networks n ON n.id = rw.network_id
                WHERE rw.user_id = ?
                ORDER BY rw.assigned_at DESC, rw.id DESC
            ''', (user_id,)).fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'wallets': [serialize_real_user_wallet(row) for row in rows]
                }
            }), 200

        except Exception as e:
            print(f"Get real crypto wallets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/wallets/real-crypto/assign', methods=['POST'])
    @ctx.jwt_required()
    def assign_real_crypto_wallet():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json(silent=True) or {}
            currency_id = data.get('currency_id')
            network_id = data.get('network_id')

            if not currency_id or not network_id:
                return jsonify({'error': 'Currency and network are required', 'code': 'REAL_WALLET_SCOPE_REQUIRED'}), 400

            conn = ctx.get_db_connection()
            if not is_real_money_enabled(conn):
                conn.close()
                return jsonify({'error': 'The real money mode is currently disabled', 'code': 'REAL_MONEY_DISABLED'}), 403

            if not bool(get_setting_value(conn, 'real_wallets_section_enabled', True)):
                conn.close()
                return jsonify({'error': 'The real wallets section is currently disabled', 'code': 'REAL_WALLETS_DISABLED'}), 403

            if not bool(get_setting_value(conn, 'real_crypto_wallet_creation_enabled', True)):
                conn.close()
                return jsonify({'error': 'Creating new real crypto wallets is currently disabled', 'code': 'REAL_WALLET_CREATION_DISABLED'}), 403

            currency = conn.execute(
                'SELECT id, code FROM currencies WHERE id = ? AND is_active = 1',
                (currency_id,)
            ).fetchone()
            network = conn.execute(
                'SELECT id, code, name FROM networks WHERE id = ? AND currency_id = ? AND is_active = 1',
                (network_id, currency_id)
            ).fetchone()
            if not currency or not network:
                conn.close()
                return jsonify({'error': 'Invalid currency or network', 'code': 'REAL_WALLET_INVALID_SCOPE'}), 400

            existing = conn.execute('''
                SELECT
                    rw.id,
                    rw.user_id,
                    rw.currency_id,
                    rw.network_id,
                    rw.pool_wallet_id,
                    rw.address,
                    rw.label,
                    rw.provider_name,
                    rw.status,
                    rw.assigned_at,
                    rw.last_synced_at,
                    rp.is_active,
                    c.code as currency_code,
                    c.name as currency_name,
                    c.symbol,
                    c.min_deposit,
                    c.min_withdraw,
                    n.code as network_code,
                    n.name as network_name,
                    n.fee_percentage,
                    n.fee_fixed,
                    n.min_amount
                FROM real_user_wallets rw
                JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
                JOIN currencies c ON c.id = rw.currency_id
                JOIN networks n ON n.id = rw.network_id
                WHERE rw.user_id = ? AND rw.currency_id = ? AND rw.network_id = ?
                LIMIT 1
            ''', (user_id, currency_id, network_id)).fetchone()
            if existing:
                conn.close()
                return jsonify({
                    'success': True,
                    'message': 'لديك محفظة حقيقية مستقلة بالفعل لهذه العملة والشبكة',
                    'data': {
                        'wallet': serialize_real_user_wallet(existing),
                        'existing': True
                    }
                }), 200

            try:
                charge_company_wallet_setup_fee_if_needed(conn, user_id, f'{currency["code"]}-{network["code"]}')
            except ValueError:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'ملف الشركة غير مكتمل بعد', 'code': 'COMPANY_PROFILE_REQUIRED'}), 400
            except RuntimeError as exc:
                conn.rollback()
                conn.close()
                code = str(exc)
                if code == 'COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED':
                    return jsonify({'error': 'Company wallet fee currency is not configured', 'code': code}), 500
                if code == 'COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED':
                    return jsonify({'error': 'Company wallet fee network is not configured', 'code': code}), 500
                return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
            except LookupError:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'No active admin wallet available for company wallet setup fee', 'code': 'COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED'}), 400
            except PermissionError as exc:
                conn.rollback()
                conn.close()
                return jsonify({'error': str(exc), 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor = conn.cursor()
            generation_settings = get_real_wallet_generation_settings(conn)
            provider_mode = generation_settings['mode']
            provider_error = None
            wallet_id = None

            if provider_mode in ('tatum_xpub', 'hybrid'):
                xpub = get_real_wallet_provider_xpub(generation_settings, network['code'])
                if generation_settings['provider'] == 'tatum' and generation_settings['api_key'] and xpub:
                    try:
                        derivation_index = get_next_real_wallet_index(conn, currency_id, network_id)
                        generated = generate_tatum_address_from_xpub(
                            api_key=generation_settings['api_key'],
                            base_url=generation_settings['base_url'],
                            network_code=network['code'],
                            xpub=xpub,
                            index=derivation_index,
                            eth_testnet_type=generation_settings['eth_testnet_type']
                        )
                        cursor.execute('''
                            INSERT INTO real_crypto_wallet_pool (
                                currency_id, network_id, address, label, provider_name, notes,
                                is_active, assigned_user_id, assigned_at, created_by
                            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, ?)
                        ''', (
                            currency_id,
                            network_id,
                            generated['address'],
                            f"{currency['code']} {network['code']} #{derivation_index}",
                            generated['provider_name'],
                            f"provider=tatum; index={derivation_index}",
                            user_id,
                            user_id
                        ))
                        pool_wallet_id = cursor.lastrowid
                        cursor.execute('''
                            INSERT INTO real_user_wallets (
                                user_id, currency_id, network_id, pool_wallet_id, address,
                                label, provider_name, status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                        ''', (
                            user_id,
                            currency_id,
                            network_id,
                            pool_wallet_id,
                            generated['address'],
                            f"{currency['code']} {network['code']} #{derivation_index}",
                            generated['provider_name']
                        ))
                        wallet_id = cursor.lastrowid
                        conn.commit()
                    except (BlockchainConfigurationError, BlockchainProvisioningError) as exc:
                        provider_error = str(exc)
                        conn.rollback()
                elif provider_mode == 'tatum_xpub':
                    provider_error = 'Tatum provider is not fully configured yet for this network'

            if wallet_id is None:
                pool_wallet = conn.execute('''
                    SELECT id, address, label, provider_name
                    FROM real_crypto_wallet_pool
                    WHERE currency_id = ? AND network_id = ? AND is_active = 1 AND assigned_user_id IS NULL
                    ORDER BY id ASC
                    LIMIT 1
                ''', (currency_id, network_id)).fetchone()
                if not pool_wallet:
                    conn.close()
                    return jsonify({
                        'error': provider_error or 'No independent real wallet is available for this currency and network yet',
                        'code': 'REAL_WALLET_POOL_EMPTY'
                    }), 400

                cursor.execute('''
                    UPDATE real_crypto_wallet_pool
                    SET assigned_user_id = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND assigned_user_id IS NULL
                ''', (user_id, pool_wallet['id']))
                if cursor.rowcount == 0:
                    conn.rollback()
                    conn.close()
                    return jsonify({'error': 'This real wallet was assigned moments ago. Try again.', 'code': 'REAL_WALLET_ASSIGN_RACE'}), 409

                cursor.execute('''
                    INSERT INTO real_user_wallets (
                        user_id, currency_id, network_id, pool_wallet_id, address,
                        label, provider_name, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                ''', (
                    user_id,
                    currency_id,
                    network_id,
                    pool_wallet['id'],
                    pool_wallet['address'],
                    pool_wallet['label'],
                    pool_wallet['provider_name']
                ))

                wallet_id = cursor.lastrowid
                conn.commit()

            assigned = conn.execute('''
                SELECT
                    rw.id,
                    rw.user_id,
                    rw.currency_id,
                    rw.network_id,
                    rw.pool_wallet_id,
                    rw.address,
                    rw.label,
                    rw.provider_name,
                    rw.status,
                    rw.assigned_at,
                    rw.last_synced_at,
                    rp.is_active,
                    c.code as currency_code,
                    c.name as currency_name,
                    c.symbol,
                    c.min_deposit,
                    c.min_withdraw,
                    n.code as network_code,
                    n.name as network_name,
                    n.fee_percentage,
                    n.fee_fixed,
                    n.min_amount
                FROM real_user_wallets rw
                JOIN real_crypto_wallet_pool rp ON rp.id = rw.pool_wallet_id
                JOIN currencies c ON c.id = rw.currency_id
                JOIN networks n ON n.id = rw.network_id
                WHERE rw.id = ?
            ''', (wallet_id,)).fetchone()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم إنشاء محفظة كريبتو حقيقية مستقلة لك بنجاح',
                'data': {
                    'wallet': serialize_real_user_wallet(assigned),
                    'existing': False
                }
            }), 201

        except Exception as e:
            print(f"Assign real crypto wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/wallets/generate/<int:currency_id>', methods=['POST'])
    @ctx.jwt_required()
    def generate_new_wallet(currency_id):
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json(silent=True) or {}
            conn = ctx.get_db_connection()

            currency = conn.execute(
                'SELECT id, code FROM currencies WHERE id = ? AND is_active = 1',
                (currency_id,)
            ).fetchone()

            if not currency:
                conn.close()
                return jsonify({'error': 'Currency not found', 'code': 'CURRENCY_NOT_FOUND'}), 404

            network_code = str(data.get('network') or '').upper().strip()
            params = [currency_id]
            network_filter = ''
            if network_code:
                candidate_codes = get_network_candidates(currency['code'], network_code)
                placeholders = ', '.join(['?'] * len(candidate_codes))
                network_filter = f'AND UPPER(n.code) IN ({placeholders})'
                params.extend(candidate_codes)

            receiving_wallet = conn.execute(f'''
                SELECT a.address, n.code as network_code, n.name as network_name
                FROM admin_wallets a
                JOIN networks n ON n.id = a.network_id
                WHERE a.currency_id = ? AND a.is_active = 1 {network_filter}
                ORDER BY a.id ASC
                LIMIT 1
            ''', params).fetchone()

            if not receiving_wallet:
                conn.close()
                return jsonify({
                    'error': 'No active receiving wallet configured for this currency or network',
                    'code': 'RECEIVING_WALLET_NOT_CONFIGURED'
                }), 400

            new_address = receiving_wallet['address']
            try:
                charge_company_wallet_setup_fee_if_needed(conn, user_id, f'legacy-{currency["code"]}')
            except ValueError:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'ملف الشركة غير مكتمل بعد', 'code': 'COMPANY_PROFILE_REQUIRED'}), 400
            except RuntimeError as exc:
                conn.rollback()
                conn.close()
                code = str(exc)
                if code == 'COMPANY_WALLET_FEE_CURRENCY_NOT_CONFIGURED':
                    return jsonify({'error': 'Company wallet fee currency is not configured', 'code': code}), 500
                if code == 'COMPANY_WALLET_FEE_NETWORK_NOT_CONFIGURED':
                    return jsonify({'error': 'Company wallet fee network is not configured', 'code': code}), 500
                return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
            except LookupError:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'No active admin wallet available for company wallet setup fee', 'code': 'COMPANY_WALLET_FEE_WALLET_NOT_CONFIGURED'}), 400
            except PermissionError as exc:
                conn.rollback()
                conn.close()
                return jsonify({'error': str(exc), 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_wallets
                SET address = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND currency_id = ?
            ''', (new_address, user_id, currency_id))

            if cursor.rowcount == 0:
                cursor.execute('''
                    INSERT INTO user_wallets (user_id, currency_id, address, balance)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, currency_id, new_address, 0.0))

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم ربط المحفظة بمحفظة الاستقبال بنجاح',
                'data': {
                    'currency_id': currency_id,
                    'currency_code': currency['code'],
                    'new_address': new_address,
                    'network': receiving_wallet['network_code'],
                    'network_name': receiving_wallet['network_name']
                }
            }), 200

        except Exception as e:
            print(f"Generate wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/currencies', methods=['GET'])
    def get_currencies():
        try:
            conn = ctx.get_db_connection()
            currencies = conn.execute('''
                SELECT id, code, name, symbol, is_active
                FROM currencies
                WHERE is_active = 1
                ORDER BY code
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'currencies': [dict(c) for c in currencies]
                }
            }), 200

        except Exception as e:
            print(f"Get currencies error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallets', methods=['POST'])
    @ctx.admin_required
    def create_admin_wallet():
        try:
            data = request.get_json()
            required_fields = ['currency', 'network', 'address']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            currency_code = data['currency'].upper()
            network_code = data['network'].upper()
            conn = ctx.get_db_connection()

            currency = conn.execute(
                'SELECT id FROM currencies WHERE code = ? AND is_active = 1',
                (currency_code,)
            ).fetchone()
            if not currency:
                conn.close()
                return jsonify({'error': f'Currency {currency_code} not found', 'code': 'INVALID_CURRENCY'}), 400

            network = conn.execute(
                'SELECT id FROM networks WHERE code = ? AND currency_id = ? AND is_active = 1 ORDER BY id LIMIT 1',
                (network_code, currency['id'])
            ).fetchone()
            if not network:
                conn.close()
                return jsonify({'error': f'Network {network_code} not found', 'code': 'INVALID_NETWORK'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO admin_wallets (currency_id, network_id, address, label)
                VALUES (?, ?, ?, ?)
            ''', (currency['id'], network['id'], data['address'], data.get('label', '')))
            wallet_id = cursor.lastrowid

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم إضافة محفظة الأدمن بنجاح',
                'data': {'wallet_id': wallet_id}
            }), 201

        except Exception as e:
            print(f"Create admin wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallets', methods=['GET'])
    @ctx.admin_required
    def get_admin_wallets():
        try:
            conn = ctx.get_db_connection()
            wallet_rows = conn.execute('''
                SELECT
                    a.id,
                    a.currency_id,
                    a.network_id,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.name as network_name,
                    n.code as network_code,
                    a.address,
                    a.label,
                    a.current_balance,
                    a.total_received,
                    a.total_sent,
                    a.is_active,
                    a.created_at
                FROM admin_wallets a
                JOIN currencies c ON a.currency_id = c.id
                JOIN networks n ON a.network_id = n.id
                ORDER BY c.code, n.name
            ''').fetchall()

            wallets = [dict(row) for row in wallet_rows]
            if not wallets:
                conn.close()
                return jsonify({
                    'success': True,
                    'data': {
                        'wallets': [],
                        'summary': {
                            'total_wallets': 0,
                            'active_wallets': 0,
                            'inactive_wallets': 0,
                            'total_balance': 0.0,
                            'total_received': 0.0,
                            'total_sent': 0.0,
                            'total_activities': 0,
                            'total_completed_activities': 0,
                            'total_verified_deposits': 0.0,
                            'total_fee_income': 0.0,
                            'by_currency': [],
                            'by_network': [],
                            'fee_breakdown': [],
                            'top_wallet': None
                        }
                    }
                }), 200

            stats_by_wallet_id = {}
            address_map = {}
            for wallet in wallets:
                wallet_id = int(wallet['id'])
                address = str(wallet.get('address') or '').strip()
                stats_by_wallet_id[wallet_id] = {
                    'activity_count': 0,
                    'completed_activity_count': 0,
                    'deposit_count': 0,
                    'verified_deposit_amount': 0.0,
                    'fee_income_count': 0,
                    'fee_income_amount': 0.0,
                    'last_activity_at': None,
                    'last_activity_type': None,
                    'recent_activity': [],
                    'fee_breakdown': {}
                }
                if address:
                    address_map.setdefault(address, []).append(wallet_id)

            fee_types = {
                'company_wallet_setup_fee',
                'company_investment_listing_fee',
                'company_project_investment_fee',
                'property_listing_fee',
                'investment_platform_fee'
            }

            transaction_rows = conn.execute('''
                SELECT
                    t.id,
                    t.type,
                    t.status,
                    t.amount,
                    t.admin_wallet_address,
                    t.created_at,
                    t.verified_at
                FROM transactions t
                WHERE COALESCE(t.admin_wallet_address, '') != ''
                ORDER BY t.created_at DESC, t.id DESC
            ''').fetchall()

            for row in transaction_rows:
                address = str(row['admin_wallet_address'] or '').strip()
                wallet_ids = address_map.get(address, [])
                if not wallet_ids:
                    continue

                is_completed = str(row['status'] or '').strip().lower() == 'completed' or bool(row['verified_at'])
                amount = float(row['amount'] or 0)
                tx_type = str(row['type'] or '').strip()
                activity_item = {
                    'id': row['id'],
                    'type': tx_type,
                    'status': row['status'],
                    'amount': amount,
                    'created_at': row['created_at']
                }

                for wallet_id in wallet_ids:
                    stats = stats_by_wallet_id[wallet_id]
                    stats['activity_count'] += 1
                    if is_completed:
                        stats['completed_activity_count'] += 1
                    if tx_type == 'deposit':
                        stats['deposit_count'] += 1
                        if is_completed:
                            stats['verified_deposit_amount'] += amount
                    if tx_type in fee_types:
                        stats['fee_income_count'] += 1
                        if is_completed:
                            stats['fee_income_amount'] += amount
                        breakdown = stats['fee_breakdown'].setdefault(tx_type, {'count': 0, 'amount': 0.0})
                        breakdown['count'] += 1
                        if is_completed:
                            breakdown['amount'] += amount
                    if not stats['last_activity_at']:
                        stats['last_activity_at'] = row['created_at']
                        stats['last_activity_type'] = tx_type
                    if len(stats['recent_activity']) < 3:
                        stats['recent_activity'].append(activity_item)

            wallet_profiles_exists = bool(conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'wallet_profiles'"
            ).fetchone())
            financial_channels_exists = bool(conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'financial_channels'"
            ).fetchone())

            special_wallet_counts = {
                int(row['admin_wallet_id']): int(row['count'] or 0)
                for row in (conn.execute('''
                    SELECT admin_wallet_id, COUNT(*) as count
                    FROM wallet_profiles
                    WHERE admin_wallet_id IS NOT NULL
                    GROUP BY admin_wallet_id
                ''').fetchall() if wallet_profiles_exists else [])
            }
            financial_channel_counts = {
                int(row['admin_wallet_id']): int(row['count'] or 0)
                for row in (conn.execute('''
                    SELECT admin_wallet_id, COUNT(*) as count
                    FROM financial_channels
                    WHERE admin_wallet_id IS NOT NULL
                    GROUP BY admin_wallet_id
                ''').fetchall() if financial_channels_exists else [])
            }
            conn.close()

            currency_summary = {}
            network_summary = {}
            fee_breakdown_summary = {}
            top_wallet = None

            for wallet in wallets:
                wallet_id = int(wallet['id'])
                stats = stats_by_wallet_id.get(wallet_id, {})
                wallet['activity_count'] = stats.get('activity_count', 0)
                wallet['completed_activity_count'] = stats.get('completed_activity_count', 0)
                wallet['deposit_count'] = stats.get('deposit_count', 0)
                wallet['verified_deposit_amount'] = round(stats.get('verified_deposit_amount', 0.0), 8)
                wallet['fee_income_count'] = stats.get('fee_income_count', 0)
                wallet['fee_income_amount'] = round(stats.get('fee_income_amount', 0.0), 8)
                wallet['last_activity_at'] = stats.get('last_activity_at')
                wallet['last_activity_type'] = stats.get('last_activity_type')
                wallet['recent_activity'] = stats.get('recent_activity', [])
                wallet['fee_breakdown'] = [
                    {
                        'type': fee_type,
                        'count': values['count'],
                        'amount': round(values['amount'], 8)
                    }
                    for fee_type, values in stats.get('fee_breakdown', {}).items()
                ]
                wallet['special_profiles_count'] = special_wallet_counts.get(wallet_id, 0)
                wallet['financial_channels_count'] = financial_channel_counts.get(wallet_id, 0)
                wallet['linked_services_count'] = wallet['special_profiles_count'] + wallet['financial_channels_count']

                currency_key = str(wallet['currency_code'])
                currency_entry = currency_summary.setdefault(currency_key, {
                    'code': currency_key,
                    'wallet_count': 0,
                    'balance': 0.0,
                    'received': 0.0,
                    'activities': 0
                })
                currency_entry['wallet_count'] += 1
                currency_entry['balance'] += float(wallet.get('current_balance') or 0)
                currency_entry['received'] += float(wallet.get('total_received') or 0)
                currency_entry['activities'] += int(wallet.get('activity_count') or 0)

                network_key = str(wallet['network_code'])
                network_entry = network_summary.setdefault(network_key, {
                    'code': network_key,
                    'name': wallet.get('network_name') or network_key,
                    'wallet_count': 0,
                    'balance': 0.0,
                    'received': 0.0,
                    'activities': 0
                })
                network_entry['wallet_count'] += 1
                network_entry['balance'] += float(wallet.get('current_balance') or 0)
                network_entry['received'] += float(wallet.get('total_received') or 0)
                network_entry['activities'] += int(wallet.get('activity_count') or 0)

                for item in wallet['fee_breakdown']:
                    fee_entry = fee_breakdown_summary.setdefault(item['type'], {
                        'type': item['type'],
                        'count': 0,
                        'amount': 0.0
                    })
                    fee_entry['count'] += int(item['count'] or 0)
                    fee_entry['amount'] += float(item['amount'] or 0)

                if top_wallet is None or float(wallet.get('total_received') or 0) > float(top_wallet.get('total_received') or 0):
                    top_wallet = wallet

            summary = {
                'total_wallets': len(wallets),
                'active_wallets': sum(1 for wallet in wallets if bool(wallet.get('is_active'))),
                'inactive_wallets': sum(1 for wallet in wallets if not bool(wallet.get('is_active'))),
                'total_balance': round(sum(float(wallet.get('current_balance') or 0) for wallet in wallets), 8),
                'total_received': round(sum(float(wallet.get('total_received') or 0) for wallet in wallets), 8),
                'total_sent': round(sum(float(wallet.get('total_sent') or 0) for wallet in wallets), 8),
                'total_activities': sum(int(wallet.get('activity_count') or 0) for wallet in wallets),
                'total_completed_activities': sum(int(wallet.get('completed_activity_count') or 0) for wallet in wallets),
                'total_verified_deposits': round(sum(float(wallet.get('verified_deposit_amount') or 0) for wallet in wallets), 8),
                'total_fee_income': round(sum(float(wallet.get('fee_income_amount') or 0) for wallet in wallets), 8),
                'by_currency': sorted(currency_summary.values(), key=lambda item: item['received'], reverse=True),
                'by_network': sorted(network_summary.values(), key=lambda item: item['received'], reverse=True),
                'fee_breakdown': sorted(fee_breakdown_summary.values(), key=lambda item: item['amount'], reverse=True),
                'top_wallet': {
                    'id': top_wallet['id'],
                    'label': top_wallet.get('label') or f"{top_wallet.get('currency_code', '')} {top_wallet.get('network_code', '')}",
                    'address': top_wallet.get('address'),
                    'currency_code': top_wallet.get('currency_code'),
                    'network_code': top_wallet.get('network_code'),
                    'current_balance': top_wallet.get('current_balance'),
                    'total_received': top_wallet.get('total_received')
                } if top_wallet else None
            }

            return jsonify({
                'success': True,
                'data': {
                    'wallets': wallets,
                    'summary': summary
                }
            }), 200

        except Exception as e:
            print(f"Get admin wallets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallets/<int:wallet_id>', methods=['PUT'])
    @ctx.admin_required
    def update_admin_wallet(wallet_id):
        try:
            data = request.get_json() or {}
            label = data.get('label')
            has_active_flag = 'is_active' in data
            is_active = 1 if data.get('is_active') else 0

            if label is None and not has_active_flag:
                return jsonify({'error': 'Nothing to update', 'code': 'NO_FIELDS_TO_UPDATE'}), 400

            conn = ctx.get_db_connection()
            wallet = conn.execute('SELECT id FROM admin_wallets WHERE id = ?', (wallet_id,)).fetchone()
            if not wallet:
                conn.close()
                return jsonify({'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'}), 404

            updates = []
            params = []
            if label is not None:
                updates.append('label = ?')
                params.append(str(label).strip())
            if has_active_flag:
                updates.append('is_active = ?')
                params.append(is_active)
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(wallet_id)

            conn.execute(
                f"UPDATE admin_wallets SET {', '.join(updates)} WHERE id = ?",
                params
            )
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تحديث محفظة الأدمن بنجاح'
            }), 200

        except Exception as e:
            print(f"Update admin wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallets/<int:wallet_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_admin_wallet(wallet_id):
        try:
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM admin_wallets WHERE id = ?', (wallet_id,))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حذف محفظة الأدمن بنجاح'
            }), 200

        except Exception as e:
            print(f"Delete admin wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/receiving-wallets', methods=['POST'])
    @ctx.admin_required
    def create_receiving_wallet():
        try:
            data = request.get_json()
            required_fields = ['currency_id', 'network_id', 'address']
            for field in required_fields:
                if not data.get(field):
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            currency_id = data['currency_id']
            network_id = data['network_id']
            address = data['address'].strip()
            label = data.get('label', '').strip()
            conn = ctx.get_db_connection()

            currency = conn.execute(
                'SELECT id FROM currencies WHERE id = ? AND is_active = 1',
                (currency_id,)
            ).fetchone()
            if not currency:
                conn.close()
                return jsonify({'error': 'Currency not found', 'code': 'INVALID_CURRENCY'}), 400

            network = conn.execute(
                'SELECT id FROM networks WHERE id = ? AND is_active = 1',
                (network_id,)
            ).fetchone()
            if not network:
                conn.close()
                return jsonify({'error': 'Network not found', 'code': 'INVALID_NETWORK'}), 400

            existing = conn.execute('''
                SELECT id FROM admin_wallets
                WHERE currency_id = ? AND network_id = ? AND address = ?
            ''', (currency_id, network_id, address)).fetchone()
            if existing:
                conn.close()
                return jsonify({'error': 'This wallet already exists', 'code': 'WALLET_EXISTS'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO admin_wallets (currency_id, network_id, address, label, is_active)
                VALUES (?, ?, ?, ?, 1)
            ''', (currency_id, network_id, address, label))
            wallet_id = cursor.lastrowid

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم إضافة محفظة الاستقبال بنجاح',
                'data': {'wallet_id': wallet_id}
            }), 201

        except Exception as e:
            print(f"Create receiving wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/receiving-wallets', methods=['GET'])
    @ctx.admin_required
    def get_receiving_wallets():
        try:
            conn = ctx.get_db_connection()
            wallets = conn.execute('''
                SELECT
                    a.id,
                    c.id as currency_id,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.id as network_id,
                    n.name as network_name,
                    n.code as network_code,
                    a.address,
                    a.label,
                    a.current_balance,
                    a.total_received,
                    a.total_sent,
                    a.is_active,
                    a.created_at
                FROM admin_wallets a
                JOIN currencies c ON a.currency_id = c.id
                JOIN networks n ON a.network_id = n.id
                WHERE a.is_active = 1
                ORDER BY c.code, n.name
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'wallets': [dict(w) for w in wallets]
                }
            }), 200

        except Exception as e:
            print(f"Get receiving wallets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/receiving-wallets/<int:wallet_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_receiving_wallet(wallet_id):
        try:
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM admin_wallets WHERE id = ?', (wallet_id,))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حذف محفظة الاستقبال بنجاح'
            }), 200

        except Exception as e:
            print(f"Delete receiving wallet error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/real-crypto-wallet-pool', methods=['GET'])
    @ctx.admin_required
    def get_admin_real_crypto_wallet_pool():
        try:
            conn = ctx.get_db_connection()
            rows = conn.execute('''
                SELECT
                    rp.id,
                    rp.currency_id,
                    rp.network_id,
                    rp.address,
                    rp.label,
                    rp.provider_name,
                    rp.notes,
                    rp.is_active,
                    rp.assigned_user_id,
                    rp.assigned_at,
                    rp.created_at,
                    rp.updated_at,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.code as network_code,
                    n.name as network_name,
                    u.public_user_id as assigned_public_user_id,
                    u.name as assigned_user_name
                FROM real_crypto_wallet_pool rp
                JOIN currencies c ON c.id = rp.currency_id
                JOIN networks n ON n.id = rp.network_id
                LEFT JOIN users u ON u.id = rp.assigned_user_id
                ORDER BY rp.is_active DESC, rp.id DESC
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'wallets': [serialize_real_pool_wallet(row) for row in rows]
                }
            }), 200

        except Exception as e:
            print(f"Get admin real crypto wallet pool error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/real-crypto-wallet-pool', methods=['POST'])
    @ctx.admin_required
    @ctx.jwt_required()
    def create_or_update_real_crypto_wallet_pool():
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            data = request.get_json(silent=True) or {}
            pool_id = data.get('pool_id')
            currency_id = data.get('currency_id')
            network_id = data.get('network_id')
            address = str(data.get('address') or '').strip()
            label = str(data.get('label') or '').strip()
            provider_name = str(data.get('provider_name') or '').strip()
            notes = str(data.get('notes') or '').strip()
            is_active = bool(data.get('is_active', True))

            if not currency_id or not network_id or not address:
                return jsonify({'error': 'Currency, network, and address are required', 'code': 'REAL_POOL_MISSING_FIELDS'}), 400

            conn = ctx.get_db_connection()
            currency = conn.execute('SELECT id FROM currencies WHERE id = ? AND is_active = 1', (currency_id,)).fetchone()
            network = conn.execute('SELECT id FROM networks WHERE id = ? AND currency_id = ? AND is_active = 1', (network_id, currency_id)).fetchone()
            if not currency or not network:
                conn.close()
                return jsonify({'error': 'Invalid currency or network', 'code': 'REAL_POOL_INVALID_SCOPE'}), 400

            existing_by_address = conn.execute('''
                SELECT id
                FROM real_crypto_wallet_pool
                WHERE address = ? AND (? IS NULL OR id != ?)
            ''', (address, pool_id, pool_id)).fetchone()
            if existing_by_address:
                conn.close()
                return jsonify({'error': 'This real wallet address already exists', 'code': 'REAL_POOL_DUPLICATE_ADDRESS'}), 400

            cursor = conn.cursor()
            created = not pool_id
            if pool_id:
                existing = conn.execute('SELECT id, assigned_user_id FROM real_crypto_wallet_pool WHERE id = ?', (pool_id,)).fetchone()
                if not existing:
                    conn.close()
                    return jsonify({'error': 'Real wallet pool entry not found', 'code': 'REAL_POOL_NOT_FOUND'}), 404

                cursor.execute('''
                    UPDATE real_crypto_wallet_pool
                    SET currency_id = ?, network_id = ?, address = ?, label = ?, provider_name = ?,
                        notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (currency_id, network_id, address, label or None, provider_name or None, notes or None, int(is_active), pool_id))
                if existing['assigned_user_id']:
                    cursor.execute('''
                        UPDATE real_user_wallets
                        SET currency_id = ?, network_id = ?, address = ?, label = ?, provider_name = ?,
                            status = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE pool_wallet_id = ?
                    ''', (
                        currency_id,
                        network_id,
                        address,
                        label or None,
                        provider_name or None,
                        'active' if is_active else 'paused',
                        pool_id
                    ))
            else:
                cursor.execute('''
                    INSERT INTO real_crypto_wallet_pool (
                        currency_id, network_id, address, label, provider_name, notes,
                        is_active, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (currency_id, network_id, address, label or None, provider_name or None, notes or None, int(is_active), admin_user_id))
                pool_id = cursor.lastrowid

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حفظ عنوان المحفظة الحقيقية المستقلة بنجاح' if created else 'تم تحديث عنوان المحفظة الحقيقية بنجاح',
                'data': {
                    'pool_id': pool_id
                }
            }), 201 if created else 200

        except Exception as e:
            print(f"Create or update real crypto wallet pool error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/real-crypto-wallet-pool/<int:pool_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_real_crypto_wallet_pool(pool_id):
        try:
            conn = ctx.get_db_connection()
            existing = conn.execute('''
                SELECT assigned_user_id
                FROM real_crypto_wallet_pool
                WHERE id = ?
            ''', (pool_id,)).fetchone()
            if not existing:
                conn.close()
                return jsonify({'error': 'Real wallet pool entry not found', 'code': 'REAL_POOL_NOT_FOUND'}), 404
            if existing['assigned_user_id']:
                conn.close()
                return jsonify({'error': 'This wallet is already assigned to a user and cannot be deleted', 'code': 'REAL_POOL_ASSIGNED'}), 400

            cursor = conn.cursor()
            cursor.execute('DELETE FROM real_crypto_wallet_pool WHERE id = ?', (pool_id,))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حذف عنوان المحفظة الحقيقية من المخزون بنجاح'
            }), 200

        except Exception as e:
            print(f"Delete real crypto wallet pool error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/financial-channels', methods=['GET'])
    @ctx.admin_required
    def get_admin_financial_channels():
        try:
            conn = ctx.get_db_connection()
            rows = conn.execute('''
                SELECT
                    fc.id,
                    fc.channel_type,
                    fc.title,
                    fc.description,
                    fc.country_code,
                    fc.country_name,
                    fc.currency_id,
                    fc.network_id,
                    fc.admin_wallet_id,
                    fc.account_label,
                    fc.account_identifier,
                    fc.extra_details,
                    fc.instructions,
                    fc.is_active,
                    fc.display_order,
                    fc.created_at,
                    fc.updated_at,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.code as network_code,
                    n.name as network_name,
                    a.address as linked_wallet_address,
                    a.label as linked_wallet_label,
                    u.name as created_by_name
                FROM financial_channels fc
                LEFT JOIN currencies c ON fc.currency_id = c.id
                LEFT JOIN networks n ON fc.network_id = n.id
                LEFT JOIN admin_wallets a ON fc.admin_wallet_id = a.id
                LEFT JOIN users u ON fc.created_by = u.id
                ORDER BY fc.display_order ASC, fc.id DESC
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'channels': [serialize_financial_channel(row) for row in rows]
                }
            }), 200

        except Exception as e:
            print(f"Get admin financial channels error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/financial-channels', methods=['POST'])
    @ctx.admin_required
    @ctx.jwt_required()
    def create_or_update_financial_channel():
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            data = request.get_json(silent=True) or {}
            channel_id = data.get('channel_id')
            channel_type = normalize_channel_type(data.get('channel_type'))
            title = str(data.get('title') or '').strip()
            description = str(data.get('description') or '').strip()
            country_code = normalize_country_code(data.get('country_code'))
            country_name = str(data.get('country_name') or '').strip()
            currency_id = data.get('currency_id') or None
            network_id = data.get('network_id') or None
            admin_wallet_id = data.get('admin_wallet_id') or None
            account_label = str(data.get('account_label') or '').strip()
            account_identifier = str(data.get('account_identifier') or '').strip()
            extra_details = str(data.get('extra_details') or '').strip()
            instructions = str(data.get('instructions') or '').strip()
            display_order = int(data.get('display_order') or 0)
            is_active = bool(data.get('is_active', True))

            if not title:
                return jsonify({'error': 'Channel title is required', 'code': 'MISSING_FINANCIAL_CHANNEL_TITLE'}), 400

            conn = ctx.get_db_connection()

            linked_wallet = None
            if admin_wallet_id:
                linked_wallet = conn.execute('''
                    SELECT
                        a.id,
                        a.address,
                        a.label,
                        a.currency_id,
                        a.network_id
                    FROM admin_wallets a
                    WHERE a.id = ?
                ''', (admin_wallet_id,)).fetchone()
                if not linked_wallet:
                    conn.close()
                    return jsonify({'error': 'Linked admin wallet not found', 'code': 'FINANCIAL_CHANNEL_WALLET_NOT_FOUND'}), 404
                currency_id = currency_id or linked_wallet['currency_id']
                network_id = network_id or linked_wallet['network_id']
                if not account_identifier:
                    account_identifier = linked_wallet['address']
                if not account_label:
                    account_label = linked_wallet['label'] or title

            if currency_id:
                currency = conn.execute(
                    'SELECT id FROM currencies WHERE id = ? AND is_active = 1',
                    (currency_id,)
                ).fetchone()
                if not currency:
                    conn.close()
                    return jsonify({'error': 'Invalid currency selected', 'code': 'INVALID_FINANCIAL_CHANNEL_CURRENCY'}), 400

            if network_id:
                params = [network_id]
                query = 'SELECT id FROM networks WHERE id = ? AND is_active = 1'
                if currency_id:
                    query += ' AND currency_id = ?'
                    params.append(currency_id)
                network = conn.execute(query, params).fetchone()
                if not network:
                    conn.close()
                    return jsonify({'error': 'Invalid network selected', 'code': 'INVALID_FINANCIAL_CHANNEL_NETWORK'}), 400

            if channel_type == 'crypto':
                if not currency_id or not network_id:
                    conn.close()
                    return jsonify({'error': 'Crypto channel requires currency and network', 'code': 'FINANCIAL_CHANNEL_SCOPE_REQUIRED'}), 400

            if not account_identifier and not extra_details and not linked_wallet:
                conn.close()
                return jsonify({'error': 'Add account details or link an admin wallet', 'code': 'FINANCIAL_CHANNEL_DETAILS_REQUIRED'}), 400

            cursor = conn.cursor()
            created = not channel_id
            if channel_id:
                existing = conn.execute('SELECT id FROM financial_channels WHERE id = ?', (channel_id,)).fetchone()
                if not existing:
                    conn.close()
                    return jsonify({'error': 'Financial channel not found', 'code': 'FINANCIAL_CHANNEL_NOT_FOUND'}), 404

                cursor.execute('''
                    UPDATE financial_channels
                    SET channel_type = ?, title = ?, description = ?, country_code = ?, country_name = ?,
                        currency_id = ?, network_id = ?, admin_wallet_id = ?, account_label = ?,
                        account_identifier = ?, extra_details = ?, instructions = ?, is_active = ?,
                        display_order = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (
                    channel_type, title, description, country_code or None, country_name or None,
                    currency_id, network_id, admin_wallet_id, account_label or None,
                    account_identifier or None, extra_details or None, instructions or None,
                    int(is_active), display_order, channel_id
                ))
            else:
                cursor.execute('''
                    INSERT INTO financial_channels (
                        channel_type, title, description, country_code, country_name,
                        currency_id, network_id, admin_wallet_id, account_label,
                        account_identifier, extra_details, instructions, is_active,
                        display_order, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    channel_type, title, description, country_code or None, country_name or None,
                    currency_id, network_id, admin_wallet_id, account_label or None,
                    account_identifier or None, extra_details or None, instructions or None,
                    int(is_active), display_order, admin_user_id
                ))
                channel_id = cursor.lastrowid

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حفظ القناة المالية الحقيقية بنجاح' if created else 'تم تحديث القناة المالية الحقيقية بنجاح',
                'data': {
                    'channel_id': channel_id
                }
            }), 201 if created else 200

        except Exception as e:
            print(f"Create or update financial channel error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/financial-channels/<int:channel_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_financial_channel(channel_id):
        try:
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM financial_channels WHERE id = ?', (channel_id,))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حذف القناة المالية الحقيقية بنجاح'
            }), 200

        except Exception as e:
            print(f"Delete financial channel error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallet-profiles', methods=['GET'])
    @ctx.admin_required
    def get_wallet_profiles():
        try:
            conn = ctx.get_db_connection()
            profiles = conn.execute('''
                SELECT
                    p.id,
                    p.title,
                    p.description,
                    p.access_note,
                    p.is_active,
                    p.created_at,
                    c.id as currency_id,
                    c.code as currency_code,
                    c.name as currency_name,
                    n.id as network_id,
                    n.code as network_code,
                    n.name as network_name,
                    a.id as admin_wallet_id,
                    a.address,
                    a.label as admin_wallet_label
                FROM wallet_profiles p
                JOIN currencies c ON p.currency_id = c.id
                JOIN networks n ON p.network_id = n.id
                LEFT JOIN admin_wallets a ON p.admin_wallet_id = a.id
                ORDER BY p.created_at DESC, p.id DESC
            ''').fetchall()

            access_rows = conn.execute('''
                SELECT
                    pa.profile_id,
                    u.id as user_id,
                    u.name,
                    u.public_user_id
                FROM wallet_profile_access pa
                JOIN users u ON u.id = pa.user_id
                WHERE pa.is_active = 1
                ORDER BY u.public_user_id
            ''').fetchall()
            conn.close()

            access_map = {}
            for row in access_rows:
                access_map.setdefault(row['profile_id'], []).append({
                    'user_id': row['user_id'],
                    'name': row['name'],
                    'public_user_id': row['public_user_id']
                })

            data = []
            for profile in profiles:
                item = dict(profile)
                item['access_users'] = access_map.get(profile['id'], [])
                item['access_count'] = len(item['access_users'])
                data.append(item)

            return jsonify({
                'success': True,
                'data': {
                    'profiles': data
                }
            }), 200

        except Exception as e:
            print(f"Get wallet profiles error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallet-profiles', methods=['POST'])
    @ctx.admin_required
    @ctx.jwt_required()
    def create_or_update_wallet_profile():
        try:
            admin_user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            title = str(data.get('title') or '').strip()
            description = str(data.get('description') or '').strip()
            access_note = str(data.get('access_note') or '').strip()
            currency_id = data.get('currency_id')
            network_id = data.get('network_id')
            admin_wallet_id = data.get('admin_wallet_id') or None
            is_active = bool(data.get('is_active', True))
            profile_id = data.get('profile_id')
            public_user_ids = parse_public_user_ids(data.get('allowed_public_ids'))

            if not title:
                return jsonify({'error': 'Wallet profile title is required', 'code': 'MISSING_TITLE'}), 400
            if not currency_id or not network_id:
                return jsonify({'error': 'Currency and network are required', 'code': 'MISSING_WALLET_PROFILE_SCOPE'}), 400
            if not public_user_ids:
                return jsonify({'error': 'At least one public user ID is required', 'code': 'MISSING_WALLET_PROFILE_ACCESS'}), 400

            conn = ctx.get_db_connection()
            currency = conn.execute('SELECT id FROM currencies WHERE id = ? AND is_active = 1', (currency_id,)).fetchone()
            network = conn.execute('SELECT id FROM networks WHERE id = ? AND currency_id = ? AND is_active = 1', (network_id, currency_id)).fetchone()
            if not currency or not network:
                conn.close()
                return jsonify({'error': 'Invalid currency or network', 'code': 'INVALID_WALLET_PROFILE_SCOPE'}), 400

            if admin_wallet_id:
                admin_wallet = conn.execute('''
                    SELECT id
                    FROM admin_wallets
                    WHERE id = ? AND currency_id = ? AND network_id = ?
                ''', (admin_wallet_id, currency_id, network_id)).fetchone()
                if not admin_wallet:
                    conn.close()
                    return jsonify({'error': 'Linked receiving wallet does not match selected currency/network', 'code': 'INVALID_LINKED_ADMIN_WALLET'}), 400

            try:
                access_users = resolve_access_users(conn, public_user_ids)
            except ValueError as exc:
                conn.close()
                return jsonify({'error': str(exc), 'code': 'INVALID_ACCESS_USERS'}), 400

            cursor = conn.cursor()
            created = not profile_id
            if profile_id:
                existing = conn.execute('SELECT id FROM wallet_profiles WHERE id = ?', (profile_id,)).fetchone()
                if not existing:
                    conn.close()
                    return jsonify({'error': 'Wallet profile not found', 'code': 'WALLET_PROFILE_NOT_FOUND'}), 404

                cursor.execute('''
                    UPDATE wallet_profiles
                    SET title = ?, description = ?, access_note = ?, currency_id = ?, network_id = ?,
                        admin_wallet_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (title, description, access_note, currency_id, network_id, admin_wallet_id, int(is_active), profile_id))
            else:
                cursor.execute('''
                    INSERT INTO wallet_profiles (
                        title, description, access_note, currency_id, network_id,
                        admin_wallet_id, is_active, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (title, description, access_note, currency_id, network_id, admin_wallet_id, int(is_active), admin_user_id))
                profile_id = cursor.lastrowid

            cursor.execute('DELETE FROM wallet_profile_access WHERE profile_id = ?', (profile_id,))
            for user in access_users:
                cursor.execute('''
                    INSERT INTO wallet_profile_access (profile_id, user_id, is_active)
                    VALUES (?, ?, 1)
                ''', (profile_id, user['id']))

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حفظ المحفظة الخاصة وصلاحيات الوصول بنجاح' if created else 'تم تحديث المحفظة الخاصة وصلاحياتها بنجاح',
                'data': {
                    'profile_id': profile_id,
                    'access_count': len(access_users)
                }
            }), 201 if created else 200

        except Exception as e:
            print(f"Create or update wallet profile error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/wallet-profiles/<int:profile_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_wallet_profile(profile_id):
        try:
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM wallet_profile_access WHERE profile_id = ?', (profile_id,))
            cursor.execute('DELETE FROM wallet_profiles WHERE id = ?', (profile_id,))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم حذف المحفظة الخاصة بنجاح'
            }), 200

        except Exception as e:
            print(f"Delete wallet profile error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
