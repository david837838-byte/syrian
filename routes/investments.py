import json
import os
import sqlite3
import uuid
from datetime import date

from flask import current_app, jsonify, request
from werkzeug.utils import secure_filename


def register_investment_routes(app, ctx):
    PROPERTY_TYPE_LABELS = {
        'apartment': 'شقة',
        'villa': 'فيلا',
        'land': 'أرض',
        'office': 'مكتب',
        'shop': 'محل',
        'building': 'بناء كامل',
        'farm': 'مزرعة'
    }

    def normalize_investment_gallery(image_url='', image_gallery=None):
        items = []

        if isinstance(image_gallery, str):
            try:
                image_gallery = json.loads(image_gallery)
            except json.JSONDecodeError:
                image_gallery = []

        if isinstance(image_gallery, (list, tuple)):
            for item in image_gallery:
                url = str(item or '').strip()
                if url and url not in items:
                    items.append(url)

        primary_image = str(image_url or '').strip()
        if primary_image:
            if primary_image in items:
                items.remove(primary_image)
            items.insert(0, primary_image)

        return items

    def normalize_url_list(raw_value):
        items = []

        if isinstance(raw_value, str):
            try:
                raw_value = json.loads(raw_value)
            except json.JSONDecodeError:
                raw_value = [raw_value]

        if isinstance(raw_value, (list, tuple)):
            for item in raw_value:
                url = str(item or '').strip()
                if url and url not in items:
                    items.append(url)

        return items

    def serialize_investment_row(row):
        investment = dict(row)
        gallery = normalize_investment_gallery(
            investment.get('image_url'),
            investment.get('image_gallery_json')
        )
        investment['image_gallery'] = gallery
        investment['image_url'] = gallery[0] if gallery else str(investment.get('image_url') or '').strip()
        return investment

    def fetch_investment_payload(conn, investment_id):
        row = conn.execute('''
            SELECT
                i.*,
                u.name as admin_name,
                u.public_user_id as publisher_public_user_id,
                u.account_type as publisher_account_type,
                cp.company_name as publisher_company_name,
                cp.logo_url as publisher_company_logo_url,
                cp.verification_status as publisher_company_verification_status,
                cp.description as publisher_company_description,
                cp.website_url as publisher_company_website_url,
                cp.country_name as publisher_company_country_name,
                cp.city as publisher_company_city,
                g.name as governorate_name,
                g.slug as governorate_slug,
                g.symbol as governorate_symbol,
                g.image_url as governorate_image_url,
                g.country_code as governorate_country_code,
                g.country_name as governorate_country_name,
                COUNT(DISTINCT ui.id) as investor_count,
                COALESCE(SUM(ui.amount), 0) as collected
            FROM investments i
            LEFT JOIN users u ON i.added_by = u.id
            LEFT JOIN company_profiles cp ON cp.user_id = u.id
            LEFT JOIN governorates g ON i.governorate_id = g.id
            LEFT JOIN user_investments ui ON i.id = ui.investment_id AND ui.status = 'active'
            WHERE i.id = ?
            GROUP BY i.id
            LIMIT 1
        ''', (investment_id,)).fetchone()
        return serialize_investment_row(row) if row else None

    def serialize_property_listing_row(row):
        listing = dict(row)
        image_gallery = normalize_investment_gallery(
            listing.get('image_url'),
            listing.get('image_gallery_json')
        )
        kyc_documents = normalize_url_list(listing.get('kyc_document_urls_json'))
        listing['image_gallery'] = image_gallery
        listing['image_url'] = image_gallery[0] if image_gallery else str(listing.get('image_url') or '').strip()
        listing['kyc_document_urls'] = kyc_documents
        listing['property_type_label'] = PROPERTY_TYPE_LABELS.get(
            str(listing.get('property_type') or '').strip().lower(),
            str(listing.get('property_type') or 'عقار')
        )
        status = str(listing.get('status') or 'published').strip().lower()
        listing['is_sold'] = status == 'sold'
        listing['status_label'] = 'تم البيع' if status == 'sold' else 'منشور'
        return listing

    def get_property_listing_with_owner(conn, property_id):
        return conn.execute('''
            SELECT
                p.*,
                u.role AS seller_role
            FROM property_listings p
            JOIN users u ON p.seller_id = u.id
            WHERE p.id = ?
            LIMIT 1
        ''', (property_id,)).fetchone()

    def can_manage_property_listing(row, user_id, is_admin=False):
        if not row:
            return False
        if is_admin:
            return True
        return int(row['seller_id']) == int(user_id)

    def compute_property_fee(conn, sale_price):
        mode = str(ctx.get_system_setting(conn, 'property_listing_fee_mode', 'percentage') or 'percentage').strip().lower()
        percentage = float(ctx.get_system_setting(conn, 'property_listing_fee_percentage', 1) or 0)
        fixed_amount = float(ctx.get_system_setting(conn, 'property_listing_fee_fixed_amount', 10) or 0)
        currency_code = str(ctx.get_system_setting(conn, 'property_listing_fee_currency', 'USDT') or 'USDT').strip().upper()
        network_code = str(ctx.get_system_setting(conn, 'property_listing_fee_network', 'TRC20') or 'TRC20').strip().upper()

        if mode == 'percentage':
            fee_value = round(max(0.0, sale_price * (percentage / 100.0)), 8)
        else:
            mode = 'fixed'
            fee_value = round(max(0.0, fixed_amount), 8)

        return {
            'mode': mode,
            'value': fee_value,
            'currency': currency_code,
            'network': network_code
        }

    def compute_company_investment_fee(conn, total_amount):
        mode = str(ctx.get_system_setting(conn, 'company_investment_fee_mode', 'percentage') or 'percentage').strip().lower()
        percentage = float(ctx.get_system_setting(conn, 'company_investment_fee_percentage', 1) or 0)
        fixed_amount = float(ctx.get_system_setting(conn, 'company_investment_fee_fixed_amount', 25) or 0)
        currency_code = str(ctx.get_system_setting(conn, 'company_investment_fee_currency', 'USDT') or 'USDT').strip().upper()
        network_code = str(ctx.get_system_setting(conn, 'company_investment_fee_network', 'TRC20') or 'TRC20').strip().upper()

        if mode == 'percentage':
            fee_value = round(max(0.0, total_amount * (percentage / 100.0)), 8)
        else:
            mode = 'fixed'
            fee_value = round(max(0.0, fixed_amount), 8)

        return {
            'mode': mode,
            'value': fee_value,
            'currency': currency_code,
            'network': network_code
        }

    def compute_company_project_investor_fee(conn, amount, currency_code='USDT', network_code='TRC20'):
        fee = compute_company_investment_fee(conn, amount)
        fee['currency'] = str(currency_code or fee.get('currency') or 'USDT').strip().upper()
        fee['network'] = str(network_code or fee.get('network') or 'TRC20').strip().upper()
        return fee

    def compute_investor_platform_fee(conn, amount):
        percentage = max(0.0, float(ctx.get_system_setting(conn, 'investor_investment_fee_percentage', 0) or 0))
        fee_value = round(max(0.0, float(amount or 0)) * percentage / 100.0, 8)
        return {
            'rate': percentage,
            'value': fee_value
        }

    def resolve_platform_fee_wallet(conn, currency_id, network_id):
        real_money_enabled = bool(ctx.get_system_setting(conn, 'real_money_enabled', False))
        financial_channels_enabled = bool(ctx.get_system_setting(conn, 'financial_channels_enabled', True))

        if real_money_enabled and financial_channels_enabled:
            linked_wallet = conn.execute('''
                SELECT
                    a.id,
                    a.address,
                    a.label
                FROM financial_channels fc
                JOIN admin_wallets a ON a.id = fc.admin_wallet_id
                WHERE fc.is_active = 1
                  AND a.is_active = 1
                  AND fc.admin_wallet_id IS NOT NULL
                  AND fc.currency_id = ?
                  AND fc.network_id = ?
                ORDER BY fc.display_order ASC, fc.id ASC
                LIMIT 1
            ''', (currency_id, network_id)).fetchone()
            if linked_wallet:
                return linked_wallet

        return conn.execute('''
            SELECT id, address, label
            FROM admin_wallets
            WHERE currency_id = ? AND network_id = ? AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
        ''', (currency_id, network_id)).fetchone()

    def seed_syrian_projects_if_empty(conn):
        try:
            count = conn.execute("SELECT COUNT(*) FROM investments").fetchone()[0]
            if count == 0:
                admin = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone()
                admin_id = admin[0] if admin else 1
                investments = [
                    ('أبراج ماروتا سيتي الاستثمارية - دمشق', 'مشروع أبراج سكنية وتجارية فخمة في مشروع تنظيم كفرسوسة ماروتا سيتي بالعاصمة دمشق مع عائد استثماري عالي وخيارات سكنية وتجارية متكاملة.', 350000, 100, 16.5, 24, 'real-estate', 'damascus'),
                    ('مجمع شهباء السكني والتجاري - حلب', 'مشروع إعادة إعمار وتطوير مجمع سكني وتجاري متكامل في حلب الجديدة قرب المراكز الخدمية والأسواق.', 220000, 50, 18.0, 18, 'real-estate', 'aleppo'),
                    ('منتجع الساحل وبارك الأجنحة - اللاذقية', 'شقق وفيلات شاطئية فاخرة مجهزة للإيجار السياحي والاستثمار العقاري الساحلي على كورنيش اللاذقية.', 190000, 50, 17.5, 15, 'real-estate', 'latakia'),
                    ('مول وأبراج النواعير التجارية - حماة', 'مركز تجاري ومكاتب استثمارية وسط مدينة حماة قرب النواعير التاريخية مع عائد شهري مستقر.', 160000, 50, 15.0, 12, 'real-estate', 'hama'),
                    ('مجمع الفيحاء السكني - حمص', 'وحدات سكنية حديثة ومحلات تجارية في موقع حيوي في حمص مع بنية تحتية وخدمات متكاملة.', 140000, 50, 14.5, 18, 'real-estate', 'homs'),
                    ('أبراج الكورنيش البحرية - طرطوس', 'شقق استثمارية ومحلات تجارية ذات إطلالة مباشرة على البحر والميناء في طرطوس.', 210000, 100, 16.0, 20, 'real-estate', 'tartus'),
                    ('ضاحية الأمل العمرانية - ريف دمشق', 'مشروع مجمع سكني واسع في ضواحي دمشق يهدف لتوفير سكن عصري بأسعار مناسبة وعائد ممتاز.', 280000, 50, 15.5, 24, 'real-estate', 'rif-dimashq'),
                    ('مجمع حوران التجاري واللوجستي - درعا', 'سوق تجاري ومحلات ومستودعات على بوابة الجنوب السوري لخدمة حركة التجارة والاستثمار.', 130000, 50, 14.0, 12, 'real-estate', 'daraa'),
                    ('أبراج البازلت السكنية - السويداء', 'مجمع سكني بتصميم بازلتي مميز في موقع مرتفع بالسويداء يوفر إقامة هادئة واستثماراً آمناً.', 120000, 50, 13.5, 15, 'real-estate', 'as-suwayda'),
                    ('مجمع الفرات التجاري - دير الزور', 'مركز خدمات ومحلات تجارية ومكاتب مطلة على نهر الفرات في دير الزور.', 150000, 50, 15.0, 18, 'real-estate', 'deir-ez-zor'),
                    ('مشروع الجزيرة العمراني - الحسكة', 'مجمع مكاتب ومستودعات ومساحات تجارية واعدة في الحسكة لدعم حركة الاستثمار والتنفيذ.', 110000, 50, 14.0, 12, 'real-estate', 'al-hasakah')
                ]
                for inv in investments:
                    gov = conn.execute("SELECT id FROM governorates WHERE slug = ? LIMIT 1", (inv[7],)).fetchone()
                    gov_id = gov[0] if gov else 1
                    conn.execute("""
                        INSERT INTO investments (name, description, total_amount, min_investment, return_rate, duration, category, governorate_id, added_by, status)
                        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active'
                        WHERE NOT EXISTS (SELECT 1 FROM investments WHERE name = ?)
                    """, (inv[0], inv[1], inv[2], inv[3], inv[4], inv[5], inv[6], gov_id, admin_id, inv[0]))
                conn.commit()
        except Exception as e:
            pass

    @app.route('/api/investments', methods=['GET'])
    def get_investments():
        try:
            governorate_id = request.args.get('governorate_id', type=int)
            country_code = str(request.args.get('country_code') or '').strip().upper()
            current_user_id = None
            try:
                ctx.verify_jwt_in_request(optional=True)
                identity = ctx.get_jwt_identity()
                if identity:
                    current_user_id = int(identity)
            except Exception:
                current_user_id = None

            conn = ctx.get_db_connection()
            seed_syrian_projects_if_empty(conn)

            where_clause = "WHERE i.status = 'active'"
            params = []
            if country_code:
                where_clause += " AND g.country_code = ?"
                params.append(country_code)
            if governorate_id:
                where_clause += " AND i.governorate_id = ?"
                params.append(governorate_id)

            investment_rows = [serialize_investment_row(inv) for inv in conn.execute(f'''
                SELECT
                    i.*,
                    u.name as admin_name,
                    u.public_user_id as publisher_public_user_id,
                    u.account_type as publisher_account_type,
                    cp.company_name as publisher_company_name,
                    cp.logo_url as publisher_company_logo_url,
                    cp.verification_status as publisher_company_verification_status,
                    cp.description as publisher_company_description,
                    cp.website_url as publisher_company_website_url,
                    cp.country_name as publisher_company_country_name,
                    cp.city as publisher_company_city,
                    g.name as governorate_name,
                    g.slug as governorate_slug,
                    g.symbol as governorate_symbol,
                    g.image_url as governorate_image_url,
                    g.country_code as governorate_country_code,
                    g.country_name as governorate_country_name,
                    COUNT(DISTINCT ui.id) as investor_count,
                    COALESCE(SUM(ui.amount), 0) as collected
                FROM investments i
                LEFT JOIN users u ON i.added_by = u.id
                LEFT JOIN company_profiles cp ON cp.user_id = u.id
                LEFT JOIN governorates g ON i.governorate_id = g.id
                LEFT JOIN user_investments ui ON i.id = ui.investment_id AND ui.status = 'active'
                {where_clause}
                GROUP BY i.id
                ORDER BY i.created_at DESC
            ''', params).fetchall()]

            if current_user_id:
                for investment in investment_rows:
                    user_position = conn.execute('''
                        SELECT
                            COUNT(*) as active_positions,
                            COALESCE(SUM(amount), 0) as invested_amount,
                            COALESCE(SUM(returns), 0) as distributed_returns
                        FROM user_investments
                        WHERE user_id = ? AND investment_id = ? AND status = 'active'
                    ''', (current_user_id, investment['id'])).fetchone()
                    active_positions = int(user_position['active_positions'] or 0)
                    distributed_returns = float(user_position['distributed_returns'] or 0)
                    investment['current_user_invested_amount'] = float(user_position['invested_amount'] or 0)
                    investment['current_user_can_cancel'] = active_positions > 0 and distributed_returns <= 0
            else:
                for investment in investment_rows:
                    investment['current_user_invested_amount'] = 0.0
                    investment['current_user_can_cancel'] = False

            conn.close()
            return jsonify({
                'success': True,
                'data': {
                    'investments': investment_rows,
                    'total': len(investment_rows)
                }
            }), 200

        except Exception as e:
            print(f"Get investments error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/investments', methods=['POST'])
    @ctx.jwt_required()
    def create_investment():
        try:
            data = request.get_json() or {}
            user_id = int(ctx.get_jwt_identity())

            required_fields = ['name', 'description', 'total_amount', 'min_investment', 'return_rate', 'duration', 'governorate_id']
            for field in required_fields:
                value = data.get(field) if data else None
                if value is None or value == '':
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                total_amount = ctx.parse_positive_float(data['total_amount'], 'total_amount')
                admin_amount = ctx.parse_non_negative_float(data.get('admin_amount', 0), 'admin_amount')
                min_investment = ctx.parse_non_negative_float(data['min_investment'], 'min_investment')
                return_rate = ctx.parse_positive_float(data['return_rate'], 'return_rate')
                duration = int(data['duration'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid numeric investment values', 'code': 'INVALID_INVESTMENT_VALUES'}), 400

            start_date = (data.get('start_date') or '').strip() or None
            end_date = (data.get('end_date') or '').strip() or None
            image_gallery = normalize_investment_gallery(
                data.get('image_url'),
                data.get('image_gallery')
            )
            image_url = image_gallery[0] if image_gallery else ''

            if start_date:
                try:
                    date.fromisoformat(start_date)
                except ValueError:
                    return jsonify({'error': 'Invalid start_date format', 'code': 'INVALID_START_DATE'}), 400

            if end_date:
                try:
                    date.fromisoformat(end_date)
                except ValueError:
                    return jsonify({'error': 'Invalid end_date format', 'code': 'INVALID_END_DATE'}), 400

            if start_date and end_date and date.fromisoformat(end_date) < date.fromisoformat(start_date):
                return jsonify({'error': 'end_date cannot be before start_date', 'code': 'INVALID_PROJECT_DATES'}), 400

            if duration <= 0:
                return jsonify({'error': 'duration must be greater than zero', 'code': 'INVALID_DURATION'}), 400
            if min_investment > total_amount:
                return jsonify({'error': 'min_investment cannot exceed total_amount', 'code': 'INVALID_MIN_INVESTMENT'}), 400
            if admin_amount > total_amount:
                return jsonify({'error': 'admin_amount cannot exceed total_amount', 'code': 'INVALID_ADMIN_AMOUNT'}), 400

            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            publisher = conn.execute('''
                SELECT
                    u.id,
                    u.role,
                    u.account_type,
                    u.kyc_status,
                    cp.id as company_profile_id,
                    cp.verification_status as company_verification_status
                FROM users u
                LEFT JOIN company_profiles cp ON cp.user_id = u.id
                WHERE u.id = ? AND u.is_active = 1
            ''', (user_id,)).fetchone()

            if not publisher:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404

            is_admin_publisher = str(publisher['role'] or '').strip().lower() == 'admin'
            is_company_publisher = str(publisher['account_type'] or '').strip().lower() == 'company'
            if not is_admin_publisher and not is_company_publisher:
                conn.close()
                return jsonify({
                    'error': 'Only admin or company accounts can publish investments',
                    'code': 'INVESTMENT_PUBLISH_FORBIDDEN'
                }), 403

            if is_company_publisher and str(publisher['kyc_status'] or 'not_submitted') != 'verified':
                conn.close()
                return jsonify({
                    'error': 'يجب توثيق حساب الشركة أولاً قبل نشر مشروع استثماري',
                    'code': 'COMPANY_KYC_REQUIRED'
                }), 403

            if is_company_publisher and not publisher['company_profile_id']:
                conn.close()
                return jsonify({
                    'error': 'ملف الشركة غير مكتمل بعد',
                    'code': 'COMPANY_PROFILE_REQUIRED'
                }), 400
            if is_company_publisher and str(publisher['company_verification_status'] or 'draft').strip().lower() != 'verified':
                conn.close()
                return jsonify({
                    'error': 'يجب اعتماد ملف الشركة من الأدمن قبل نشر مشاريع استثمارية باسم الشركة',
                    'code': 'COMPANY_APPROVAL_REQUIRED'
                }), 403

            governorate = conn.execute(
                'SELECT id FROM governorates WHERE id = ? AND is_active = 1',
                (int(data['governorate_id']),)
            ).fetchone()

            if not governorate:
                conn.close()
                return jsonify({'error': 'Governorate not found or inactive', 'code': 'INVALID_GOVERNORATE'}), 400

            fee = {
                'mode': 'fixed',
                'value': 0.0,
                'currency': 'USDT',
                'network': 'TRC20'
            }
            fee = {'mode': 'none', 'value': 0, 'currency': 'USDT', 'network': 'TRC20'}
            fee_transaction_id = None
            platform_fee_charged = False

            if is_company_publisher:
                fee = compute_company_investment_fee(conn, total_amount)
                fee_value = float(fee['value'] or 0)
                if fee_value > 0:
                    currency = conn.execute(
                        'SELECT id, code FROM currencies WHERE code = ? AND is_active = 1',
                        (fee['currency'],)
                    ).fetchone()
                    if not currency:
                        conn.close()
                        return jsonify({'error': 'Company investment fee currency is not configured', 'code': 'COMPANY_FEE_CURRENCY_NOT_CONFIGURED'}), 500

                    network = conn.execute(
                        'SELECT id, code FROM networks WHERE currency_id = ? AND code = ? AND is_active = 1',
                        (currency['id'], fee['network'])
                    ).fetchone()
                    if not network:
                        conn.close()
                        return jsonify({'error': 'Company investment fee network is not configured', 'code': 'COMPANY_FEE_NETWORK_NOT_CONFIGURED'}), 500

                    admin_wallet = resolve_platform_fee_wallet(conn, currency['id'], network['id'])
                    if not admin_wallet:
                        conn.close()
                        return jsonify({'error': 'No active admin wallet available for company investment fee', 'code': 'COMPANY_FEE_WALLET_NOT_CONFIGURED'}), 400

                    wallet = conn.execute('''
                        SELECT balance FROM user_wallets WHERE user_id = ? AND currency_id = ?
                    ''', (user_id, currency['id'])).fetchone()
                    if not wallet or float(wallet['balance'] or 0) < fee_value:
                        conn.close()
                        return jsonify({
                            'error': f'Insufficient balance to pay company investment publishing fee of {fee_value:.8f} {fee["currency"]}',
                            'code': 'INSUFFICIENT_BALANCE'
                        }), 400

                    cursor = conn.cursor()
                    cursor.execute('''
                        UPDATE user_wallets
                        SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ? AND currency_id = ? AND balance >= ?
                    ''', (fee_value, user_id, currency['id'], fee_value))
                    if cursor.rowcount == 0:
                        conn.rollback()
                        conn.close()
                        return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

                    cursor.execute('''
                        UPDATE admin_wallets
                        SET current_balance = current_balance + ?,
                            total_received = total_received + ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (fee_value, fee_value, admin_wallet['id']))

                    tx_hash = f'company-fee-{uuid.uuid4().hex[:18]}'
                    cursor.execute('''
                        INSERT INTO transactions (
                            user_id, type, currency_id, network_id, amount, tx_hash,
                            admin_wallet_address, status, note, verified_at
                        ) VALUES (?, 'company_investment_listing_fee', ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
                    ''', (
                        user_id,
                        currency['id'],
                        network['id'],
                        fee_value,
                        tx_hash,
                        admin_wallet['address'],
                        'Platform fee for publishing investment'
                    ))
                    fee_transaction_id = cursor.lastrowid
                    platform_fee_charged = True

            cursor.execute('''
                INSERT INTO investments (
                    name, description, image_url, image_gallery_json, total_amount, admin_amount, min_investment,
                    return_rate, duration, start_date, end_date, category, governorate_id, added_by,
                    platform_fee_mode, platform_fee_value, platform_fee_currency, platform_fee_network,
                    platform_fee_paid, platform_fee_transaction_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(data['name']).strip(),
                str(data.get('description', '')).strip(),
                image_url,
                json.dumps(image_gallery, ensure_ascii=False),
                total_amount,
                admin_amount,
                min_investment,
                return_rate,
                duration,
                start_date,
                end_date,
                (data.get('category') or 'real-estate').strip(),
                governorate['id'],
                user_id,
                fee['mode'],
                fee['value'],
                fee['currency'],
                fee['network'],
                1 if platform_fee_charged else 0,
                fee_transaction_id
            ))

            investment_id = cursor.lastrowid
            if admin_amount > 0:
                cursor.execute('''
                    INSERT INTO user_investments (user_id, investment_id, amount, status)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, investment_id, admin_amount, 'active'))
                cursor.execute('''
                    UPDATE investments SET collected = collected + ? WHERE id = ?
                ''', (admin_amount, investment_id))

            conn.commit()
            investment_payload = fetch_investment_payload(conn, investment_id)
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم إنشاء الاستثمار بنجاح',
                'data': {
                    'investment_id': investment_id,
                    'investment': investment_payload,
                    'platform_fee': fee,
                    'platform_fee_charged': platform_fee_charged
                }
            }), 201

        except Exception as e:
            print(f"Create investment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties', methods=['GET'])
    def get_property_listings():
        try:
            governorate_id = request.args.get('governorate_id', type=int)
            country_code = str(request.args.get('country_code') or '').strip().upper()
            conn = ctx.get_db_connection()
            params = []
            where_clause = "WHERE p.status IN ('published', 'sold')"
            if country_code:
                where_clause += ' AND g.country_code = ?'
                params.append(country_code)
            if governorate_id:
                where_clause += ' AND p.governorate_id = ?'
                params.append(governorate_id)

            listings = conn.execute(f'''
                SELECT
                    p.*,
                    u.name AS seller_name,
                    u.public_user_id AS seller_public_user_id,
                    g.name AS governorate_name,
                    g.slug AS governorate_slug,
                    g.symbol AS governorate_symbol,
                    g.image_url AS governorate_image_url,
                    g.country_code AS governorate_country_code,
                    g.country_name AS governorate_country_name
                FROM property_listings p
                JOIN users u ON p.seller_id = u.id
                LEFT JOIN governorates g ON p.governorate_id = g.id
                {where_clause}
                ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC
            ''', params).fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'properties': [serialize_property_listing_row(item) for item in listings],
                    'total': len(listings)
                }
            }), 200
        except Exception as e:
            print(f"Get property listings error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties/assets/upload', methods=['POST'])
    @ctx.jwt_required()
    def upload_property_assets():
        try:
            category = str(request.form.get('category') or 'images').strip().lower()
            files = request.files.getlist('files')
            if not files:
                single_file = request.files.get('file')
                files = [single_file] if single_file else []

            valid_files = [file for file in files if file and file.filename]
            if not valid_files:
                return jsonify({'error': 'No files provided', 'code': 'NO_FILE'}), 400

            if len(valid_files) > 12:
                return jsonify({'error': 'Maximum 12 files per upload', 'code': 'TOO_MANY_FILES'}), 400

            uploaded_urls = []
            for file in valid_files:
                mime = str(file.mimetype or '').lower()
                if category == 'kyc':
                    if not (mime.startswith('image/') or mime == 'application/pdf'):
                        return jsonify({'error': 'KYC supports images or PDF only', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400
                elif not mime.startswith('image/'):
                    return jsonify({'error': 'Only image files are supported', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400

                safe_name = secure_filename(file.filename) or f'{category}-file'
                extension = os.path.splitext(safe_name)[1] or ('.pdf' if mime == 'application/pdf' else '.jpg')
                generated_name = f"property_{category}_{uuid.uuid4().hex[:18]}{extension}"
                save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], generated_name)
                file.save(save_path)
                uploaded_urls.append(f'/uploads/{generated_name}')

            return jsonify({
                'success': True,
                'message': 'تم رفع ملفات العقار بنجاح',
                'data': {
                    'file_urls': uploaded_urls
                }
            }), 201
        except Exception as e:
            print(f"Upload property assets error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties', methods=['POST'])
    @ctx.jwt_required()
    def create_property_listing():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}

            required_fields = [
                'title', 'description', 'property_type', 'sale_price', 'address',
                'governorate_id', 'contact_name', 'contact_phone'
            ]
            for field in required_fields:
                value = data.get(field)
                if value is None or str(value).strip() == '':
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                sale_price = ctx.parse_positive_float(data['sale_price'], 'sale_price')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_PRICE'}), 400

            area_size = None
            if data.get('area_size') not in (None, ''):
                try:
                    area_size = ctx.parse_positive_float(data['area_size'], 'area_size')
                except ValueError as e:
                    return jsonify({'error': str(e), 'code': 'INVALID_AREA'}), 400

            property_type = str(data.get('property_type') or '').strip().lower()
            if property_type not in PROPERTY_TYPE_LABELS:
                return jsonify({'error': 'Invalid property type', 'code': 'INVALID_PROPERTY_TYPE'}), 400

            image_gallery = normalize_investment_gallery('', data.get('image_gallery'))
            if not image_gallery:
                return jsonify({'error': 'At least one property image is required', 'code': 'PROPERTY_IMAGES_REQUIRED'}), 400

            contact_email = str(data.get('contact_email') or '').strip()
            if contact_email:
                try:
                    contact_email = ctx.validate_email(contact_email)
                except Exception as e:
                    return jsonify({'error': str(e), 'code': 'INVALID_CONTACT_EMAIL'}), 400

            conn = ctx.get_db_connection()
            seller = conn.execute(
                'SELECT id, kyc_status FROM users WHERE id = ? AND is_active = 1',
                (user_id,)
            ).fetchone()
            if not seller:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
            if str(seller['kyc_status'] or 'not_submitted') != 'verified':
                conn.close()
                return jsonify({
                    'error': 'يجب توثيق الحساب أولًا قبل نشر العقار للبيع',
                    'code': 'ACCOUNT_KYC_REQUIRED'
                }), 403
            governorate = conn.execute(
                'SELECT id, name FROM governorates WHERE id = ? AND is_active = 1',
                (int(data['governorate_id']),)
            ).fetchone()
            if not governorate:
                conn.close()
                return jsonify({'error': 'Governorate not found or inactive', 'code': 'INVALID_GOVERNORATE'}), 400

            fee = compute_property_fee(conn, sale_price)
            fee_value = float(fee['value'] or 0)
            fee_transaction_id = None
            currency = None
            network = None
            admin_wallet = None
            cursor = conn.cursor()

            if fee_value > 0:
                currency = conn.execute(
                    'SELECT id, code FROM currencies WHERE code = ? AND is_active = 1',
                    (fee['currency'],)
                ).fetchone()
                if not currency:
                    conn.close()
                    return jsonify({'error': 'Property listing fee currency is not configured', 'code': 'PROPERTY_FEE_CURRENCY_NOT_CONFIGURED'}), 500

                network = conn.execute(
                    'SELECT id, code FROM networks WHERE currency_id = ? AND code = ? AND is_active = 1',
                    (currency['id'], fee['network'])
                ).fetchone()
                if not network:
                    conn.close()
                    return jsonify({'error': 'Property listing fee network is not configured', 'code': 'PROPERTY_FEE_NETWORK_NOT_CONFIGURED'}), 500

                admin_wallet = resolve_platform_fee_wallet(conn, currency['id'], network['id'])
                if not admin_wallet:
                    conn.close()
                    return jsonify({'error': 'No active admin wallet available for property listing fee', 'code': 'PROPERTY_FEE_WALLET_NOT_CONFIGURED'}), 400

                wallet = conn.execute('''
                    SELECT balance
                    FROM user_wallets
                    WHERE user_id = ? AND currency_id = ?
                ''', (user_id, currency['id'])).fetchone()
                if not wallet or float(wallet['balance'] or 0) < fee_value:
                    conn.close()
                    return jsonify({
                        'error': f'Insufficient balance to pay property listing fee of {fee_value:.8f} {fee["currency"]}',
                        'code': 'INSUFFICIENT_BALANCE'
                    }), 400

                cursor.execute('''
                    UPDATE user_wallets
                    SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND currency_id = ? AND balance >= ?
                ''', (fee_value, user_id, currency['id'], fee_value))
                if cursor.rowcount == 0:
                    conn.rollback()
                    conn.close()
                    return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

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
                    ) VALUES (?, 'property_listing_fee', ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
                ''', (
                    user_id,
                    currency['id'],
                    network['id'],
                    fee_value,
                    f'property-fee-{uuid.uuid4().hex[:18]}',
                    admin_wallet['address'],
                    f'Property listing fee for {str(data["title"]).strip()}'
                ))
                fee_transaction_id = cursor.lastrowid

            cursor.execute('''
                INSERT INTO property_listings (
                    seller_id, title, description, property_type, sale_price, area_size, address,
                    governorate_id, image_url, image_gallery_json, kyc_document_urls_json,
                    contact_name, contact_phone, contact_email,
                    platform_fee_mode, platform_fee_value, platform_fee_currency, platform_fee_network,
                    platform_fee_paid, platform_fee_transaction_id, status, published_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''', (
                user_id,
                str(data['title']).strip(),
                str(data['description']).strip(),
                property_type,
                sale_price,
                area_size,
                str(data['address']).strip(),
                governorate['id'],
                image_gallery[0],
                json.dumps(image_gallery, ensure_ascii=False),
                None,
                str(data['contact_name']).strip(),
                str(data['contact_phone']).strip(),
                contact_email or None,
                fee['mode'],
                fee['value'],
                fee['currency'],
                fee['network'],
                1,
                fee_transaction_id
            ))
            property_id = cursor.lastrowid
            conn.commit()

            created_listing = conn.execute('''
                SELECT
                    p.*,
                    u.name AS seller_name,
                    u.public_user_id AS seller_public_user_id,
                    g.name AS governorate_name,
                    g.slug AS governorate_slug,
                    g.symbol AS governorate_symbol,
                    g.image_url AS governorate_image_url,
                    g.country_code AS governorate_country_code,
                    g.country_name AS governorate_country_name
                FROM property_listings p
                JOIN users u ON p.seller_id = u.id
                LEFT JOIN governorates g ON p.governorate_id = g.id
                WHERE p.id = ?
                LIMIT 1
            ''', (property_id,)).fetchone()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم نشر العقار مباشرة بعد دفع رسوم المنصة والتحقق من الشروط',
                'data': {
                    'property_id': property_id,
                    'property': serialize_property_listing_row(created_listing),
                    'platform_fee': fee
                }
            }), 201
        except Exception as e:
            print(f"Create property listing error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties/<int:property_id>', methods=['PUT'])
    @ctx.jwt_required()
    def update_property_listing(property_id):
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json() or {}
            conn = ctx.get_db_connection()
            actor = conn.execute(
                'SELECT id, role FROM users WHERE id = ? AND is_active = 1',
                (user_id,)
            ).fetchone()
            listing = get_property_listing_with_owner(conn, property_id)

            if not actor:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
            if not listing:
                conn.close()
                return jsonify({'error': 'Property not found', 'code': 'PROPERTY_NOT_FOUND'}), 404

            is_admin = str(actor['role'] or '').strip().lower() == 'admin'
            if not can_manage_property_listing(listing, user_id, is_admin):
                conn.close()
                return jsonify({'error': 'You cannot edit this property', 'code': 'PROPERTY_EDIT_FORBIDDEN'}), 403

            required_fields = [
                'title', 'description', 'property_type', 'sale_price', 'address',
                'governorate_id', 'contact_name', 'contact_phone'
            ]
            for field in required_fields:
                value = data.get(field)
                if value is None or str(value).strip() == '':
                    conn.close()
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                sale_price = ctx.parse_positive_float(data['sale_price'], 'sale_price')
            except ValueError as e:
                conn.close()
                return jsonify({'error': str(e), 'code': 'INVALID_PRICE'}), 400

            area_size = None
            if data.get('area_size') not in (None, ''):
                try:
                    area_size = ctx.parse_positive_float(data['area_size'], 'area_size')
                except ValueError as e:
                    conn.close()
                    return jsonify({'error': str(e), 'code': 'INVALID_AREA'}), 400

            property_type = str(data.get('property_type') or '').strip().lower()
            if property_type not in PROPERTY_TYPE_LABELS:
                conn.close()
                return jsonify({'error': 'Invalid property type', 'code': 'INVALID_PROPERTY_TYPE'}), 400

            image_gallery = normalize_investment_gallery('', data.get('image_gallery'))
            if not image_gallery:
                conn.close()
                return jsonify({'error': 'At least one property image is required', 'code': 'PROPERTY_IMAGES_REQUIRED'}), 400

            contact_email = str(data.get('contact_email') or '').strip()
            if contact_email:
                try:
                    contact_email = ctx.validate_email(contact_email)
                except Exception as e:
                    conn.close()
                    return jsonify({'error': str(e), 'code': 'INVALID_CONTACT_EMAIL'}), 400

            governorate = conn.execute(
                'SELECT id FROM governorates WHERE id = ? AND is_active = 1',
                (int(data['governorate_id']),)
            ).fetchone()
            if not governorate:
                conn.close()
                return jsonify({'error': 'Governorate not found or inactive', 'code': 'INVALID_GOVERNORATE'}), 400

            conn.execute('''
                UPDATE property_listings
                SET
                    title = ?,
                    description = ?,
                    property_type = ?,
                    sale_price = ?,
                    area_size = ?,
                    address = ?,
                    governorate_id = ?,
                    image_url = ?,
                    image_gallery_json = ?,
                    contact_name = ?,
                    contact_phone = ?,
                    contact_email = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                str(data['title']).strip(),
                str(data['description']).strip(),
                property_type,
                sale_price,
                area_size,
                str(data['address']).strip(),
                int(governorate['id']),
                image_gallery[0],
                json.dumps(image_gallery, ensure_ascii=False),
                str(data['contact_name']).strip(),
                str(data['contact_phone']).strip(),
                contact_email or None,
                property_id
            ))
            conn.commit()

            updated_listing = conn.execute('''
                SELECT
                    p.*,
                    u.name AS seller_name,
                    u.public_user_id AS seller_public_user_id,
                    g.name AS governorate_name,
                    g.slug AS governorate_slug,
                    g.symbol AS governorate_symbol,
                    g.image_url AS governorate_image_url,
                    g.country_code AS governorate_country_code,
                    g.country_name AS governorate_country_name
                FROM property_listings p
                JOIN users u ON p.seller_id = u.id
                LEFT JOIN governorates g ON p.governorate_id = g.id
                WHERE p.id = ?
                LIMIT 1
            ''', (property_id,)).fetchone()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تحديث العقار بنجاح',
                'data': {
                    'property': serialize_property_listing_row(updated_listing)
                }
            }), 200
        except Exception as e:
            print(f"Update property listing error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties/<int:property_id>', methods=['DELETE'])
    @ctx.jwt_required()
    def delete_property_listing(property_id):
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            actor = conn.execute(
                'SELECT id, role FROM users WHERE id = ? AND is_active = 1',
                (user_id,)
            ).fetchone()
            listing = get_property_listing_with_owner(conn, property_id)

            if not actor:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
            if not listing:
                conn.close()
                return jsonify({'error': 'Property not found', 'code': 'PROPERTY_NOT_FOUND'}), 404

            is_admin = str(actor['role'] or '').strip().lower() == 'admin'
            if not can_manage_property_listing(listing, user_id, is_admin):
                conn.close()
                return jsonify({'error': 'You cannot delete this property', 'code': 'PROPERTY_DELETE_FORBIDDEN'}), 403

            conn.execute('DELETE FROM property_listings WHERE id = ?', (property_id,))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'تم حذف العقار بنجاح'}), 200
        except Exception as e:
            print(f"Delete property listing error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/properties/<int:property_id>/mark-sold', methods=['POST'])
    @ctx.jwt_required()
    def mark_property_listing_as_sold(property_id):
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()
            actor = conn.execute(
                'SELECT id, role FROM users WHERE id = ? AND is_active = 1',
                (user_id,)
            ).fetchone()
            listing = get_property_listing_with_owner(conn, property_id)

            if not actor:
                conn.close()
                return jsonify({'error': 'User not found', 'code': 'USER_NOT_FOUND'}), 404
            if not listing:
                conn.close()
                return jsonify({'error': 'Property not found', 'code': 'PROPERTY_NOT_FOUND'}), 404

            is_admin = str(actor['role'] or '').strip().lower() == 'admin'
            if not can_manage_property_listing(listing, user_id, is_admin):
                conn.close()
                return jsonify({'error': 'You cannot update this property status', 'code': 'PROPERTY_STATUS_FORBIDDEN'}), 403

            conn.execute('''
                UPDATE property_listings
                SET status = 'sold', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (property_id,))
            conn.commit()

            updated_listing = conn.execute('''
                SELECT
                    p.*,
                    u.name AS seller_name,
                    u.public_user_id AS seller_public_user_id,
                    g.name AS governorate_name,
                    g.slug AS governorate_slug,
                    g.symbol AS governorate_symbol,
                    g.image_url AS governorate_image_url,
                    g.country_code AS governorate_country_code,
                    g.country_name AS governorate_country_name
                FROM property_listings p
                JOIN users u ON p.seller_id = u.id
                LEFT JOIN governorates g ON p.governorate_id = g.id
                WHERE p.id = ?
                LIMIT 1
            ''', (property_id,)).fetchone()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تعليم العقار على أنه مباع',
                'data': {
                    'property': serialize_property_listing_row(updated_listing)
                }
            }), 200
        except Exception as e:
            print(f"Mark property listing sold error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/investments/<int:investment_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_investment(investment_id):
        try:
            conn = ctx.get_db_connection()
            investment = conn.execute(
                'SELECT id, status, collected FROM investments WHERE id = ?',
                (investment_id,)
            ).fetchone()
            if not investment:
                conn.close()
                return jsonify({'error': 'Investment not found', 'code': 'INVESTMENT_NOT_FOUND'}), 404
            if investment['collected'] > 0:
                conn.close()
                return jsonify({
                    'error': 'Cannot delete investment with collected funds',
                    'code': 'INVESTMENT_HAS_FUNDS'
                }), 400

            cursor = conn.cursor()
            cursor.execute('DELETE FROM investments WHERE id = ?', (investment_id,))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'تم حذف الاستثمار بنجاح'}), 200

        except Exception as e:
            print(f"Delete investment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/investments/<int:investment_id>', methods=['PUT'])
    @ctx.admin_required
    def update_investment(investment_id):
        try:
            data = request.get_json() or {}

            required_fields = ['name', 'description', 'total_amount', 'min_investment', 'return_rate', 'duration', 'governorate_id']
            for field in required_fields:
                value = data.get(field)
                if value is None or value == '':
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                total_amount = ctx.parse_positive_float(data['total_amount'], 'total_amount')
                min_investment = ctx.parse_non_negative_float(data['min_investment'], 'min_investment')
                return_rate = ctx.parse_positive_float(data['return_rate'], 'return_rate')
                duration = int(data['duration'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid numeric investment values', 'code': 'INVALID_INVESTMENT_VALUES'}), 400

            start_date = (data.get('start_date') or '').strip() or None
            end_date = (data.get('end_date') or '').strip() or None
            image_gallery = normalize_investment_gallery(
                data.get('image_url'),
                data.get('image_gallery')
            )
            image_url = image_gallery[0] if image_gallery else ''

            if start_date:
                try:
                    date.fromisoformat(start_date)
                except ValueError:
                    return jsonify({'error': 'Invalid start_date format', 'code': 'INVALID_START_DATE'}), 400

            if end_date:
                try:
                    date.fromisoformat(end_date)
                except ValueError:
                    return jsonify({'error': 'Invalid end_date format', 'code': 'INVALID_END_DATE'}), 400

            if start_date and end_date and date.fromisoformat(end_date) < date.fromisoformat(start_date):
                return jsonify({'error': 'end_date cannot be before start_date', 'code': 'INVALID_PROJECT_DATES'}), 400

            if duration <= 0:
                return jsonify({'error': 'duration must be greater than zero', 'code': 'INVALID_DURATION'}), 400
            if min_investment > total_amount:
                return jsonify({'error': 'min_investment cannot exceed total_amount', 'code': 'INVALID_MIN_INVESTMENT'}), 400

            conn = ctx.get_db_connection()
            investment = conn.execute(
                'SELECT id, collected, admin_amount FROM investments WHERE id = ?',
                (investment_id,)
            ).fetchone()
            if not investment:
                conn.close()
                return jsonify({'error': 'Investment not found', 'code': 'INVESTMENT_NOT_FOUND'}), 404

            if float(investment['collected'] or 0) > total_amount:
                conn.close()
                return jsonify({
                    'error': 'total_amount cannot be less than collected funds',
                    'code': 'INVALID_TOTAL_AMOUNT'
                }), 400

            governorate = conn.execute(
                'SELECT id FROM governorates WHERE id = ? AND is_active = 1',
                (int(data['governorate_id']),)
            ).fetchone()
            if not governorate:
                conn.close()
                return jsonify({'error': 'Governorate not found or inactive', 'code': 'INVALID_GOVERNORATE'}), 400

            conn.execute('''
                UPDATE investments
                SET
                    name = ?,
                    description = ?,
                    image_url = ?,
                    image_gallery_json = ?,
                    total_amount = ?,
                    min_investment = ?,
                    return_rate = ?,
                    duration = ?,
                    start_date = ?,
                    end_date = ?,
                    category = ?,
                    governorate_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                str(data['name']).strip(),
                str(data.get('description', '')).strip(),
                image_url,
                json.dumps(image_gallery, ensure_ascii=False),
                total_amount,
                min_investment,
                return_rate,
                duration,
                start_date,
                end_date,
                (data.get('category') or 'real-estate').strip(),
                governorate['id'],
                investment_id
            ))
            conn.commit()
            investment_payload = fetch_investment_payload(conn, investment_id)
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم تحديث المشروع بنجاح',
                'data': {
                    'investment_id': investment_id,
                    'investment': investment_payload
                }
            }), 200

        except Exception as e:
            print(f"Update investment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/governorates', methods=['GET'])
    def get_governorates():
        try:
            country_code = str(request.args.get('country_code') or '').strip().upper()
            detected_country = ctx.detect_country_from_request(request)
            conn = ctx.get_db_connection()
            params = []
            where_clause = 'WHERE g.is_active = 1'
            if country_code:
                where_clause += ' AND g.country_code = ?'
                params.append(country_code)
            rows = conn.execute(f'''
                SELECT g.*,
                    (SELECT COUNT(*) FROM investments i WHERE i.governorate_id = g.id AND i.status = 'active') as investment_count
                FROM governorates g
                {where_clause}
                ORDER BY g.country_name, g.name
            ''', params).fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'governorates': [dict(row) for row in rows],
                    'countries': ctx.middle_east_countries,
                    'detected_country_code': detected_country['code'],
                    'detected_country_name': detected_country['name']
                }
            }), 200

        except Exception as e:
            print(f"Get governorates error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/governorates', methods=['GET'])
    @ctx.admin_required
    def admin_get_governorates():
        try:
            conn = ctx.get_db_connection()
            rows = conn.execute('''
                SELECT g.*,
                    (SELECT COUNT(*) FROM investments i WHERE i.governorate_id = g.id AND i.status = 'active') as investment_count
                FROM governorates g
                ORDER BY g.country_name, g.name
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'governorates': [dict(row) for row in rows],
                    'countries': ctx.middle_east_countries
                }
            }), 200

        except Exception as e:
            print(f"Admin get governorates error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/governorates', methods=['POST'])
    @ctx.admin_required
    def admin_create_governorate():
        try:
            data = request.get_json() or {}
            name = (data.get('name') or '').strip()
            if not name:
                return jsonify({'error': 'Missing required field: name', 'code': 'MISSING_FIELD'}), 400

            slug = (data.get('slug') or ctx.slugify_governorate(name)).strip()
            country = ctx.resolve_country_info(data.get('country_code'))
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO governorates (name, slug, description, symbol, image_url, country_code, country_name, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                name,
                slug,
                (data.get('description') or '').strip(),
                (data.get('symbol') or '').strip(),
                (data.get('image_url') or '').strip(),
                country['code'],
                country['name'],
                1 if data.get('is_active', True) else 0
            ))
            governorate_id = cursor.lastrowid
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تمت إضافة المحافظة بنجاح',
                'data': {'governorate_id': governorate_id}
            }), 201

        except sqlite3.IntegrityError:
            return jsonify({'error': 'Governorate name or slug already exists', 'code': 'GOVERNORATE_EXISTS'}), 409
        except Exception as e:
            print(f"Create governorate error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/governorates/<int:governorate_id>', methods=['PUT'])
    @ctx.admin_required
    def admin_update_governorate(governorate_id):
        try:
            data = request.get_json() or {}
            conn = ctx.get_db_connection()
            governorate = conn.execute('SELECT id FROM governorates WHERE id = ?', (governorate_id,)).fetchone()
            if not governorate:
                conn.close()
                return jsonify({'error': 'Governorate not found', 'code': 'GOVERNORATE_NOT_FOUND'}), 404

            cursor = conn.cursor()
            country = ctx.resolve_country_info(data.get('country_code')) if data.get('country_code') else None
            cursor.execute('''
                UPDATE governorates
                SET name = COALESCE(?, name),
                    slug = COALESCE(?, slug),
                    description = COALESCE(?, description),
                    symbol = COALESCE(?, symbol),
                    image_url = COALESCE(?, image_url),
                    country_code = COALESCE(?, country_code),
                    country_name = COALESCE(?, country_name),
                    is_active = COALESCE(?, is_active),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data.get('name'),
                data.get('slug'),
                data.get('description'),
                data.get('symbol'),
                data.get('image_url'),
                country['code'] if country else None,
                country['name'] if country else None,
                1 if data.get('is_active') is True else 0 if data.get('is_active') is False else None,
                governorate_id
            ))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'تم تحديث المحافظة بنجاح'}), 200

        except sqlite3.IntegrityError:
            return jsonify({'error': 'Governorate name or slug already exists', 'code': 'GOVERNORATE_EXISTS'}), 409
        except Exception as e:
            print(f"Update governorate error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/governorates/<int:governorate_id>', methods=['DELETE'])
    @ctx.admin_required
    def admin_delete_governorate(governorate_id):
        try:
            conn = ctx.get_db_connection()
            linked = conn.execute(
                'SELECT COUNT(*) as count FROM investments WHERE governorate_id = ?',
                (governorate_id,)
            ).fetchone()

            cursor = conn.cursor()
            if linked and linked['count'] > 0:
                cursor.execute(
                    'UPDATE governorates SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    (governorate_id,)
                )
                message = 'تم تعطيل المحافظة لأنها مرتبطة باستثمارات'
            else:
                cursor.execute('DELETE FROM governorates WHERE id = ?', (governorate_id,))
                message = 'تم حذف المحافظة بنجاح'

            if cursor.rowcount == 0:
                conn.close()
                return jsonify({'error': 'Governorate not found', 'code': 'GOVERNORATE_NOT_FOUND'}), 404

            conn.commit()
            conn.close()
            return jsonify({'success': True, 'message': message}), 200

        except Exception as e:
            print(f"Delete governorate error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/invest', methods=['POST'])
    @ctx.jwt_required()
    def invest():
        try:
            user_id = int(ctx.get_jwt_identity())
            data = request.get_json()

            required_fields = ['investment_id', 'amount']
            for field in required_fields:
                value = data.get(field) if data else None
                if value is None or value == '':
                    return jsonify({'error': f'Missing required field: {field}', 'code': 'MISSING_FIELD'}), 400

            try:
                amount = ctx.parse_positive_float(data['amount'], 'amount')
            except ValueError as e:
                return jsonify({'error': str(e), 'code': 'INVALID_AMOUNT'}), 400

            investment_id = int(data['investment_id'])
            conn = ctx.get_db_connection()

            investment = conn.execute('''
                SELECT
                    i.*,
                    u.account_type AS publisher_account_type,
                    cp.id AS publisher_company_profile_id,
                    cp.verification_status AS publisher_company_verification_status
                FROM investments i
                LEFT JOIN users u ON i.added_by = u.id
                LEFT JOIN company_profiles cp ON cp.user_id = u.id
                WHERE i.id = ? AND i.status = 'active'
            ''', (investment_id,)).fetchone()
            if not investment:
                conn.close()
                return jsonify({'error': 'Investment not found or inactive', 'code': 'INVESTMENT_NOT_FOUND'}), 404
            if amount < investment['min_investment']:
                conn.close()
                return jsonify({
                    'error': f'Minimum investment is ${investment["min_investment"]}',
                    'code': 'MIN_INVESTMENT'
                }), 400

            remaining_capacity = investment['total_amount'] - investment['collected']
            if amount > remaining_capacity:
                conn.close()
                return jsonify({
                    'error': f'Investment remaining capacity is ${remaining_capacity:.2f}',
                    'code': 'INVESTMENT_CAPACITY_EXCEEDED'
                }), 400

            user = conn.execute('SELECT role FROM users WHERE id = ?', (user_id,)).fetchone()
            if user and user['role'] == 'admin':
                conn.close()
                return jsonify({'error': 'Admin cannot invest in their own projects', 'code': 'ADMIN_CANNOT_INVEST'}), 403

            currency_code = (data.get('currency') or 'USDT').upper()
            network_code = (data.get('network') or 'TRC20').upper()
            if currency_code != 'USDT':
                conn.close()
                return jsonify({
                    'error': 'Investment payments currently support USDT only',
                    'code': 'DIGITAL_CURRENCY_NOT_SUPPORTED'
                }), 400

            payment_currency = conn.execute(
                'SELECT id, code FROM currencies WHERE code = ? AND is_active = 1',
                (currency_code,)
            ).fetchone()
            if not payment_currency:
                conn.close()
                return jsonify({'error': 'USDT currency not configured', 'code': 'USDT_NOT_CONFIGURED'}), 500

            payment_network = conn.execute('''
                SELECT id, fee_percentage, fee_fixed, min_amount
                FROM networks
                WHERE currency_id = ? AND code = ? AND is_active = 1
            ''', (payment_currency['id'], network_code)).fetchone()
            if not payment_network:
                conn.close()
                return jsonify({'error': 'Invalid payment network for USDT', 'code': 'INVALID_PAYMENT_NETWORK'}), 400
            if amount < payment_network['min_amount']:
                conn.close()
                return jsonify({
                    'error': f'Minimum payment amount on {network_code} is {payment_network["min_amount"]} USDT',
                    'code': 'MIN_PAYMENT_AMOUNT'
                }), 400

            network_fee = (amount * payment_network['fee_percentage'] / 100) + payment_network['fee_fixed']
            platform_fee_meta = compute_investor_platform_fee(conn, amount)
            platform_fee = float(platform_fee_meta['value'] or 0)
            is_company_project = (
                str(investment['publisher_account_type'] or '').strip().lower() == 'company'
                and bool(investment['publisher_company_profile_id'])
                and str(investment['publisher_company_verification_status'] or 'draft').strip().lower() == 'verified'
            )
            company_fee_meta = compute_company_project_investor_fee(
                conn,
                amount,
                payment_currency['code'],
                network_code
            ) if is_company_project else {
                'mode': 'fixed',
                'value': 0.0,
                'currency': payment_currency['code'],
                'network': network_code
            }
            company_fee = float(company_fee_meta['value'] or 0)
            total_platform_fee = platform_fee + company_fee
            total_payment = amount + network_fee + total_platform_fee

            admin_wallet = None
            if total_platform_fee > 0:
                admin_wallet = resolve_platform_fee_wallet(conn, payment_currency['id'], payment_network['id'])
                if not admin_wallet:
                    conn.close()
                    return jsonify({
                        'error': 'No active admin wallet available for investment commissions on this network',
                        'code': 'INVESTMENT_COMMISSION_WALLET_NOT_CONFIGURED'
                    }), 400
            wallet = conn.execute('''
                SELECT balance FROM user_wallets
                WHERE user_id = ? AND currency_id = ?
            ''', (user_id, payment_currency['id'])).fetchone()

            if not wallet or wallet['balance'] < total_payment:
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance - ?
                WHERE user_id = ? AND currency_id = ? AND balance >= ?
            ''', (total_payment, user_id, payment_currency['id'], total_payment))
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Insufficient balance', 'code': 'INSUFFICIENT_BALANCE'}), 400

            company_fee_transaction_id = None
            if company_fee > 0 and admin_wallet:
                cursor.execute('''
                    UPDATE admin_wallets
                    SET current_balance = current_balance + ?,
                        total_received = total_received + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (company_fee, company_fee, admin_wallet['id']))

                cursor.execute('''
                    INSERT INTO transactions (
                        user_id, type, currency_id, network_id, amount, tx_hash,
                        admin_wallet_address, status, note, verified_at
                    ) VALUES (?, 'company_project_investment_fee', ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
                ''', (
                    user_id,
                    payment_currency['id'],
                    payment_network['id'],
                    company_fee,
                    f'company-project-investment-fee-{uuid.uuid4().hex[:18]}',
                    admin_wallet['address'],
                    f'Company project investment fee for investment #{investment_id}'
                ))
                company_fee_transaction_id = cursor.lastrowid

            platform_fee_transaction_id = None
            if platform_fee > 0 and admin_wallet:
                cursor.execute('''
                    UPDATE admin_wallets
                    SET current_balance = current_balance + ?,
                        total_received = total_received + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (platform_fee, platform_fee, admin_wallet['id']))

                cursor.execute('''
                    INSERT INTO transactions (
                        user_id, type, currency_id, network_id, amount, tx_hash,
                        admin_wallet_address, status, note, verified_at
                    ) VALUES (?, 'investment_platform_fee', ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)
                ''', (
                    user_id,
                    payment_currency['id'],
                    payment_network['id'],
                    platform_fee,
                    f'investment-platform-fee-{uuid.uuid4().hex[:18]}',
                    admin_wallet['address'],
                    f'Platform fee for investment #{investment_id} at rate {platform_fee_meta["rate"]:.4f}%'
                ))
                platform_fee_transaction_id = cursor.lastrowid

            cursor.execute('''
                INSERT INTO user_investments (user_id, investment_id, amount, status)
                VALUES (?, ?, ?, 'active')
            ''', (user_id, investment_id, amount))

            cursor.execute('''
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount, status, note
                ) VALUES (?, 'investment', ?, ?, ?, 'completed', ?)
            ''', (
                user_id,
                payment_currency['id'],
                payment_network['id'],
                total_payment,
                f'Investment #{investment_id}: principal {amount:.8f} USDT, platform fee {platform_fee:.8f} USDT, company fee {company_fee:.8f} USDT, digital fee {network_fee:.8f} USDT'
            ))

            cursor.execute('''
                UPDATE investments
                SET collected = collected + ?
                WHERE id = ? AND collected + ? <= total_amount
            ''', (amount, investment_id, amount))
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Investment capacity exceeded', 'code': 'INVESTMENT_CAPACITY_EXCEEDED'}), 400

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': f'تم استثمار ${amount:.2f} بنجاح',
                'data': {
                    'investment_id': investment_id,
                    'amount': amount,
                    'fee': network_fee,
                    'network_fee': network_fee,
                    'platform_fee': platform_fee,
                    'platform_fee_rate': platform_fee_meta['rate'],
                    'platform_fee_transaction_id': platform_fee_transaction_id,
                    'company_fee': company_fee,
                    'company_fee_mode': company_fee_meta.get('mode', 'fixed'),
                    'company_fee_transaction_id': company_fee_transaction_id,
                    'total_platform_fee': total_platform_fee,
                    'total_payment': total_payment,
                    'currency': currency_code,
                    'network': network_code,
                    'status': 'active'
                }
            }), 201

        except Exception as e:
            print(f"Invest error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/investments/<int:investment_id>/cancel', methods=['POST'])
    @ctx.jwt_required()
    def cancel_investment(investment_id):
        try:
            user_id = int(ctx.get_jwt_identity())
            conn = ctx.get_db_connection()

            user = conn.execute('SELECT role FROM users WHERE id = ?', (user_id,)).fetchone()
            if user and user['role'] == 'admin':
                conn.close()
                return jsonify({'error': 'Admin cannot cancel investment positions here', 'code': 'ADMIN_CANNOT_CANCEL'}), 403

            investment = conn.execute(
                'SELECT id, name, collected FROM investments WHERE id = ?',
                (investment_id,)
            ).fetchone()
            if not investment:
                conn.close()
                return jsonify({'error': 'Investment not found', 'code': 'INVESTMENT_NOT_FOUND'}), 404

            positions = conn.execute('''
                SELECT COUNT(*) as active_positions,
                       COALESCE(SUM(amount), 0) as invested_amount,
                       COALESCE(SUM(returns), 0) as distributed_returns
                FROM user_investments
                WHERE user_id = ? AND investment_id = ? AND status = 'active'
            ''', (user_id, investment_id)).fetchone()

            active_positions = int(positions['active_positions'] or 0)
            invested_amount = float(positions['invested_amount'] or 0)
            distributed_returns = float(positions['distributed_returns'] or 0)

            if active_positions == 0 or invested_amount <= 0:
                conn.close()
                return jsonify({'error': 'No active investment found to cancel', 'code': 'NO_ACTIVE_INVESTMENT'}), 404

            if distributed_returns > 0:
                conn.close()
                return jsonify({
                    'error': 'Cannot cancel after profit distribution has started',
                    'code': 'INVESTMENT_CANCELLATION_LOCKED'
                }), 400

            cancellation_setting = conn.execute(
                "SELECT value FROM system_settings WHERE key = 'investment_cancellation_fee_rate'",
            ).fetchone()
            cancellation_rate = float(cancellation_setting['value']) if cancellation_setting and cancellation_setting['value'] is not None else 1.0
            cancellation_fee = invested_amount * (cancellation_rate / 100.0)
            refund_amount = max(invested_amount - cancellation_fee, 0.0)

            payment_currency = conn.execute(
                "SELECT id, code FROM currencies WHERE code = 'USDT' AND is_active = 1"
            ).fetchone()
            payment_network = conn.execute('''
                SELECT id, code
                FROM networks
                WHERE currency_id = ? AND code = 'TRC20' AND is_active = 1
            ''', (payment_currency['id'],)).fetchone() if payment_currency else None

            if not payment_currency or not payment_network:
                conn.close()
                return jsonify({'error': 'USDT payment channel not configured', 'code': 'USDT_NOT_CONFIGURED'}), 500

            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_investments
                SET status = 'cancelled'
                WHERE user_id = ? AND investment_id = ? AND status = 'active' AND COALESCE(returns, 0) <= 0
            ''', (user_id, investment_id))
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return jsonify({'error': 'Unable to cancel this investment', 'code': 'INVESTMENT_CANCELLATION_FAILED'}), 400

            cursor.execute('''
                UPDATE investments
                SET collected = CASE
                    WHEN collected >= ? THEN collected - ?
                    ELSE 0
                END
                WHERE id = ?
            ''', (invested_amount, invested_amount, investment_id))
            cursor.execute('''
                UPDATE user_wallets
                SET balance = balance + ?
                WHERE user_id = ? AND currency_id = ?
            ''', (refund_amount, user_id, payment_currency['id']))
            cursor.execute('''
                INSERT INTO transactions (
                    user_id, type, currency_id, network_id, amount, status, note
                ) VALUES (?, 'investment_cancel', ?, ?, ?, 'completed', ?)
            ''', (
                user_id,
                payment_currency['id'],
                payment_network['id'],
                refund_amount,
                f'Investment #{investment_id} cancelled: refund {refund_amount:.8f} USDT after fee {cancellation_fee:.8f} USDT'
            ))

            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'message': 'تم إلغاء الاستثمار وإعادة المبلغ بعد الخصم المحدد',
                'data': {
                    'investment_id': investment_id,
                    'investment_name': investment['name'],
                    'cancelled_amount': invested_amount,
                    'cancellation_fee_rate': cancellation_rate,
                    'cancellation_fee': cancellation_fee,
                    'refund_amount': refund_amount
                }
            }), 200

        except Exception as e:
            print(f"Cancel investment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/investments/images/upload', methods=['POST'])
    @ctx.admin_required
    def upload_investment_images():
        try:
            files = request.files.getlist('files')
            if not files:
                single_file = request.files.get('file')
                files = [single_file] if single_file else []

            valid_files = [file for file in files if file and file.filename]
            if not valid_files:
                return jsonify({'error': 'No files provided', 'code': 'NO_FILE'}), 400

            if len(valid_files) > 12:
                return jsonify({'error': 'Maximum 12 images per upload', 'code': 'TOO_MANY_FILES'}), 400

            uploaded_urls = []
            for file in valid_files:
                mime = str(file.mimetype or '').lower()
                if not mime.startswith('image/'):
                    return jsonify({'error': 'Only image files are supported', 'code': 'UNSUPPORTED_FILE_TYPE'}), 400

                safe_name = secure_filename(file.filename) or 'project-image'
                extension = os.path.splitext(safe_name)[1] or '.jpg'
                generated_name = f"project_{uuid.uuid4().hex[:18]}{extension}"
                save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], generated_name)
                file.save(save_path)
                uploaded_urls.append(f'/uploads/{generated_name}')

            return jsonify({
                'success': True,
                'message': 'تم رفع صور المشروع بنجاح',
                'data': {
                    'image_urls': uploaded_urls
                }
            }), 201
        except Exception as e:
            print(f"Upload investment images error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/investments', methods=['GET'])
    @ctx.admin_required
    def get_admin_investments():
        try:
            conn = ctx.get_db_connection()
            investments = conn.execute('''
                SELECT
                    i.id,
                    i.name,
                    i.description,
                    i.total_amount,
                    i.admin_amount,
                    i.collected,
                    i.min_investment,
                    i.return_rate,
                    i.duration,
                    i.image_url,
                    i.image_gallery_json,
                    i.start_date,
                    i.end_date,
                    i.status,
                    i.category,
                    i.governorate_id,
                    g.name as governorate_name,
                    g.slug as governorate_slug,
                    g.symbol as governorate_symbol,
                    g.image_url as governorate_image_url,
                    u.name as admin_name,
                    (SELECT COUNT(*) FROM user_investments WHERE investment_id = i.id) as investor_count,
                    i.created_at
                FROM investments i
                LEFT JOIN users u ON i.added_by = u.id
                LEFT JOIN governorates g ON i.governorate_id = g.id
                ORDER BY i.created_at DESC
            ''').fetchall()
            conn.close()

            return jsonify({
                'success': True,
                'data': {'investments': [serialize_investment_row(inv) for inv in investments]}
            }), 200

        except Exception as e:
            print(f"Get admin investments error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500

    @app.route('/api/admin/investments/<int:investment_id>', methods=['DELETE'])
    @ctx.admin_required
    def delete_investment_admin(investment_id):
        try:
            conn = ctx.get_db_connection()
            investment = conn.execute('SELECT collected FROM investments WHERE id = ?', (investment_id,)).fetchone()
            if not investment:
                conn.close()
                return jsonify({'error': 'Investment not found', 'code': 'INVESTMENT_NOT_FOUND'}), 404
            if investment['collected'] > 0:
                conn.close()
                return jsonify({
                    'error': 'Cannot delete investment with collected funds',
                    'code': 'INVESTMENT_HAS_FUNDS'
                }), 400

            cursor = conn.cursor()
            cursor.execute('DELETE FROM investments WHERE id = ?', (investment_id,))
            conn.commit()
            conn.close()

            return jsonify({'success': True, 'message': 'تم حذف الاستثمار بنجاح'}), 200

        except Exception as e:
            print(f"Delete investment error: {str(e)}")
            return jsonify({'error': 'Internal server error', 'code': 'SERVER_ERROR'}), 500
