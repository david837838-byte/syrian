"""
اختبارات شاملة - Unit و Integration Tests
"""

import unittest
import json
import sqlite3
import os
import tempfile
import io
from datetime import datetime, timedelta
from unittest.mock import patch
from app import app, init_db, get_db_connection, limiter
from flask_jwt_extended import create_access_token
from config import TestingConfig


def set_email_verification(enabled):
    conn = get_db_connection()
    conn.execute(
        "UPDATE system_settings SET value = ? WHERE key = 'email_verification'",
        ('true' if enabled else 'false',)
    )
    conn.commit()
    conn.close()


def set_company_accounts_enabled(enabled):
    conn = get_db_connection()
    conn.execute(
        "UPDATE system_settings SET value = ? WHERE key = 'company_accounts_enabled'",
        ('true' if enabled else 'false',)
    )
    conn.commit()
    conn.close()


def create_receiving_wallet(address='TREALTESTWALLET1234567890ABCDE', currency_id=1, network_id=1, label='اختبار TRC20'):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO admin_wallets (currency_id, network_id, address, label, is_active)
        VALUES (?, ?, ?, ?, 1)
    ''', (currency_id, network_id, address, label))
    conn.commit()
    conn.close()


def create_real_crypto_pool_wallet(address='TREALUSERPOOL1234567890ABCDE', currency_id=1, network_id=1, label='مخزون TRC20', provider_name='Test Provider'):
    conn = get_db_connection()
    admin_user = conn.execute("SELECT id FROM users WHERE email = 'admin@invest.com'").fetchone()
    conn.execute('''
        INSERT INTO real_crypto_wallet_pool (
            currency_id, network_id, address, label, provider_name, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, 1, ?)
    ''', (currency_id, network_id, address, label, provider_name, admin_user['id'] if admin_user else None))
    conn.commit()
    conn.close()


class AuthTestCase(unittest.TestCase):
    """اختبارات المصادقة"""
    
    def setUp(self):
        """إعداد بيئة الاختبار"""
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        self.backup_dir = tempfile.mkdtemp(prefix='backup-tests-')
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['BACKUP_FOLDER'] = self.backup_dir
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)
    
    def tearDown(self):
        """تنظيف بيئة الاختبار"""
        self.app_context.pop()
        os.unlink(self.db_file.name)
        for name in os.listdir(self.backup_dir):
            os.remove(os.path.join(self.backup_dir, name))
        os.rmdir(self.backup_dir)
    
    def test_register_success(self):
        """اختبار التسجيل الناجح"""
        response = self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('access_token', data['data'])
        self.assertRegex(str(data['data']['user']['public_user_id']), r'^\d{6,}$')
        self.assertTrue(str(data['data']['user']['referral_code']).startswith('INV'))

    def test_register_company_account_success(self):
        """اختبار إنشاء حساب شركة مع ملف شركة مرتبط"""
        response = self.app.post('/api/auth/register', json={
            'name': 'Company Owner',
            'email': 'company@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890',
            'account_type': 'company',
            'company_name': 'Smart Invest LLC',
            'representative_name': 'Ahmad Ali',
            'trade_name': 'Smart Invest',
            'registration_number': 'REG-1020',
            'company_country_code': 'SY',
            'company_city': 'Damascus'
        })

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['data']['user']['account_type'], 'company')
        self.assertEqual(data['data']['user']['company_profile']['company_name'], 'Smart Invest LLC')
        self.assertEqual(data['data']['user']['company_profile']['representative_name'], 'Ahmad Ali')

        token = data['data']['access_token']
        profile_response = self.app.get('/api/auth/profile', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(profile_response.status_code, 200)
        profile_data = json.loads(profile_response.data)['data']['profile']
        self.assertEqual(profile_data['account_type'], 'company')
        self.assertEqual(profile_data['company_profile']['company_name'], 'Smart Invest LLC')

    def test_register_company_account_can_be_disabled(self):
        """اختبار إيقاف تسجيل حسابات الشركات من الإعدادات"""
        set_company_accounts_enabled(False)
        response = self.app.post('/api/auth/register', json={
            'name': 'Blocked Company',
            'email': 'blocked-company@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890',
            'account_type': 'company',
            'company_name': 'Blocked Co',
            'representative_name': 'Blocked Rep'
        })

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'COMPANY_ACCOUNTS_DISABLED')

    def test_untrusted_origin_is_blocked_for_sensitive_api_requests(self):
        """اختبار حظر الطلبات الحساسة من مصدر غير موثوق"""
        response = self.app.post('/api/auth/register', json={
            'name': 'Origin User',
            'email': 'origin@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        }, headers={'Origin': 'https://evil.example.com'})

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'UNTRUSTED_ORIGIN')

    def test_profile_devices_endpoint_returns_known_devices(self):
        """اختبار عرض الأجهزة المعروفة للمستخدم"""
        register_response = self.app.post('/api/auth/register', json={
            'name': 'Known Device User',
            'email': 'known-device@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.assertEqual(register_response.status_code, 201)
        token = json.loads(register_response.data)['data']['access_token']

        self.app.post('/api/auth/login', json={
            'email': 'known-device@example.com',
            'password': 'TestPassword123!'
        }, headers={'X-Device-Id': 'known-device-id', 'X-Device-Name': 'Known Device Browser'})

        response = self.app.get('/api/auth/devices', headers={'Authorization': f'Bearer {token}', 'X-Device-Id': 'known-device-id'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)['data']
        self.assertIn('devices', data)
        self.assertGreaterEqual(len(data['devices']), 1)
        self.assertEqual(data['current_device_id'], 'known-device-id')

    def test_wallet_financial_channels_endpoint_returns_active_country_channels(self):
        """اختبار عرض القنوات المالية الحقيقية للمستخدم حسب الدولة"""
        register_response = self.app.post('/api/auth/register', json={
            'name': 'Financial Channel User',
            'email': 'financial-user@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.assertEqual(register_response.status_code, 201)
        token = json.loads(register_response.data)['data']['access_token']

        create_receiving_wallet(address='TCHANNELUSER1234567890ABCDE')

        conn = get_db_connection()
        admin_wallet = conn.execute('''
            SELECT id
            FROM admin_wallets
            ORDER BY id DESC
            LIMIT 1
        ''').fetchone()
        admin_user = conn.execute("SELECT id FROM users WHERE email = 'admin@invest.com'").fetchone()
        conn.execute('''
            INSERT INTO financial_channels (
                channel_type, title, description, country_code, country_name,
                currency_id, network_id, admin_wallet_id, account_label, account_identifier,
                extra_details, instructions, is_active, display_order, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'crypto',
            'قناة USDT حقيقية',
            'للمستخدمين داخل سوريا',
            'SY',
            'سوريا',
            1,
            1,
            admin_wallet['id'],
            'محفظة الاستقبال الرئيسية',
            '',
            'التحويل يصل إلى عنوان الاستقبال مباشرة',
            'حوّل ثم تابع من سجل المعاملات',
            1,
            1,
            admin_user['id']
        ))
        conn.commit()
        conn.close()

        response = self.app.get('/api/wallets/financial-channels', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)['data']
        self.assertEqual(data['selected_country_code'], 'SY')
        self.assertGreaterEqual(len(data['channels']), 1)
        self.assertEqual(data['channels'][0]['channel_type'], 'crypto')
        self.assertTrue(data['channels'][0]['effective_identifier'])

    def test_user_can_get_independent_real_crypto_wallet(self):
        """اختبار تخصيص محفظة كريبتو مستقلة للمستخدم من مخزون جديد"""
        register_response = self.app.post('/api/auth/register', json={
            'name': 'Real Wallet User',
            'email': 'real-wallet-user@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.assertEqual(register_response.status_code, 201)
        token = json.loads(register_response.data)['data']['access_token']

        create_real_crypto_pool_wallet(address='TREALPOOLUSER999999999999999')

        headers = {'Authorization': f'Bearer {token}'}
        assign_response = self.app.post('/api/wallets/real-crypto/assign', json={
            'currency_id': 1,
            'network_id': 1
        }, headers=headers)
        self.assertEqual(assign_response.status_code, 201)
        assign_data = json.loads(assign_response.data)['data']
        self.assertFalse(assign_data['existing'])
        self.assertEqual(assign_data['wallet']['address'], 'TREALPOOLUSER999999999999999')

        list_response = self.app.get('/api/wallets/real-crypto', headers=headers)
        self.assertEqual(list_response.status_code, 200)
        wallets = json.loads(list_response.data)['data']['wallets']
        self.assertEqual(len(wallets), 1)
        self.assertEqual(wallets[0]['address'], 'TREALPOOLUSER999999999999999')

        second_assign = self.app.post('/api/wallets/real-crypto/assign', json={
            'currency_id': 1,
            'network_id': 1
        }, headers=headers)
        self.assertEqual(second_assign.status_code, 200)
        second_data = json.loads(second_assign.data)['data']
        self.assertTrue(second_data['existing'])

    @patch('routes.wallets.generate_tatum_address_from_xpub')
    def test_user_can_get_provider_generated_real_crypto_wallet(self, mock_generate_address):
        """اختبار تخصيص محفظة حقيقية من مزود بلوكشين عبر XPUB"""
        mock_generate_address.return_value = {
            'address': 'TPROVIDERREAL1234567890123456',
            'provider_name': 'Tatum',
            'network_code': 'TRC20',
            'raw': {'address': 'TPROVIDERREAL1234567890123456'}
        }

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Provider Wallet User',
            'email': 'provider-wallet-user@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.assertEqual(register_response.status_code, 201)
        token = json.loads(register_response.data)['data']['access_token']

        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = 'tatum_xpub' WHERE key = 'real_wallet_generation_mode'")
        conn.execute("UPDATE system_settings SET value = 'tatum' WHERE key = 'real_wallet_blockchain_provider'")
        conn.execute("UPDATE system_settings SET value = 'dummy-api-key' WHERE key = 'real_wallet_provider_api_key'")
        conn.execute("UPDATE system_settings SET value = 'https://api.tatum.io' WHERE key = 'real_wallet_provider_base_url'")
        conn.execute("UPDATE system_settings SET value = 'dummy-tron-xpub' WHERE key = 'real_wallet_xpub_tron'")
        conn.commit()
        conn.close()

        headers = {'Authorization': f'Bearer {token}'}
        assign_response = self.app.post('/api/wallets/real-crypto/assign', json={
            'currency_id': 1,
            'network_id': 1
        }, headers=headers)
        self.assertEqual(assign_response.status_code, 201)
        assign_data = json.loads(assign_response.data)['data']['wallet']
        self.assertEqual(assign_data['address'], 'TPROVIDERREAL1234567890123456')
        self.assertEqual(assign_data['provider_name'], 'Tatum')

        conn = get_db_connection()
        counter = conn.execute('''
            SELECT next_index
            FROM real_wallet_generation_counters
            WHERE currency_id = 1 AND network_id = 1
        ''').fetchone()
        conn.close()
        self.assertIsNotNone(counter)
        self.assertEqual(counter['next_index'], 1)
    
    def test_register_invalid_email(self):
        """اختبار التسجيل ببريد إلكتروني غير صحيح"""
        response = self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'invalid-email',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        self.assertEqual(response.status_code, 400)
    
    def test_register_weak_password(self):
        """اختبار التسجيل بكلمة مرور ضعيفة"""
        response = self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': '123',
            'phone': '+1234567890'
        })
        
        self.assertEqual(response.status_code, 400)
    
    def test_register_duplicate_email(self):
        """اختبار التسجيل ببريد إلكتروني موجود"""
        # التسجيل الأول
        self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        # محاولة التسجيل مرة ثانية
        response = self.app.post('/api/auth/register', json={
            'name': 'Another User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+0987654321'
        })
        
        self.assertEqual(response.status_code, 409)

    def test_register_disabled_from_settings(self):
        """اختبار إيقاف التسجيل من الإعدادات"""
        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = 'false' WHERE key = 'registration_enabled'")
        conn.commit()
        conn.close()

        response = self.app.post('/api/auth/register', json={
            'name': 'Blocked User',
            'email': 'blocked@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'REGISTRATION_DISABLED')

    def test_register_with_referral_code_links_referrer(self):
        """اختبار ربط المستخدم الجديد بصاحب رمز الإحالة"""
        first_response = self.app.post('/api/auth/register', json={
            'name': 'Referrer User',
            'email': 'referrer@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        first_data = json.loads(first_response.data)
        referral_code = first_data['data']['user']['referral_code']

        second_response = self.app.post('/api/auth/register', json={
            'name': 'Referred User',
            'email': 'referred@example.com',
            'password': 'TestPassword123!',
            'phone': '+1987654321',
            'referral_code': referral_code
        })
        self.assertEqual(second_response.status_code, 201)

        conn = get_db_connection()
        referrer = conn.execute("SELECT id FROM users WHERE email = 'referrer@example.com'").fetchone()
        referred = conn.execute("SELECT referred_by_user_id FROM users WHERE email = 'referred@example.com'").fetchone()
        conn.close()

        self.assertIsNotNone(referrer)
        self.assertIsNotNone(referred)
        self.assertEqual(referred['referred_by_user_id'], referrer['id'])
    
    def test_login_success(self):
        """اختبار تسجيل الدخول الناجح"""
        # التسجيل أولاً
        self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        # تسجيل الدخول
        response = self.app.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        })
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('access_token', data['data'])
    
    def test_login_invalid_credentials(self):
        """اختبار تسجيل الدخول ببيانات خاطئة"""
        response = self.app.post('/api/auth/login', json={
            'email': 'nonexistent@example.com',
            'password': 'WrongPassword'
        })
        
        self.assertEqual(response.status_code, 401)

    def test_health_endpoint_reports_database_status(self):
        """اختبار endpoint الصحة العامة"""
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'ok')
        self.assertTrue(data['services']['database']['ok'])

    def test_login_lockout_after_repeated_failures(self):
        """اختبار قفل الحساب مؤقتاً بعد تكرار كلمة المرور الخاطئة"""
        self.app.post('/api/auth/register', json={
            'name': 'Locked User',
            'email': 'locked@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })

        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = '3' WHERE key = 'max_login_attempts'")
        conn.execute("UPDATE system_settings SET value = '10' WHERE key = 'lockout_duration_minutes'")
        conn.commit()
        conn.close()

        for _ in range(2):
            response = self.app.post('/api/auth/login', json={
                'email': 'locked@example.com',
                'password': 'WrongPassword123!'
            })
            self.assertEqual(response.status_code, 401)

        locked_response = self.app.post('/api/auth/login', json={
            'email': 'locked@example.com',
            'password': 'WrongPassword123!'
        })
        self.assertEqual(locked_response.status_code, 423)
        locked_data = json.loads(locked_response.data)
        self.assertEqual(locked_data['code'], 'ACCOUNT_LOCKED')

        correct_while_locked = self.app.post('/api/auth/login', json={
            'email': 'locked@example.com',
            'password': 'TestPassword123!'
        })
        self.assertEqual(correct_while_locked.status_code, 423)

    def test_device_lockout_is_isolated_per_device(self):
        """اختبار حظر جهاز محدد مع بقاء جهاز آخر قادرًا على المحاولة"""
        self.app.post('/api/auth/register', json={
            'name': 'Device User',
            'email': 'device@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })

        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = '20' WHERE key = 'max_login_attempts'")
        conn.execute("UPDATE system_settings SET value = '10' WHERE key = 'lockout_duration_minutes'")
        conn.execute("UPDATE system_settings SET value = '3' WHERE key = 'device_login_attempts_limit'")
        conn.execute("UPDATE system_settings SET value = '60' WHERE key = 'device_lockout_duration_minutes'")
        conn.commit()
        conn.close()

        bad_headers_a = {'X-Device-Id': 'device-a', 'X-Device-Name': 'Chrome A'}
        bad_headers_b = {'X-Device-Id': 'device-b', 'X-Device-Name': 'Chrome B'}

        for _ in range(2):
            response = self.app.post('/api/auth/login', json={
                'email': 'device@example.com',
                'password': 'WrongPassword123!'
            }, headers=bad_headers_a)
            self.assertEqual(response.status_code, 401)

        locked_response = self.app.post('/api/auth/login', json={
            'email': 'device@example.com',
            'password': 'WrongPassword123!'
        }, headers=bad_headers_a)
        self.assertEqual(locked_response.status_code, 423)
        locked_data = json.loads(locked_response.data)
        self.assertEqual(locked_data['code'], 'DEVICE_LOCKED')

        other_device_response = self.app.post('/api/auth/login', json={
            'email': 'device@example.com',
            'password': 'WrongPassword123!'
        }, headers=bad_headers_b)
        self.assertEqual(other_device_response.status_code, 401)

    def test_password_reset_wrong_code_locks_same_device_only(self):
        """اختبار حظر جهاز واحد عند تكرار كود إعادة التعيين الخاطئ"""
        self.app.post('/api/auth/register', json={
            'name': 'Reset User',
            'email': 'reset@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })

        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = '3' WHERE key = 'device_reset_attempts_limit'")
        conn.execute("UPDATE system_settings SET value = '60' WHERE key = 'device_lockout_duration_minutes'")
        conn.commit()
        conn.close()

        headers_a = {'X-Device-Id': 'reset-device-a', 'X-Device-Name': 'Reset Browser A'}
        headers_b = {'X-Device-Id': 'reset-device-b', 'X-Device-Name': 'Reset Browser B'}

        request_response = self.app.post('/api/auth/forgot-password', json={
            'email': 'reset@example.com'
        }, headers=headers_a)
        self.assertEqual(request_response.status_code, 200)

        for _ in range(2):
            wrong_code = self.app.post('/api/auth/reset-password', json={
                'email': 'reset@example.com',
                'code': '000000',
                'new_password': 'AnotherPass123!'
            }, headers=headers_a)
            self.assertEqual(wrong_code.status_code, 400)

        locked_code = self.app.post('/api/auth/reset-password', json={
            'email': 'reset@example.com',
            'code': '000000',
            'new_password': 'AnotherPass123!'
        }, headers=headers_a)
        self.assertEqual(locked_code.status_code, 423)
        locked_data = json.loads(locked_code.data)
        self.assertEqual(locked_data['code'], 'DEVICE_LOCKED')

        other_device = self.app.post('/api/auth/reset-password', json={
            'email': 'reset@example.com',
            'code': '000000',
            'new_password': 'AnotherPass123!'
        }, headers=headers_b)
        self.assertEqual(other_device.status_code, 400)

    @patch('app.requests.get')
    def test_google_auth_creates_user_and_returns_token(self, mock_google_request):
        """اختبار إنشاء/دخول الحساب عبر Google"""
        app.config['GOOGLE_CLIENT_ID'] = 'google-client-id-test'
        mock_google_request.return_value.status_code = 200
        mock_google_request.return_value.json.return_value = {
            'aud': 'google-client-id-test',
            'iss': 'https://accounts.google.com',
            'sub': 'google-sub-123',
            'email': 'google-user@example.com',
            'email_verified': 'true',
            'name': 'Google User',
            'picture': 'https://example.com/avatar.png'
        }

        response = self.app.post('/api/auth/google', json={
            'id_token': 'google-id-token'
        })

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['data']['is_new_user'])
        self.assertEqual(data['data']['user']['email'], 'google-user@example.com')

        login_response = self.app.post('/api/auth/google', json={
            'id_token': 'google-id-token'
        })
        self.assertEqual(login_response.status_code, 200)

    @patch('app.requests.get')
    def test_logged_in_user_can_link_google_account(self, mock_google_request):
        """اختبار ربط Google من داخل الملف الشخصي"""
        app.config['GOOGLE_CLIENT_ID'] = 'google-client-id-test'
        mock_google_request.return_value.status_code = 200
        mock_google_request.return_value.json.return_value = {
            'aud': 'google-client-id-test',
            'iss': 'https://accounts.google.com',
            'sub': 'google-link-sub-789',
            'email': 'linkme@example.com',
            'email_verified': 'true',
            'name': 'Link Me',
            'picture': 'https://example.com/avatar-link.png'
        }

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Link Me',
            'email': 'linkme@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        token = json.loads(register_response.data)['data']['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        link_response = self.app.post('/api/auth/google/link', json={
            'id_token': 'google-link-token'
        }, headers=headers)

        self.assertEqual(link_response.status_code, 200)
        data = json.loads(link_response.data)
        self.assertTrue(data['success'])
        self.assertTrue(data['data']['profile']['google_linked'])

    def test_email_verification_flow_when_enabled(self):
        """اختبار التسجيل مع تفعيل توثيق البريد ثم تأكيد الكود"""
        set_email_verification(True)

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Verified User',
            'email': 'verified@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })

        self.assertEqual(register_response.status_code, 201)
        register_data = json.loads(register_response.data)
        self.assertTrue(register_data['data']['verification_required'])
        self.assertNotIn('access_token', register_data['data'])

        blocked_login = self.app.post('/api/auth/login', json={
            'email': 'verified@example.com',
            'password': 'TestPassword123!'
        })
        self.assertEqual(blocked_login.status_code, 403)
        blocked_data = json.loads(blocked_login.data)
        self.assertEqual(blocked_data['code'], 'EMAIL_NOT_VERIFIED')

        conn = get_db_connection()
        code_row = conn.execute('''
            SELECT ev.code
            FROM email_verification_codes ev
            JOIN users u ON u.id = ev.user_id
            WHERE u.email = ?
            ORDER BY ev.id DESC
            LIMIT 1
        ''', ('verified@example.com',)).fetchone()
        conn.close()

        self.assertIsNotNone(code_row)

        verify_response = self.app.post('/api/auth/verify-email', json={
            'email': 'verified@example.com',
            'code': code_row['code']
        })
        self.assertEqual(verify_response.status_code, 200)
        verify_data = json.loads(verify_response.data)
        self.assertIn('access_token', verify_data['data'])

        login_response = self.app.post('/api/auth/login', json={
            'email': 'verified@example.com',
            'password': 'TestPassword123!'
        })
        self.assertEqual(login_response.status_code, 200)

    def test_password_reset_with_email_code(self):
        """اختبار استعادة كلمة المرور عبر كود يصل إلى البريد"""
        self.app.post('/api/auth/register', json={
            'name': 'Reset User',
            'email': 'reset@example.com',
            'password': 'OldPassword123!',
            'phone': '+1234567890'
        })

        forgot_response = self.app.post('/api/auth/forgot-password', json={
            'email': 'reset@example.com'
        })
        self.assertEqual(forgot_response.status_code, 200)

        conn = get_db_connection()
        code_row = conn.execute('''
            SELECT pr.code
            FROM password_reset_codes pr
            JOIN users u ON u.id = pr.user_id
            WHERE u.email = ?
            ORDER BY pr.id DESC
            LIMIT 1
        ''', ('reset@example.com',)).fetchone()
        conn.close()
        self.assertIsNotNone(code_row)

        reset_response = self.app.post('/api/auth/reset-password', json={
            'email': 'reset@example.com',
            'code': code_row['code'],
            'new_password': 'NewPassword123!'
        })
        self.assertEqual(reset_response.status_code, 200)

        login_response = self.app.post('/api/auth/login', json={
            'email': 'reset@example.com',
            'password': 'NewPassword123!'
        })
        self.assertEqual(login_response.status_code, 200)

    def test_profile_update_endpoint(self):
        """اختبار تحديث الاسم ورقم الهاتف من إعدادات المستخدم"""
        self.app.post('/api/auth/register', json={
            'name': 'Profile User',
            'email': 'profile@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        login_response = self.app.post('/api/auth/login', json={
            'email': 'profile@example.com',
            'password': 'TestPassword123!'
        })
        token = json.loads(login_response.data)['data']['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        update_response = self.app.put('/api/auth/profile', json={
            'name': 'Profile User Updated',
            'phone': '+963999999999'
        }, headers=headers)

        self.assertEqual(update_response.status_code, 200)
        data = json.loads(update_response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['profile']['name'], 'Profile User Updated')

    def test_change_password_endpoint(self):
        """اختبار تغيير كلمة المرور من إعدادات المستخدم"""
        self.app.post('/api/auth/register', json={
            'name': 'Password User',
            'email': 'password@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        login_response = self.app.post('/api/auth/login', json={
            'email': 'password@example.com',
            'password': 'TestPassword123!'
        })
        token = json.loads(login_response.data)['data']['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        change_response = self.app.post('/api/auth/change-password', json={
            'current_password': 'TestPassword123!',
            'new_password': 'NewPassword123!'
        }, headers=headers)
        self.assertEqual(change_response.status_code, 200)

        relogin_response = self.app.post('/api/auth/login', json={
            'email': 'password@example.com',
            'password': 'NewPassword123!'
        })
        self.assertEqual(relogin_response.status_code, 200)


class WalletTestCase(unittest.TestCase):
    """اختبارات المحافظ"""
    
    def setUp(self):
        """إعداد بيئة الاختبار"""
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)
        create_receiving_wallet()
        
        # التسجيل وتسجيل الدخول
        self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        login_response = self.app.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        })
        
        login_data = json.loads(login_response.data)
        self.access_token = login_data['data']['access_token']
        conn = get_db_connection()
        user = conn.execute('SELECT id FROM users WHERE email = ?', ('test@example.com',)).fetchone()
        conn.close()
        self.user_id = user['id']
        conn = get_db_connection()
        user = conn.execute('SELECT id FROM users WHERE email = ?', ('test@example.com',)).fetchone()
        conn.close()
        self.user_id = user['id']
        conn = get_db_connection()
        user = conn.execute('SELECT id FROM users WHERE email = ?', ('test@example.com',)).fetchone()
        conn.close()
        self.user_id = user['id']
    
    def tearDown(self):
        """تنظيف بيئة الاختبار"""
        self.app_context.pop()
        os.unlink(self.db_file.name)
    
    def test_get_wallets_balance(self):
        """اختبار جلب أرصدة المحافظ"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.get('/api/wallets/balance', headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('user_wallets', data['data'])

    def test_registered_user_starts_without_fake_wallet_address(self):
        """اختبار أن التسجيل لا ينشئ عنواناً وهمياً تلقائياً"""
        conn = get_db_connection()
        user = conn.execute("SELECT id FROM users WHERE email = 'test@example.com'").fetchone()
        wallets = conn.execute('SELECT address FROM user_wallets WHERE user_id = ?', (user['id'],)).fetchall()
        conn.close()

        self.assertGreater(len(wallets), 0)
        self.assertTrue(all(wallet['address'] in (None, '') for wallet in wallets))
    
    def test_generate_new_wallet(self):
        """اختبار توليد محفظة جديدة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/wallets/generate/1', json={
            'network': 'TRC20'
        }, headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('new_address', data['data'])
        self.assertEqual(data['data']['network'], 'TRC20')

        conn = get_db_connection()
        admin_wallet = conn.execute('''
            SELECT address
            FROM admin_wallets
            WHERE currency_id = 1 AND network_id = 1
            LIMIT 1
        ''').fetchone()
        conn.close()
        self.assertIsNotNone(admin_wallet)
        self.assertEqual(data['data']['new_address'], admin_wallet['address'])

    def test_generate_wallet_requires_receiving_wallet(self):
        """اختبار منع إنشاء عنوان محفظة بدون محفظة استقبال"""
        conn = get_db_connection()
        conn.execute('''
            DELETE FROM admin_wallets
            WHERE currency_id = 1 AND network_id = 1
        ''')
        conn.commit()
        conn.close()

        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/wallets/generate/1', json={
            'network': 'TRC20'
        }, headers=headers)

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'RECEIVING_WALLET_NOT_CONFIGURED')

    def test_generate_eth_wallet_accepts_erc20_alias(self):
        """اختبار ربط محفظة Ethereum حتى لو أرسل الواجهة ERC20"""
        create_receiving_wallet(
            address='0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
            currency_id=3,
            network_id=5,
            label='اختبار Ethereum'
        )

        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/wallets/generate/3', json={
            'network': 'ERC20'
        }, headers=headers)

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['new_address'], '0xABCDEF1234567890ABCDEF1234567890ABCDEF12')
        self.assertEqual(data['data']['network'], 'ETH')

    def test_company_first_wallet_fee_is_charged_once(self):
        """اختبار خصم رسوم أول محفظة للشركة مرة واحدة فقط"""
        register_response = self.app.post('/api/auth/register', json={
            'name': 'Company Wallet Owner',
            'email': 'company-wallet@example.com',
            'password': 'TestPassword123!',
            'phone': '+963955000123',
            'account_type': 'company',
            'company_name': 'Wallet Company',
            'representative_name': 'Representative One'
        })
        self.assertEqual(register_response.status_code, 201)
        company_token = json.loads(register_response.data)['data']['access_token']
        company_headers = {'Authorization': f'Bearer {company_token}'}

        conn = get_db_connection()
        company_user = conn.execute("SELECT id FROM users WHERE email = 'company-wallet@example.com'").fetchone()
        conn.execute("UPDATE system_settings SET value = '15' WHERE key = 'company_wallet_setup_fee_amount'")
        conn.execute("UPDATE system_settings SET value = 'USDT' WHERE key = 'company_wallet_setup_fee_currency'")
        conn.execute("UPDATE system_settings SET value = 'TRC20' WHERE key = 'company_wallet_setup_fee_network'")
        conn.execute('''
            UPDATE user_wallets
            SET balance = 100, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = 1
        ''', (company_user['id'],))
        conn.commit()
        conn.close()

        first_response = self.app.post('/api/wallets/generate/1', json={
            'network': 'TRC20'
        }, headers=company_headers)
        self.assertEqual(first_response.status_code, 200)

        conn = get_db_connection()
        wallet_after_first = conn.execute('''
            SELECT balance, address
            FROM user_wallets
            WHERE user_id = ? AND currency_id = 1
        ''', (company_user['id'],)).fetchone()
        company_profile = conn.execute('''
            SELECT wallet_setup_fee_paid, wallet_setup_fee_transaction_id
            FROM company_profiles
            WHERE user_id = ?
        ''', (company_user['id'],)).fetchone()
        fee_transaction = conn.execute('''
            SELECT id, amount, status
            FROM transactions
            WHERE user_id = ? AND type = 'company_wallet_setup_fee'
            ORDER BY id DESC
            LIMIT 1
        ''', (company_user['id'],)).fetchone()
        conn.close()

        self.assertAlmostEqual(wallet_after_first['balance'], 85, places=6)
        self.assertTrue(wallet_after_first['address'])
        self.assertEqual(company_profile['wallet_setup_fee_paid'], 1)
        self.assertIsNotNone(company_profile['wallet_setup_fee_transaction_id'])
        self.assertEqual(fee_transaction['amount'], 15)
        self.assertEqual(fee_transaction['status'], 'completed')

        second_response = self.app.post('/api/wallets/generate/1', json={
            'network': 'TRC20'
        }, headers=company_headers)
        self.assertEqual(second_response.status_code, 200)

        conn = get_db_connection()
        wallet_after_second = conn.execute('''
            SELECT balance
            FROM user_wallets
            WHERE user_id = ? AND currency_id = 1
        ''', (company_user['id'],)).fetchone()
        fee_transactions_count = conn.execute('''
            SELECT COUNT(*) as total
            FROM transactions
            WHERE user_id = ? AND type = 'company_wallet_setup_fee'
        ''', (company_user['id'],)).fetchone()
        conn.close()

        self.assertAlmostEqual(wallet_after_second['balance'], 85, places=6)
        self.assertEqual(fee_transactions_count['total'], 1)

    def test_wallet_balance_returns_only_granted_special_wallets(self):
        """اختبار أن المحافظ الخاصة تظهر فقط للمستخدم المسموح له بها"""
        second_response = self.app.post('/api/auth/register', json={
            'name': 'Second Wallet User',
            'email': 'wallet-second@example.com',
            'password': 'TestPassword123!',
            'phone': '+1987654321'
        })
        self.assertEqual(second_response.status_code, 201)

        conn = get_db_connection()
        first_user = conn.execute("SELECT public_user_id FROM users WHERE email = 'test@example.com'").fetchone()
        second_user = conn.execute("SELECT public_user_id FROM users WHERE email = 'wallet-second@example.com'").fetchone()
        conn.close()

        admin_login = self.app.post('/api/auth/login', json={
            'email': 'admin@invest.com',
            'password': 'admin123'
        })
        admin_token = json.loads(admin_login.data)['data']['access_token']
        admin_headers = {'Authorization': f'Bearer {admin_token}'}

        profile_response = self.app.post('/api/admin/wallet-profiles', json={
            'title': 'محفظة VIP',
            'description': 'محفظة خاصة لمستخدم واحد',
            'access_note': 'وصول محدود من الإدارة',
            'currency_id': 1,
            'network_id': 1,
            'admin_wallet_id': 1,
            'allowed_public_ids': [first_user['public_user_id']]
        }, headers=admin_headers)
        self.assertEqual(profile_response.status_code, 201)

        headers = {'Authorization': f'Bearer {self.access_token}'}
        first_wallets = self.app.get('/api/wallets/balance', headers=headers)
        self.assertEqual(first_wallets.status_code, 200)
        first_data = json.loads(first_wallets.data)
        self.assertEqual(len(first_data['data']['special_wallets']), 1)
        self.assertEqual(first_data['data']['special_wallets'][0]['title'], 'محفظة VIP')

        second_login = self.app.post('/api/auth/login', json={
            'email': 'wallet-second@example.com',
            'password': 'TestPassword123!'
        })
        second_token = json.loads(second_login.data)['data']['access_token']
        second_headers = {'Authorization': f'Bearer {second_token}'}
        second_wallets = self.app.get('/api/wallets/balance', headers=second_headers)
        self.assertEqual(second_wallets.status_code, 200)
        second_data = json.loads(second_wallets.data)
        self.assertEqual(second_data['data']['special_wallets'], [])


class TransactionTestCase(unittest.TestCase):
    """اختبارات المعاملات"""
    
    def setUp(self):
        """إعداد بيئة الاختبار"""
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)
        create_receiving_wallet()
        
        # التسجيل وتسجيل الدخول
        self.app.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        
        login_response = self.app.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        })
        
        login_data = json.loads(login_response.data)
        self.access_token = login_data['data']['access_token']
        tx_conn = get_db_connection()
        tx_user = tx_conn.execute('SELECT id FROM users WHERE email = ?', ('test@example.com',)).fetchone()
        tx_conn.close()
        self.user_id = tx_user['id']
    
    def tearDown(self):
        """تنظيف بيئة الاختبار"""
        self.app_context.pop()
        os.unlink(self.db_file.name)
    
    def test_deposit_success(self):
        """اختبار إيداع فوري ناجح"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 100,
            'tx_hash': '0x1234567890abcdef'
        }, headers=headers)

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['status'], 'completed')

    def test_small_usdt_deposit_of_five_succeeds(self):
        """اختبار قبول إيداع 5 USDT للتجربة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5,
            'tx_hash': '0xsmall-deposit-five'
        }, headers=headers)

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['amount'], 5)

    def test_deposit_allows_missing_tx_hash_in_simulated_mode(self):
        """اختبار أن رقم المعاملة في الإيداع يصبح اختياريًا في الوضع الفوري الحالي"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 10
        }, headers=headers)

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['status'], 'completed')

    def test_deposit_disabled_from_settings(self):
        """اختبار إيقاف الإيداع من الإعدادات"""
        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = 'false' WHERE key = 'deposit_enabled'")
        conn.commit()
        conn.close()

        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 10,
            'tx_hash': '0xdisabled-deposit'
        }, headers=headers)

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'DEPOSIT_DISABLED')

    def test_internal_transfer_moves_balance_between_users(self):
        """اختبار التحويل الداخلي بين مستخدمين داخل المنصة"""
        self.app.post('/api/auth/register', json={
            'name': 'Second User',
            'email': 'second@example.com',
            'password': 'TestPassword123!',
            'phone': '+1987654321'
        })

        conn = get_db_connection()
        recipient = conn.execute("SELECT id, public_user_id FROM users WHERE email = 'second@example.com'").fetchone()
        conn.close()
        self.assertIsNotNone(recipient)

        headers = {'Authorization': f'Bearer {self.access_token}'}
        seed_response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 20,
            'tx_hash': '0xinternal-transfer-seed'
        }, headers=headers)
        self.assertEqual(seed_response.status_code, 201)

        transfer_response = self.app.post('/api/transactions/internal-transfer', json={
            'recipient_public_id': recipient['public_user_id'],
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 7,
            'note': 'تحويل تجريبي'
        }, headers=headers)

        self.assertEqual(transfer_response.status_code, 201)
        transfer_data = json.loads(transfer_response.data)
        self.assertTrue(transfer_data['success'])

        conn = get_db_connection()
        sender_wallet = conn.execute('''
            SELECT w.balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (self.user_id,)).fetchone()
        recipient_wallet = conn.execute('''
            SELECT w.balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (recipient['id'],)).fetchone()
        sender_tx = conn.execute('''
            SELECT type, status, note
            FROM transactions
            WHERE user_id = ? AND type = 'internal_transfer_sent'
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user_id,)).fetchone()
        recipient_tx = conn.execute('''
            SELECT type, status, note
            FROM transactions
            WHERE user_id = ? AND type = 'internal_transfer_received'
            ORDER BY id DESC
            LIMIT 1
        ''', (recipient['id'],)).fetchone()
        conn.close()

        self.assertIsNotNone(sender_wallet)
        self.assertIsNotNone(recipient_wallet)
        self.assertAlmostEqual(sender_wallet['balance'], 13, places=6)
        self.assertAlmostEqual(recipient_wallet['balance'], 7, places=6)
        self.assertIsNotNone(sender_tx)
        self.assertIsNotNone(recipient_tx)
        self.assertEqual(sender_tx['status'], 'completed')
        self.assertEqual(recipient_tx['status'], 'completed')
        self.assertIn(str(recipient['public_user_id']), sender_tx['note'])

    def test_internal_transfer_can_be_disabled_from_settings(self):
        """اختبار إيقاف التحويل الداخلي من الإعدادات"""
        self.app.post('/api/auth/register', json={
            'name': 'Disabled Transfer Recipient',
            'email': 'disabled-transfer@example.com',
            'password': 'TestPassword123!',
            'phone': '+1987654322'
        })

        conn = get_db_connection()
        recipient = conn.execute("SELECT public_user_id FROM users WHERE email = 'disabled-transfer@example.com'").fetchone()
        conn.execute("UPDATE system_settings SET value = 'false' WHERE key = 'internal_transfer_enabled'")
        conn.commit()
        conn.close()

        headers = {'Authorization': f'Bearer {self.access_token}'}
        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 20,
            'tx_hash': '0xinternal-transfer-disabled-seed'
        }, headers=headers)

        response = self.app.post('/api/transactions/internal-transfer', json={
            'recipient_public_id': recipient['public_user_id'],
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5
        }, headers=headers)

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'INTERNAL_TRANSFER_DISABLED')
    
    def test_withdraw_insufficient_balance(self):
        """اختبار السحب برصيد غير كافٍ"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/transactions/withdraw', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 10000,
            'wallet_address': 'T1234567890abcdef'
        }, headers=headers)
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['code'], 'INSUFFICIENT_BALANCE')

    def test_deposit_updates_user_and_admin_wallet_balances_immediately(self):
        """اختبار أن الإيداع الفوري يرفع رصيد المستخدم ومحفظة الاستقبال مباشرة"""
        user_headers = {'Authorization': f'Bearer {self.access_token}'}
        deposit_response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 125,
            'tx_hash': '0xdeposit-confirm-balance'
        }, headers=user_headers)

        self.assertEqual(deposit_response.status_code, 201)

        conn = get_db_connection()
        user = conn.execute("SELECT id FROM users WHERE email = 'test@example.com'").fetchone()
        user_wallet = conn.execute('''
            SELECT w.balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (user['id'],)).fetchone()
        admin_wallet = conn.execute('''
            SELECT current_balance, total_received
            FROM admin_wallets a
            JOIN currencies c ON c.id = a.currency_id
            JOIN networks n ON n.id = a.network_id
            WHERE c.code = 'USDT' AND n.code = 'TRC20'
            LIMIT 1
        ''').fetchone()
        transaction = conn.execute('''
            SELECT status
            FROM transactions
            WHERE tx_hash = ?
        ''', ('0xdeposit-confirm-balance',)).fetchone()
        conn.close()

        self.assertIsNotNone(user_wallet)
        self.assertEqual(user_wallet['balance'], 125)
        self.assertIsNotNone(admin_wallet)
        self.assertEqual(admin_wallet['current_balance'], 125)
        self.assertEqual(admin_wallet['total_received'], 125)
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction['status'], 'completed')

    def test_onchain_deposit_stays_pending_until_verification(self):
        """اختبار أن الإيداع on-chain يبقى معلقًا ولا يضيف الرصيد مباشرة"""
        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = 'onchain' WHERE key = 'deposit_verification_mode'")
        conn.commit()
        conn.close()

        user_headers = {'Authorization': f'Bearer {self.access_token}'}
        deposit_response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 25,
            'tx_hash': '0xonchain-pending-deposit'
        }, headers=user_headers)

        self.assertEqual(deposit_response.status_code, 201)
        response_data = json.loads(deposit_response.data)
        self.assertEqual(response_data['data']['status'], 'pending')

        conn = get_db_connection()
        user = conn.execute("SELECT id FROM users WHERE email = 'test@example.com'").fetchone()
        user_wallet = conn.execute('''
            SELECT w.balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (user['id'],)).fetchone()
        admin_wallet = conn.execute('''
            SELECT current_balance, total_received
            FROM admin_wallets a
            JOIN currencies c ON c.id = a.currency_id
            JOIN networks n ON n.id = a.network_id
            WHERE c.code = 'USDT' AND n.code = 'TRC20'
            LIMIT 1
        ''').fetchone()
        transaction = conn.execute('''
            SELECT status, verified_at
            FROM transactions
            WHERE tx_hash = ?
        ''', ('0xonchain-pending-deposit',)).fetchone()
        conn.close()

        self.assertIsNotNone(user_wallet)
        self.assertEqual(user_wallet['balance'], 0)
        self.assertIsNotNone(admin_wallet)
        self.assertEqual(admin_wallet['current_balance'], 0)
        self.assertEqual(admin_wallet['total_received'], 0)
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction['status'], 'pending')
        self.assertIsNone(transaction['verified_at'])

    def test_monthly_profit_is_accrued_to_wallet_automatically(self):
        """اختبار إضافة ربح شهري تلقائي إلى محفظة المستخدم"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 7000,
            'tx_hash': '0xprofit-seed-deposit'
        }, headers=headers)

        conn = get_db_connection()
        investment = conn.execute('''
            SELECT id, min_investment, return_rate
            FROM investments
            WHERE status = 'active'
            ORDER BY id ASC
            LIMIT 1
        ''').fetchone()
        conn.close()
        self.assertIsNotNone(investment)

        invest_response = self.app.post('/api/invest', json={
            'investment_id': investment['id'],
            'amount': 100,
            'currency': 'USDT',
            'network': 'TRC20'
        }, headers=headers)
        self.assertEqual(invest_response.status_code, 201)

        conn = get_db_connection()
        user = conn.execute("SELECT id FROM users WHERE email = 'test@example.com'").fetchone()
        user_investment = conn.execute('''
            SELECT id
            FROM user_investments
            WHERE user_id = ? AND investment_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (user['id'], investment['id'])).fetchone()
        self.assertIsNotNone(user_investment)
        conn.execute('''
            UPDATE user_investments
            SET investment_date = DATETIME('now', '-30 day'),
                last_profit_date = NULL
            WHERE id = ?
        ''', (user_investment['id'],))
        before_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (user['id'],)).fetchone()
        conn.commit()
        conn.close()

        profile_response = self.app.get('/api/auth/profile', headers=headers)
        self.assertEqual(profile_response.status_code, 200)

        conn = get_db_connection()
        after_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (user['id'],)).fetchone()
        updated_position = conn.execute('''
            SELECT returns, last_profit_date
            FROM user_investments
            WHERE id = ?
        ''', (user_investment['id'],)).fetchone()
        conn.close()

        self.assertIsNotNone(after_wallet)
        self.assertIsNotNone(updated_position)
        expected_profit = 100 * (float(investment['return_rate']) / 100.0)
        self.assertAlmostEqual(after_wallet['balance'] - before_wallet['balance'], expected_profit, places=6)
        self.assertAlmostEqual(updated_position['returns'], expected_profit, places=6)
        self.assertIsNotNone(updated_position['last_profit_date'])

    def test_referrer_receives_bonus_from_referred_profit(self):
        """اختبار إضافة مكافأة إحالة إلى صاحب الرمز عند تحقق أرباح المستخدم المُحال"""
        referrer_register = self.app.post('/api/auth/register', json={
            'name': 'Referrer User',
            'email': 'referrer@example.com',
            'password': 'TestPassword123!',
            'phone': '+1111111111'
        })
        self.assertEqual(referrer_register.status_code, 201)
        referrer_code = json.loads(referrer_register.data)['data']['user']['referral_code']

        referred_register = self.app.post('/api/auth/register', json={
            'name': 'Referred User',
            'email': 'referred@example.com',
            'password': 'TestPassword123!',
            'phone': '+2222222222',
            'referral_code': referrer_code
        })
        self.assertEqual(referred_register.status_code, 201)

        referred_login = self.app.post('/api/auth/login', json={
            'email': 'referred@example.com',
            'password': 'TestPassword123!'
        })
        referred_token = json.loads(referred_login.data)['data']['access_token']
        referred_headers = {'Authorization': f'Bearer {referred_token}'}

        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 7000,
            'tx_hash': '0xreferral-seed-deposit'
        }, headers=referred_headers)

        conn = get_db_connection()
        investment = conn.execute('''
            SELECT id, return_rate
            FROM investments
            WHERE status = 'active'
            ORDER BY id ASC
            LIMIT 1
        ''').fetchone()
        conn.close()
        self.assertIsNotNone(investment)

        invest_response = self.app.post('/api/invest', json={
            'investment_id': investment['id'],
            'amount': 100,
            'currency': 'USDT',
            'network': 'TRC20'
        }, headers=referred_headers)
        self.assertEqual(invest_response.status_code, 201)

        conn = get_db_connection()
        referred_user = conn.execute("SELECT id FROM users WHERE email = 'referred@example.com'").fetchone()
        referrer_user = conn.execute("SELECT id FROM users WHERE email = 'referrer@example.com'").fetchone()
        user_investment = conn.execute('''
            SELECT id
            FROM user_investments
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (referred_user['id'],)).fetchone()
        conn.execute('''
            UPDATE user_investments
            SET investment_date = DATETIME('now', '-30 day'),
                last_profit_date = NULL
            WHERE id = ?
        ''', (user_investment['id'],))
        conn.commit()
        conn.close()

        profile_response = self.app.get('/api/auth/profile', headers=referred_headers)
        self.assertEqual(profile_response.status_code, 200)

        conn = get_db_connection()
        referrer_wallet = conn.execute('''
            SELECT w.balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            WHERE w.user_id = ? AND c.code = 'USDT'
        ''', (referrer_user['id'],)).fetchone()
        referral_tx = conn.execute('''
            SELECT amount, type, status
            FROM transactions
            WHERE user_id = ? AND type = 'referral_bonus'
            ORDER BY id DESC
            LIMIT 1
        ''', (referrer_user['id'],)).fetchone()
        conn.close()

        expected_profit = 100 * (float(investment['return_rate']) / 100.0)
        expected_bonus = expected_profit * 0.05
        self.assertIsNotNone(referrer_wallet)
        self.assertIsNotNone(referral_tx)
        self.assertAlmostEqual(referrer_wallet['balance'], expected_bonus, places=6)
        self.assertAlmostEqual(referral_tx['amount'], expected_bonus, places=6)
        self.assertEqual(referral_tx['status'], 'completed')

    def test_withdraw_requires_email_code_and_admin_approval(self):
        """اختبار سحب برمز بريد ثم موافقة الأدمن"""
        user_headers = {'Authorization': f'Bearer {self.access_token}'}
        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 25,
            'tx_hash': '0xwithdraw-seed'
        }, headers=user_headers)

        code_request = self.app.post('/api/transactions/withdraw/request-code', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5,
            'wallet_address': 'Twithdraw1234567890abcdef'
        }, headers=user_headers)

        self.assertEqual(code_request.status_code, 200)
        code_request_data = json.loads(code_request.data)
        self.assertTrue(code_request_data['success'])

        conn = get_db_connection()
        user = conn.execute("SELECT id FROM users WHERE email = 'test@example.com'").fetchone()
        code_row = conn.execute('''
            SELECT code
            FROM withdrawal_verification_codes
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (user['id'],)).fetchone()
        conn.close()
        self.assertIsNotNone(code_row)

        withdraw_response = self.app.post('/api/transactions/withdraw', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5,
            'wallet_address': 'Twithdraw1234567890abcdef',
            'verification_code': code_row['code']
        }, headers=user_headers)

        self.assertEqual(withdraw_response.status_code, 201)
        withdraw_data = json.loads(withdraw_response.data)
        self.assertTrue(withdraw_data['success'])
        self.assertEqual(withdraw_data['data']['status'], 'pending')

        admin_login = self.app.post('/api/auth/login', json={
            'email': 'admin@invest.com',
            'password': 'admin123'
        })
        admin_token = json.loads(admin_login.data)['data']['access_token']
        admin_headers = {'Authorization': f'Bearer {admin_token}'}

        approval_response = self.app.post(
            f"/api/admin/withdrawals/{withdraw_data['data']['withdrawal_id']}/approve",
            json={},
            headers=admin_headers
        )
        self.assertEqual(approval_response.status_code, 200)

        conn = get_db_connection()
        withdrawal = conn.execute('''
            SELECT status
            FROM withdrawal_requests
            WHERE id = ?
        ''', (withdraw_data['data']['withdrawal_id'],)).fetchone()
        conn.close()
        self.assertIsNotNone(withdrawal)
        self.assertEqual(withdrawal['status'], 'completed')

    def test_cancel_investment_refunds_wallet_minus_fee(self):
        """اختبار إلغاء الاستثمار مع خصم النسبة المحددة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 50,
            'tx_hash': '0xcancel-seed'
        }, headers=headers)

        conn = get_db_connection()
        conn.execute(
            "UPDATE system_settings SET value = '1' WHERE key = 'investment_cancellation_fee_rate'"
        )
        investment = conn.execute('''
            SELECT id
            FROM investments
            WHERE status = 'active'
            ORDER BY id ASC
            LIMIT 1
        ''').fetchone()
        before_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            JOIN users u ON u.id = w.user_id
            WHERE u.email = 'test@example.com' AND c.code = 'USDT'
        ''').fetchone()
        conn.commit()
        conn.close()

        invest_response = self.app.post('/api/invest', json={
            'investment_id': investment['id'],
            'amount': 10,
            'currency': 'USDT',
            'network': 'TRC20'
        }, headers=headers)
        self.assertEqual(invest_response.status_code, 201)

        cancel_response = self.app.post(f"/api/investments/{investment['id']}/cancel", headers=headers)
        self.assertEqual(cancel_response.status_code, 200)
        cancel_data = json.loads(cancel_response.data)
        self.assertAlmostEqual(cancel_data['data']['refund_amount'], 9.9, places=6)

        conn = get_db_connection()
        after_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            JOIN users u ON u.id = w.user_id
            WHERE u.email = 'test@example.com' AND c.code = 'USDT'
        ''').fetchone()
        position = conn.execute('''
            SELECT status
            FROM user_investments
            WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
              AND investment_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (investment['id'],)).fetchone()
        conn.close()

        self.assertIsNotNone(position)
        self.assertEqual(position['status'], 'cancelled')
        self.assertAlmostEqual(after_wallet['balance'] - before_wallet['balance'], -1.1, places=6)

    def test_investment_platform_fee_is_deducted_and_sent_to_admin_wallet(self):
        """اختبار خصم رسوم منصة الاستثمار من المستثمر وتحويلها إلى محفظة الأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 50,
            'tx_hash': '0xinvest-platform-fee-seed'
        }, headers=headers)

        conn = get_db_connection()
        conn.execute(
            "UPDATE system_settings SET value = '2' WHERE key = 'investor_investment_fee_percentage'"
        )
        investment = conn.execute('''
            SELECT id
            FROM investments
            WHERE status = 'active'
            ORDER BY id ASC
            LIMIT 1
        ''').fetchone()
        before_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            JOIN users u ON u.id = w.user_id
            WHERE u.email = 'test@example.com' AND c.code = 'USDT'
        ''').fetchone()
        before_admin_wallet = conn.execute('''
            SELECT current_balance
            FROM admin_wallets a
            JOIN currencies c ON c.id = a.currency_id
            JOIN networks n ON n.id = a.network_id
            WHERE c.code = 'USDT' AND n.code = 'TRC20'
            LIMIT 1
        ''').fetchone()
        conn.commit()
        conn.close()

        invest_response = self.app.post('/api/invest', json={
            'investment_id': investment['id'],
            'amount': 10,
            'currency': 'USDT',
            'network': 'TRC20'
        }, headers=headers)
        self.assertEqual(invest_response.status_code, 201)
        invest_data = json.loads(invest_response.data)
        self.assertAlmostEqual(invest_data['data']['platform_fee'], 0.2, places=6)
        self.assertAlmostEqual(invest_data['data']['network_fee'], 1.0, places=6)
        self.assertAlmostEqual(invest_data['data']['total_payment'], 11.2, places=6)

        conn = get_db_connection()
        after_wallet = conn.execute('''
            SELECT balance
            FROM user_wallets w
            JOIN currencies c ON c.id = w.currency_id
            JOIN users u ON u.id = w.user_id
            WHERE u.email = 'test@example.com' AND c.code = 'USDT'
        ''').fetchone()
        after_admin_wallet = conn.execute('''
            SELECT current_balance
            FROM admin_wallets a
            JOIN currencies c ON c.id = a.currency_id
            JOIN networks n ON n.id = a.network_id
            WHERE c.code = 'USDT' AND n.code = 'TRC20'
            LIMIT 1
        ''').fetchone()
        platform_fee_tx = conn.execute('''
            SELECT amount, type, status
            FROM transactions
            WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')
              AND type = 'investment_platform_fee'
            ORDER BY id DESC
            LIMIT 1
        ''').fetchone()
        conn.close()

        self.assertAlmostEqual(before_wallet['balance'] - after_wallet['balance'], 11.2, places=6)
        self.assertAlmostEqual(after_admin_wallet['current_balance'] - before_admin_wallet['current_balance'], 0.2, places=6)
        self.assertIsNotNone(platform_fee_tx)
        self.assertEqual(platform_fee_tx['type'], 'investment_platform_fee')
        self.assertEqual(platform_fee_tx['status'], 'completed')
        self.assertAlmostEqual(platform_fee_tx['amount'], 0.2, places=6)

    def test_transactions_feed_includes_withdrawal_requests(self):
        """اختبار أن سجل المعاملات يعرض طلب السحب نفسه مع التفاصيل"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        seed_response = self.app.post('/api/transactions/deposit', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 25,
            'tx_hash': '0xtransactions-feed-seed'
        }, headers=headers)
        self.assertEqual(seed_response.status_code, 201)

        code_request = self.app.post('/api/transactions/withdraw/request-code', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5,
            'wallet_address': 'Twithdraw-feed-123456'
        }, headers=headers)
        self.assertEqual(code_request.status_code, 200)

        conn = get_db_connection()
        code_row = conn.execute('''
            SELECT code
            FROM withdrawal_verification_codes
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user_id,)).fetchone()
        conn.close()
        self.assertIsNotNone(code_row)

        withdraw_response = self.app.post('/api/transactions/withdraw', json={
            'currency': 'USDT',
            'network': 'TRC20',
            'amount': 5,
            'wallet_address': 'Twithdraw-feed-123456',
            'verification_code': code_row['code']
        }, headers=headers)
        self.assertEqual(withdraw_response.status_code, 201)

        history_response = self.app.get('/api/transactions', headers=headers)
        self.assertEqual(history_response.status_code, 200)
        history_data = json.loads(history_response.data)
        items = history_data['data']['transactions']
        withdrawal_item = next((item for item in items if item['entry_source'] == 'withdrawal_request'), None)
        self.assertIsNotNone(withdrawal_item)
        self.assertEqual(withdrawal_item['type'], 'withdraw')
        self.assertEqual(withdrawal_item['wallet_address'], 'Twithdraw-feed-123456')
        self.assertEqual(withdrawal_item['status'], 'pending')


class AdminTestCase(unittest.TestCase):
    """اختبارات إدارة الأدمن"""
    
    def setUp(self):
        """إعداد بيئة الاختبار"""
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        
        # تسجيل الدخول كأدمن (الحساب الافتراضي)
        login_response = self.app.post('/api/auth/login', json={
            'email': 'admin@invest.com',
            'password': 'admin123'
        })
        
        login_data = json.loads(login_response.data)
        self.access_token = login_data['data']['access_token']
    
    def tearDown(self):
        """تنظيف بيئة الاختبار"""
        self.app_context.pop()
        os.unlink(self.db_file.name)
    
    def test_admin_dashboard(self):
        """اختبار لوحة تحكم الأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.get('/api/admin/dashboard', headers=headers)
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('stats', data['data'])
        self.assertIn('active_projects', data['data']['stats'])
        self.assertIn('pending_kyc_reviews', data['data']['stats'])
        self.assertIn('recent_security_events', data['data'])
        self.assertIn('recent_device_activity', data['data'])

    def test_admin_can_view_user_kyc_details_and_devices(self):
        """اختبار عرض تفاصيل KYC والأجهزة للأدمن"""
        set_email_verification(False)
        user_response = self.app.post('/api/auth/register', json={
            'name': 'KYC User',
            'email': 'kyc-user@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.assertEqual(user_response.status_code, 201)

        conn = get_db_connection()
        conn.execute('''
            UPDATE users
            SET kyc_status = 'pending',
                kyc_document_type = 'passport',
                kyc_full_name = 'Kyc User Example',
                kyc_document_urls_json = ?,
                kyc_submitted_at = CURRENT_TIMESTAMP
            WHERE email = 'kyc-user@example.com'
        ''', (json.dumps(['/uploads/kyc-passport-front.png', '/uploads/kyc-passport-back.png']),))
        conn.commit()
        conn.close()

        user_login = self.app.post('/api/auth/login', json={
            'email': 'kyc-user@example.com',
            'password': 'TestPassword123!'
        }, headers={'X-Device-Id': 'kyc-device-1', 'X-Device-Name': 'KYC Chrome'})
        self.assertEqual(user_login.status_code, 200)

        headers = {'Authorization': f'Bearer {self.access_token}'}
        users_response = self.app.get('/api/admin/users?limit=200', headers=headers)
        self.assertEqual(users_response.status_code, 200)
        users = json.loads(users_response.data)['data']['users']
        target_user = next(user for user in users if user['email'] == 'kyc-user@example.com')

        kyc_response = self.app.get(f"/api/admin/users/{target_user['id']}/kyc-details", headers=headers)
        self.assertEqual(kyc_response.status_code, 200)
        kyc_data = json.loads(kyc_response.data)['data']
        self.assertEqual(kyc_data['user']['kyc_status'], 'pending')
        self.assertEqual(len(kyc_data['user']['kyc_document_urls']), 2)
        self.assertIn('smart_screening', kyc_data)
        self.assertIn('checks', kyc_data['smart_screening'])

        devices_response = self.app.get(f"/api/admin/users/{target_user['id']}/devices", headers=headers)
        self.assertEqual(devices_response.status_code, 200)
        devices_data = json.loads(devices_response.data)['data']
        self.assertGreaterEqual(len(devices_data['devices']), 1)

    def test_admin_security_overview_lists_devices_and_logs(self):
        """اختبار السجل الأمني وملخص الأجهزة في لوحة الأدمن"""
        self.app.post('/api/auth/login', json={
            'email': 'admin@invest.com',
            'password': 'wrong-password'
        }, headers={'X-Device-Id': 'security-log-device', 'X-Device-Name': 'Security Chrome'})

        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.get('/api/admin/security/overview', headers=headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)['data']
        self.assertIn('summary', data)
        self.assertIn('devices', data)
        self.assertIn('logs', data)
        self.assertIn('audit_logs', data)

    def test_admin_can_create_and_list_backups(self):
        """اختبار إنشاء النسخ الاحتياطية وعرضها للأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        create_response = self.app.post('/api/settings/backups/create', json={}, headers=headers)
        self.assertEqual(create_response.status_code, 201)
        create_data = json.loads(create_response.data)
        self.assertTrue(create_data['success'])
        self.assertIn('filename', create_data['data'])

        list_response = self.app.get('/api/settings/backups', headers=headers)
        self.assertEqual(list_response.status_code, 200)
        list_data = json.loads(list_response.data)
        self.assertGreaterEqual(len(list_data['data']['backups']), 1)

    def test_admin_can_manage_financial_channels(self):
        """اختبار إنشاء وعرض وحذف القنوات المالية الحقيقية"""
        create_receiving_wallet(address='TADMINCHANNEL1234567890ABCDE')
        conn = get_db_connection()
        admin_wallet = conn.execute('''
            SELECT id, currency_id, network_id
            FROM admin_wallets
            ORDER BY id DESC
            LIMIT 1
        ''').fetchone()
        conn.close()

        headers = {'Authorization': f'Bearer {self.access_token}'}
        create_response = self.app.post('/api/admin/financial-channels', json={
            'channel_type': 'crypto',
            'title': 'قناة تحويل رئيسية',
            'description': 'قناة مستقلة ضمن قسم المحفظة',
            'country_code': 'SY',
            'country_name': 'سوريا',
            'currency_id': admin_wallet['currency_id'],
            'network_id': admin_wallet['network_id'],
            'admin_wallet_id': admin_wallet['id'],
            'account_label': 'محفظة الاستقبال',
            'instructions': 'انسخ العنوان ثم أرسل المبلغ',
            'display_order': 2,
            'is_active': True
        }, headers=headers)
        self.assertEqual(create_response.status_code, 201)
        create_data = json.loads(create_response.data)
        channel_id = create_data['data']['channel_id']

        list_response = self.app.get('/api/admin/financial-channels', headers=headers)
        self.assertEqual(list_response.status_code, 200)
        list_data = json.loads(list_response.data)['data']['channels']
        self.assertTrue(any(item['id'] == channel_id for item in list_data))

        delete_response = self.app.delete(f'/api/admin/financial-channels/{channel_id}', headers=headers)
        self.assertEqual(delete_response.status_code, 200)

    def test_admin_can_manage_real_crypto_wallet_pool(self):
        """اختبار إدارة مخزون المحافظ الحقيقية المستقلة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        create_response = self.app.post('/api/admin/real-crypto-wallet-pool', json={
            'currency_id': 1,
            'network_id': 1,
            'address': 'TPOOLADMIN123456789012345678',
            'label': 'TRC20 Pool #1',
            'provider_name': 'Treasury',
            'notes': 'عنوان مستقل للتخصيص',
            'is_active': True
        }, headers=headers)
        self.assertEqual(create_response.status_code, 201)
        pool_id = json.loads(create_response.data)['data']['pool_id']

        list_response = self.app.get('/api/admin/real-crypto-wallet-pool', headers=headers)
        self.assertEqual(list_response.status_code, 200)
        wallets = json.loads(list_response.data)['data']['wallets']
        self.assertTrue(any(item['id'] == pool_id for item in wallets))

        delete_response = self.app.delete(f'/api/admin/real-crypto-wallet-pool/{pool_id}', headers=headers)
        self.assertEqual(delete_response.status_code, 200)

    def test_admin_withdrawals_support_all_statuses(self):
        """اختبار دعم كل حالات السحب في لوحة الأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        set_email_verification(False)

        user_response = self.app.post('/api/auth/register', json={
            'name': 'Withdrawal User',
            'email': 'withdraw-all@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567000'
        })
        user_token = json.loads(user_response.data)['data']['access_token']
        user_headers = {'Authorization': f'Bearer {user_token}'}

        conn = get_db_connection()
        currency = conn.execute("SELECT id FROM currencies WHERE code = 'USDT'").fetchone()
        network = conn.execute("SELECT id FROM networks WHERE code = 'TRC20'").fetchone()
        user = conn.execute("SELECT id FROM users WHERE email = 'withdraw-all@example.com'").fetchone()
        conn.execute('''
            UPDATE user_wallets
            SET balance = 100, pending_balance = 0
            WHERE user_id = ? AND currency_id = ?
        ''', (user['id'], currency['id']))
        conn.commit()
        conn.close()

        request_code = self.app.post('/api/transactions/withdraw/request-code', json={
            'amount': 5,
            'currency': 'USDT',
            'network': 'TRC20',
            'wallet_address': 'TWITHDRAW123456789'
        }, headers=user_headers)
        self.assertEqual(request_code.status_code, 200)

        conn = get_db_connection()
        code_row = conn.execute('''
            SELECT code FROM withdrawal_verification_codes
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 1
        ''', (user['id'],)).fetchone()
        conn.close()

        withdraw_response = self.app.post('/api/transactions/withdraw', json={
            'amount': 5,
            'currency': 'USDT',
            'network': 'TRC20',
            'wallet_address': 'TWITHDRAW123456789',
            'verification_code': code_row['code']
        }, headers=user_headers)
        self.assertEqual(withdraw_response.status_code, 201)

        admin_response = self.app.get('/api/admin/withdrawals?status=all', headers=headers)
        self.assertEqual(admin_response.status_code, 200)
        data = json.loads(admin_response.data)
        self.assertTrue(data['success'])
        self.assertGreaterEqual(data['data']['total'], 1)

    def test_no_placeholder_receiving_wallets_seeded_by_default(self):
        """اختبار عدم إنشاء محافظ استقبال وهمية بشكل افتراضي"""
        conn = get_db_connection()
        count_row = conn.execute('SELECT COUNT(*) as total FROM admin_wallets').fetchone()
        conn.close()
        self.assertEqual(count_row['total'], 0)
    
    def test_create_receiving_wallet(self):
        """اختبار إضافة محفظة استقبال"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post('/api/admin/receiving-wallets', json={
            'currency_id': 1,
            'network_id': 1,
            'address': 'T1234567890abcdef1234567890ab',
            'label': 'Test Wallet'
        }, headers=headers)
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])

    def test_admin_wallet_dashboard_returns_summary(self):
        """اختبار أن لوحة محافظ الأدمن تعيد المحافظ مع الملخص"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        create_response = self.app.post('/api/admin/receiving-wallets', json={
            'currency_id': 1,
            'network_id': 1,
            'address': 'Tadminwalletsummary1234567890abcdef',
            'label': 'Summary Wallet'
        }, headers=headers)
        self.assertEqual(create_response.status_code, 201)

        response = self.app.get('/api/admin/wallets', headers=headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('wallets', data['data'])
        self.assertIn('summary', data['data'])
        self.assertGreaterEqual(len(data['data']['wallets']), 1)
        self.assertGreaterEqual(data['data']['summary']['total_wallets'], 1)

    def test_admin_can_toggle_receiving_wallet_status(self):
        """اختبار تفعيل وإيقاف محفظة الأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        create_response = self.app.post('/api/admin/receiving-wallets', json={
            'currency_id': 1,
            'network_id': 1,
            'address': 'Tadminwallettoggle1234567890abcdef',
            'label': 'Toggle Wallet'
        }, headers=headers)
        self.assertEqual(create_response.status_code, 201)
        wallet_id = json.loads(create_response.data)['data']['wallet_id']

        disable_response = self.app.put(f'/api/admin/wallets/{wallet_id}', json={
            'is_active': False
        }, headers=headers)
        self.assertEqual(disable_response.status_code, 200)

        conn = get_db_connection()
        wallet = conn.execute('SELECT is_active FROM admin_wallets WHERE id = ?', (wallet_id,)).fetchone()
        conn.close()
        self.assertIsNotNone(wallet)
        self.assertEqual(wallet['is_active'], 0)

    def test_governorates_are_public(self):
        """اختبار ظهور المحافظات للمستخدمين"""
        response = self.app.get('/api/governorates')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertGreater(len(data['data']['governorates']), 0)

    def test_create_governorate_and_investment(self):
        """اختبار إضافة محافظة وربط مشروع عقاري بها"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorate_response = self.app.post('/api/admin/governorates', json={
            'name': 'محافظة اختبار',
            'symbol': 'رمز اختبار',
            'description': 'وصف محافظة اختبارية',
            'image_url': 'https://example.com/test.jpg'
        }, headers=headers)

        self.assertEqual(governorate_response.status_code, 201)
        governorate_id = json.loads(governorate_response.data)['data']['governorate_id']

        investment_response = self.app.post('/api/investments', json={
            'name': 'مشروع عقاري اختباري',
            'description': 'مشروع مرتبط بمحافظة',
            'total_amount': 50000,
            'admin_amount': 0,
            'min_investment': 100,
            'return_rate': 10,
            'duration': 12,
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)

        self.assertEqual(investment_response.status_code, 201)

        filtered_response = self.app.get(f'/api/investments?governorate_id={governorate_id}')
        data = json.loads(filtered_response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['investments'][0]['governorate_id'], governorate_id)

    def test_create_small_investment_with_zero_minimum(self):
        """اختبار قبول مشروع صغير بحد أدنى استثمار صفر"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorates_response = self.app.get('/api/admin/governorates', headers=headers)
        governorate_id = json.loads(governorates_response.data)['data']['governorates'][0]['id']

        investment_response = self.app.post('/api/investments', json={
            'name': 'مشروع صغير',
            'description': 'فرصة استثمارية صغيرة للاختبار',
            'total_amount': 100,
            'admin_amount': 0,
            'min_investment': 0,
            'return_rate': 10,
            'duration': 6,
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)

        self.assertEqual(investment_response.status_code, 201)
        data = json.loads(investment_response.data)
        self.assertTrue(data['success'])

    def test_create_investment_with_image_and_dates(self):
        """اختبار حفظ صورة المشروع وتواريخ التنفيذ"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorates_response = self.app.get('/api/admin/governorates', headers=headers)
        governorate_id = json.loads(governorates_response.data)['data']['governorates'][0]['id']

        create_response = self.app.post('/api/investments', json={
            'name': 'مشروع بصورة وتواريخ',
            'description': 'مشروع واضح للمستثمر',
            'image_url': 'https://example.com/project.jpg',
            'total_amount': 25000,
            'admin_amount': 0,
            'min_investment': 50,
            'return_rate': 12,
            'duration': 8,
            'start_date': '2026-06-01',
            'end_date': '2027-01-31',
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)

        self.assertEqual(create_response.status_code, 201)

        list_response = self.app.get(f'/api/investments?governorate_id={governorate_id}')
        self.assertEqual(list_response.status_code, 200)
        investments = json.loads(list_response.data)['data']['investments']
        created = next(inv for inv in investments if inv['name'] == 'مشروع بصورة وتواريخ')
        self.assertEqual(created['image_url'], 'https://example.com/project.jpg')
        self.assertEqual(created['start_date'], '2026-06-01')
        self.assertEqual(created['end_date'], '2027-01-31')

    def test_create_investment_with_multiple_images_gallery(self):
        """اختبار حفظ معرض صور المشروع وإرجاعه في القائمة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorates_response = self.app.get('/api/admin/governorates', headers=headers)
        governorate_id = json.loads(governorates_response.data)['data']['governorates'][0]['id']

        gallery_urls = [
            'https://example.com/project-main.jpg',
            'https://example.com/project-side.jpg',
            'https://example.com/project-lobby.jpg'
        ]

        create_response = self.app.post('/api/investments', json={
            'name': 'مشروع بمعرض صور',
            'description': 'مشروع يعرض أكثر من صورة للمستثمر',
            'image_url': gallery_urls[0],
            'image_gallery': gallery_urls,
            'total_amount': 30000,
            'admin_amount': 0,
            'min_investment': 100,
            'return_rate': 11,
            'duration': 10,
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)

        self.assertEqual(create_response.status_code, 201)
        created_payload = json.loads(create_response.data)
        self.assertEqual(created_payload['data']['investment']['image_gallery'], gallery_urls)

        list_response = self.app.get(f'/api/investments?governorate_id={governorate_id}')
        investments = json.loads(list_response.data)['data']['investments']
        created = next(inv for inv in investments if inv['name'] == 'مشروع بمعرض صور')
        self.assertEqual(created['image_url'], gallery_urls[0])
        self.assertEqual(created['image_gallery'], gallery_urls)

    def test_admin_can_upload_multiple_project_images(self):
        """اختبار رفع عدة صور للمشروع"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = self.app.post(
            '/api/investments/images/upload',
            headers=headers,
            data={
                'files': [
                    (io.BytesIO(b'fake-image-1'), 'project1.jpg'),
                    (io.BytesIO(b'fake-image-2'), 'project2.png')
                ]
            },
            content_type='multipart/form-data'
        )

        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']['image_urls']), 2)
        self.assertTrue(all(url.startswith('/uploads/project_') for url in data['data']['image_urls']))

    def test_admin_can_delete_empty_investment(self):
        """اختبار حذف مشروع لا يحتوي على أموال مجمعة"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorates_response = self.app.get('/api/admin/governorates', headers=headers)
        governorate_id = json.loads(governorates_response.data)['data']['governorates'][0]['id']

        create_response = self.app.post('/api/investments', json={
            'name': 'مشروع للحذف',
            'description': 'مشروع سيتم حذفه',
            'total_amount': 5000,
            'admin_amount': 0,
            'min_investment': 0,
            'return_rate': 9,
            'duration': 6,
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)

        self.assertEqual(create_response.status_code, 201)
        investment_id = json.loads(create_response.data)['data']['investment_id']

        delete_response = self.app.delete(f'/api/admin/investments/{investment_id}', headers=headers)
        self.assertEqual(delete_response.status_code, 200)

        admin_list_response = self.app.get('/api/admin/investments', headers=headers)
        investments = json.loads(admin_list_response.data)['data']['investments']
        self.assertFalse(any(inv['id'] == investment_id for inv in investments))

    def test_admin_can_update_investment_details(self):
        """اختبار تعديل مشروع من لوحة الأدمن"""
        headers = {'Authorization': f'Bearer {self.access_token}'}
        governorates_response = self.app.get('/api/admin/governorates', headers=headers)
        governorate_id = json.loads(governorates_response.data)['data']['governorates'][0]['id']

        create_response = self.app.post('/api/investments', json={
            'name': 'مشروع قبل التعديل',
            'description': 'وصف أولي',
            'image_url': 'https://example.com/old.jpg',
            'total_amount': 8000,
            'admin_amount': 0,
            'min_investment': 100,
            'return_rate': 11,
            'duration': 9,
            'start_date': '2026-06-01',
            'end_date': '2027-02-01',
            'category': 'real-estate',
            'governorate_id': governorate_id
        }, headers=headers)
        self.assertEqual(create_response.status_code, 201)
        investment_id = json.loads(create_response.data)['data']['investment_id']

        update_response = self.app.put(f'/api/admin/investments/{investment_id}', json={
            'name': 'مشروع بعد التعديل',
            'description': 'وصف محدّث',
            'image_url': 'https://example.com/new.jpg',
            'total_amount': 9000,
            'min_investment': 50,
            'return_rate': 13,
            'duration': 10,
            'start_date': '2026-07-01',
            'end_date': '2027-03-01',
            'category': 'trade',
            'governorate_id': governorate_id
        }, headers=headers)
        self.assertEqual(update_response.status_code, 200)

        list_response = self.app.get(f'/api/investments?governorate_id={governorate_id}')
        investments = json.loads(list_response.data)['data']['investments']
        updated = next(inv for inv in investments if inv['id'] == investment_id)
        self.assertEqual(updated['name'], 'مشروع بعد التعديل')
        self.assertEqual(updated['description'], 'وصف محدّث')
        self.assertEqual(updated['image_url'], 'https://example.com/new.jpg')
        self.assertEqual(updated['total_amount'], 9000)
        self.assertEqual(updated['min_investment'], 50)
        self.assertEqual(updated['return_rate'], 13)
        self.assertEqual(updated['duration'], 10)
        self.assertEqual(updated['start_date'], '2026-07-01')
        self.assertEqual(updated['end_date'], '2027-03-01')
        self.assertEqual(updated['category'], 'trade')


class PropertyListingTestCase(unittest.TestCase):
    """اختبارات بيع العقارات والنشر التلقائي"""

    def setUp(self):
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        self.upload_dir = tempfile.mkdtemp(prefix='property-uploads-')
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['UPLOAD_FOLDER'] = self.upload_dir
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)
        create_receiving_wallet()

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Property Seller',
            'email': 'seller@example.com',
            'password': 'TestPassword123!',
            'phone': '+963955000000'
        })
        self.assertEqual(register_response.status_code, 201)
        self.user_token = json.loads(register_response.data)['data']['access_token']
        self.user_headers = {'Authorization': f'Bearer {self.user_token}'}

        conn = get_db_connection()
        self.user = conn.execute("SELECT id FROM users WHERE email = 'seller@example.com'").fetchone()
        self.governorate = conn.execute('SELECT id FROM governorates ORDER BY id ASC LIMIT 1').fetchone()
        conn.execute("UPDATE system_settings SET value = 'fixed' WHERE key = 'property_listing_fee_mode'")
        conn.execute("UPDATE system_settings SET value = '10' WHERE key = 'property_listing_fee_fixed_amount'")
        conn.execute("UPDATE system_settings SET value = 'USDT' WHERE key = 'property_listing_fee_currency'")
        conn.execute("UPDATE system_settings SET value = 'TRC20' WHERE key = 'property_listing_fee_network'")
        conn.execute('''
            UPDATE user_wallets
            SET balance = 100, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = 1
        ''', (self.user['id'],))
        conn.commit()
        conn.close()

    def tearDown(self):
        self.app_context.pop()
        if os.path.exists(self.db_file.name):
            os.unlink(self.db_file.name)
        if os.path.isdir(self.upload_dir):
            for root, _, files in os.walk(self.upload_dir, topdown=False):
                for filename in files:
                    os.remove(os.path.join(root, filename))
            os.rmdir(self.upload_dir)

    def test_property_assets_upload_supports_images_and_kyc_documents(self):
        """اختبار رفع صور العقار وملفات KYC"""
        image_response = self.app.post(
            '/api/properties/assets/upload',
            headers=self.user_headers,
            data={
                'category': 'images',
                'files': [
                    (io.BytesIO(b'fake-image-one'), 'property-1.jpg'),
                    (io.BytesIO(b'fake-image-two'), 'property-2.png')
                ]
            },
            content_type='multipart/form-data'
        )
        self.assertEqual(image_response.status_code, 201)
        image_data = json.loads(image_response.data)
        self.assertEqual(len(image_data['data']['file_urls']), 2)
        self.assertTrue(all(url.startswith('/uploads/property_images_') for url in image_data['data']['file_urls']))

        kyc_response = self.app.post(
            '/api/properties/assets/upload',
            headers=self.user_headers,
            data={
                'category': 'kyc',
                'files': [
                    (io.BytesIO(b'fake-kyc-image'), 'kyc-front.jpg'),
                    (io.BytesIO(b'%PDF-1.4 fake pdf body'), 'kyc-proof.pdf')
                ]
            },
            content_type='multipart/form-data'
        )
        self.assertEqual(kyc_response.status_code, 201)
        kyc_data = json.loads(kyc_response.data)
        self.assertEqual(len(kyc_data['data']['file_urls']), 2)
        self.assertTrue(any(url.endswith('.pdf') for url in kyc_data['data']['file_urls']))

    def test_property_listing_publishes_immediately_for_verified_account_with_fee_deduction(self):
        """اختبار نشر العقار مباشرة من حساب موثق بعد اكتمال الصور ودفع الرسوم"""
        conn = get_db_connection()
        conn.execute("""
            UPDATE users
            SET kyc_status = 'verified',
                kyc_verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (self.user['id'],))
        conn.commit()
        conn.close()

        payload = {
            'title': 'فيلا حديثة على البحر',
            'description': 'عقار كامل التفاصيل مع صور متعددة لإقناع المستثمر والمشتري.',
            'property_type': 'villa',
            'sale_price': 250000,
            'area_size': 320,
            'governorate_id': self.governorate['id'],
            'address': 'حي الواجهة البحرية - عقار 12',
            'contact_name': 'أحمد البائع',
            'contact_phone': '+963944111222',
            'contact_email': 'owner@example.com',
            'image_gallery': [
                '/uploads/property_images_cover.jpg',
                '/uploads/property_images_living-room.jpg',
                '/uploads/property_images_garden.jpg'
            ]
        }

        create_response = self.app.post('/api/properties', json=payload, headers=self.user_headers)
        self.assertEqual(create_response.status_code, 201)
        create_data = json.loads(create_response.data)
        self.assertTrue(create_data['success'])
        self.assertEqual(create_data['data']['property']['status'], 'published')
        self.assertEqual(create_data['data']['property']['image_gallery'], payload['image_gallery'])
        self.assertEqual(create_data['data']['property']['image_url'], payload['image_gallery'][0])
        self.assertEqual(create_data['data']['platform_fee']['mode'], 'fixed')
        self.assertEqual(create_data['data']['platform_fee']['value'], 10)

        conn = get_db_connection()
        wallet_after = conn.execute('''
            SELECT balance
            FROM user_wallets
            WHERE user_id = ? AND currency_id = 1
        ''', (self.user['id'],)).fetchone()
        fee_transaction = conn.execute('''
            SELECT id, type, amount, status
            FROM transactions
            WHERE user_id = ? AND type = 'property_listing_fee'
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user['id'],)).fetchone()
        stored_property = conn.execute('''
            SELECT status, image_url, image_gallery_json, kyc_document_urls_json, platform_fee_paid
            FROM property_listings
            WHERE seller_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user['id'],)).fetchone()
        conn.close()

        self.assertAlmostEqual(wallet_after['balance'], 90, places=6)
        self.assertIsNotNone(fee_transaction)
        self.assertEqual(fee_transaction['status'], 'completed')
        self.assertEqual(fee_transaction['amount'], 10)
        self.assertIsNotNone(stored_property)
        self.assertEqual(stored_property['status'], 'published')
        self.assertEqual(stored_property['image_url'], payload['image_gallery'][0])
        self.assertEqual(json.loads(stored_property['image_gallery_json']), payload['image_gallery'])
        self.assertFalse(stored_property['kyc_document_urls_json'])
        self.assertEqual(stored_property['platform_fee_paid'], 1)

        listing_response = self.app.get(f'/api/properties?governorate_id={self.governorate["id"]}')
        self.assertEqual(listing_response.status_code, 200)
        listing_data = json.loads(listing_response.data)
        self.assertGreaterEqual(listing_data['data']['total'], 1)
        property_item = listing_data['data']['properties'][0]
        self.assertEqual(property_item['title'], 'فيلا حديثة على البحر')
        self.assertEqual(property_item['image_gallery'], payload['image_gallery'])
        self.assertEqual(property_item['contact_phone'], '+963944111222')
        self.assertEqual(property_item['property_type'], 'villa')

    def test_property_listing_allows_zero_fee_without_admin_wallet(self):
        """اختبار نشر العقار عند جعل الرسوم صفر بدون اشتراط محفظة أدمن"""
        conn = get_db_connection()
        conn.execute("""
            UPDATE users
            SET kyc_status = 'verified',
                kyc_verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (self.user['id'],))
        conn.execute("UPDATE system_settings SET value = 'fixed' WHERE key = 'property_listing_fee_mode'")
        conn.execute("UPDATE system_settings SET value = '0' WHERE key = 'property_listing_fee_fixed_amount'")
        conn.execute("DELETE FROM admin_wallets")
        conn.commit()
        conn.close()

        payload = {
            'title': 'شقة بسعر مناسب',
            'description': 'إعلان عقار برسوم نشر مجانية.',
            'property_type': 'apartment',
            'sale_price': 90000,
            'area_size': 140,
            'governorate_id': self.governorate['id'],
            'address': 'الطابق الثالث - الحي الشرقي',
            'contact_name': 'صاحب الإعلان',
            'contact_phone': '+963933000111',
            'contact_email': 'free@example.com',
            'image_gallery': [
                '/uploads/property_images_free_1.jpg',
                '/uploads/property_images_free_2.jpg'
            ]
        }

        create_response = self.app.post('/api/properties', json=payload, headers=self.user_headers)
        self.assertEqual(create_response.status_code, 201)
        create_data = json.loads(create_response.data)
        self.assertTrue(create_data['success'])
        self.assertEqual(create_data['data']['platform_fee']['value'], 0)
        self.assertEqual(create_data['data']['property']['status'], 'published')

        conn = get_db_connection()
        wallet_after = conn.execute('''
            SELECT balance
            FROM user_wallets
            WHERE user_id = ? AND currency_id = 1
        ''', (self.user['id'],)).fetchone()
        fee_transaction = conn.execute('''
            SELECT id
            FROM transactions
            WHERE user_id = ? AND type = 'property_listing_fee'
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user['id'],)).fetchone()
        stored_property = conn.execute('''
            SELECT platform_fee_paid, platform_fee_transaction_id
            FROM property_listings
            WHERE seller_id = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (self.user['id'],)).fetchone()
        conn.close()

        self.assertAlmostEqual(wallet_after['balance'], 100, places=6)
        self.assertIsNone(fee_transaction)
        self.assertEqual(stored_property['platform_fee_paid'], 1)
        self.assertIsNone(stored_property['platform_fee_transaction_id'])


class MessageTestCase(unittest.TestCase):
    """اختبارات الرسائل الداخلية"""

    def setUp(self):
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Message User',
            'email': 'message@example.com',
            'password': 'TestPassword123!',
            'phone': '+1234567890'
        })
        self.user_token = json.loads(register_response.data)['data']['access_token']
        self.user_headers = {'Authorization': f'Bearer {self.user_token}'}

        second_response = self.app.post('/api/auth/register', json={
            'name': 'Receiver User',
            'email': 'receiver@example.com',
            'password': 'TestPassword123!',
            'phone': '+1987654321'
        })
        self.second_token = json.loads(second_response.data)['data']['access_token']
        self.second_headers = {'Authorization': f'Bearer {self.second_token}'}

        conn = get_db_connection()
        self.receiver = conn.execute("SELECT public_user_id FROM users WHERE email = 'receiver@example.com'").fetchone()
        conn.close()

    def tearDown(self):
        self.app_context.pop()
        os.unlink(self.db_file.name)

    def test_support_conversation_and_message(self):
        response = self.app.post('/api/messages/conversations', json={
            'target_type': 'support'
        }, headers=self.user_headers)
        self.assertIn(response.status_code, (200, 201))
        data = json.loads(response.data)
        conversation_id = data['data']['conversation']['id']

        message_response = self.app.post(f'/api/messages/conversations/{conversation_id}/messages', json={
            'body': 'أحتاج إلى مساعدة في الاستثمار',
            'message_type': 'text'
        }, headers=self.user_headers)
        self.assertEqual(message_response.status_code, 201)

        fetch_response = self.app.get(f'/api/messages/conversations/{conversation_id}', headers=self.user_headers)
        self.assertEqual(fetch_response.status_code, 200)
        fetch_data = json.loads(fetch_response.data)
        self.assertEqual(len(fetch_data['data']['messages']), 1)
        self.assertEqual(fetch_data['data']['messages'][0]['body'], 'أحتاج إلى مساعدة في الاستثمار')

    def test_direct_conversation_by_public_account_id(self):
        response = self.app.post('/api/messages/conversations', json={
            'target_type': 'user',
            'recipient_public_id': self.receiver['public_user_id']
        }, headers=self.user_headers)
        self.assertIn(response.status_code, (200, 201))
        data = json.loads(response.data)
        conversation_id = data['data']['conversation']['id']

        message_response = self.app.post(f'/api/messages/conversations/{conversation_id}/messages', json={
            'body': 'مرحبا، هل استثمرت في هذا المشروع؟',
            'message_type': 'text'
        }, headers=self.user_headers)
        self.assertEqual(message_response.status_code, 201)

        receiver_fetch = self.app.get(f'/api/messages/conversations/{conversation_id}', headers=self.second_headers)
        self.assertEqual(receiver_fetch.status_code, 200)
        receiver_data = json.loads(receiver_fetch.data)
        self.assertEqual(receiver_data['data']['messages'][0]['body'], 'مرحبا، هل استثمرت في هذا المشروع؟')

    def test_read_receipt_marks_message_as_read(self):
        response = self.app.post('/api/messages/conversations', json={
            'target_type': 'user',
            'recipient_public_id': self.receiver['public_user_id']
        }, headers=self.user_headers)
        conversation_id = json.loads(response.data)['data']['conversation']['id']

        self.app.post(f'/api/messages/conversations/{conversation_id}/messages', json={
            'body': 'رسالة تحتاج قراءة',
            'message_type': 'text'
        }, headers=self.user_headers)

        before_fetch = self.app.get('/api/messages/conversations', headers=self.second_headers)
        before_data = json.loads(before_fetch.data)
        self.assertEqual(before_data['data']['conversations'][0]['unread_count'], 1)

        receiver_fetch = self.app.get(f'/api/messages/conversations/{conversation_id}', headers=self.second_headers)
        receiver_data = json.loads(receiver_fetch.data)
        self.assertIsNotNone(receiver_data['data']['messages'][0]['read_at'])

        after_fetch = self.app.get('/api/messages/conversations', headers=self.second_headers)
        after_data = json.loads(after_fetch.data)
        self.assertEqual(after_data['data']['conversations'][0]['unread_count'], 0)

    def test_sender_can_delete_message_for_everyone(self):
        response = self.app.post('/api/messages/conversations', json={
            'target_type': 'user',
            'recipient_public_id': self.receiver['public_user_id']
        }, headers=self.user_headers)
        conversation_id = json.loads(response.data)['data']['conversation']['id']

        message_response = self.app.post(f'/api/messages/conversations/{conversation_id}/messages', json={
            'body': 'رسالة يجب حذفها',
            'message_type': 'text'
        }, headers=self.user_headers)
        self.assertEqual(message_response.status_code, 201)
        message_id = json.loads(message_response.data)['data']['message_item']['id']

        delete_response = self.app.delete(f'/api/messages/messages/{message_id}', headers=self.user_headers)
        self.assertEqual(delete_response.status_code, 200)

        fetch_response = self.app.get(f'/api/messages/conversations/{conversation_id}', headers=self.second_headers)
        fetch_data = json.loads(fetch_response.data)
        self.assertEqual(fetch_data['data']['messages'], [])

    def test_audio_call_flow_and_signaling(self):
        response = self.app.post('/api/messages/conversations', json={
            'target_type': 'user',
            'recipient_public_id': self.receiver['public_user_id']
        }, headers=self.user_headers)
        conversation_id = json.loads(response.data)['data']['conversation']['id']

        start_call = self.app.post(f'/api/messages/conversations/{conversation_id}/call', json={
            'call_type': 'audio'
        }, headers=self.user_headers)
        self.assertEqual(start_call.status_code, 201)
        call = json.loads(start_call.data)['data']['call']
        call_id = call['id']
        self.assertEqual(call['status'], 'ringing')

        signal_response = self.app.post(f'/api/messages/calls/{call_id}/signal', json={
            'signal_type': 'offer',
            'payload': {'type': 'offer', 'sdp': 'fake-offer'}
        }, headers=self.user_headers)
        self.assertEqual(signal_response.status_code, 201)

        fetch_signals = self.app.get(f'/api/messages/calls/{call_id}/signals?after_id=0', headers=self.second_headers)
        self.assertEqual(fetch_signals.status_code, 200)
        signals_data = json.loads(fetch_signals.data)
        self.assertEqual(len(signals_data['data']['signals']), 1)
        self.assertEqual(signals_data['data']['signals'][0]['signal_type'], 'offer')

        accept_call = self.app.post(f'/api/messages/calls/{call_id}/action', json={
            'action': 'accept'
        }, headers=self.second_headers)
        self.assertEqual(accept_call.status_code, 200)
        self.assertEqual(json.loads(accept_call.data)['data']['call']['status'], 'active')

        end_call = self.app.post(f'/api/messages/calls/{call_id}/action', json={
            'action': 'end'
        }, headers=self.user_headers)
        self.assertEqual(end_call.status_code, 200)
        self.assertEqual(json.loads(end_call.data)['data']['call']['status'], 'ended')


class CompanyFinancialFlowsTestCase(unittest.TestCase):
    """اختبارات الرسوم المالية للشركات"""

    def setUp(self):
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)
        create_receiving_wallet()

        register_response = self.app.post('/api/auth/register', json={
            'name': 'Investment Company',
            'email': 'investment-company@example.com',
            'password': 'TestPassword123!',
            'phone': '+963955000333',
            'account_type': 'company',
            'company_name': 'Investment Company LLC',
            'representative_name': 'Rep Two'
        })
        self.assertEqual(register_response.status_code, 201)
        self.company_token = json.loads(register_response.data)['data']['access_token']
        self.company_headers = {'Authorization': f'Bearer {self.company_token}'}

        conn = get_db_connection()
        self.company_user = conn.execute("SELECT id FROM users WHERE email = 'investment-company@example.com'").fetchone()
        self.governorate = conn.execute('SELECT id FROM governorates ORDER BY id ASC LIMIT 1').fetchone()
        conn.execute("""
            UPDATE users
            SET kyc_status = 'verified',
                kyc_verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (self.company_user['id'],))
        conn.execute("UPDATE system_settings SET value = 'fixed' WHERE key = 'company_investment_fee_mode'")
        conn.execute("UPDATE system_settings SET value = '25' WHERE key = 'company_investment_fee_fixed_amount'")
        conn.execute("UPDATE system_settings SET value = 'USDT' WHERE key = 'company_investment_fee_currency'")
        conn.execute("UPDATE system_settings SET value = 'TRC20' WHERE key = 'company_investment_fee_network'")
        conn.execute('''
            UPDATE user_wallets
            SET balance = 200, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND currency_id = 1
        ''', (self.company_user['id'],))
        conn.commit()
        conn.close()

    def tearDown(self):
        self.app_context.pop()
        if os.path.exists(self.db_file.name):
            os.unlink(self.db_file.name)

    def test_company_can_publish_investment_with_platform_fee(self):
        """اختبار خصم رسوم نشر المشروع من حساب الشركة وتحويلها للأدمن"""
        response = self.app.post('/api/investments', json={
            'name': 'مشروع شركة مدفوع الرسوم',
            'description': 'مشروع تنشره شركة مع خصم رسوم المنصة تلقائياً.',
            'total_amount': 1000,
            'admin_amount': 100,
            'min_investment': 50,
            'return_rate': 12,
            'duration': 10,
            'category': 'real-estate',
            'governorate_id': self.governorate['id']
        }, headers=self.company_headers)

        self.assertEqual(response.status_code, 201)
        payload = json.loads(response.data)
        self.assertEqual(payload['data']['platform_fee']['mode'], 'fixed')
        self.assertEqual(payload['data']['platform_fee']['value'], 25)

        conn = get_db_connection()
        wallet_after = conn.execute('''
            SELECT balance
            FROM user_wallets
            WHERE user_id = ? AND currency_id = 1
        ''', (self.company_user['id'],)).fetchone()
        fee_transaction = conn.execute('''
            SELECT amount, status, admin_wallet_address
            FROM transactions
            WHERE user_id = ? AND type = 'company_investment_listing_fee'
            ORDER BY id DESC
            LIMIT 1
        ''', (self.company_user['id'],)).fetchone()
        investment = conn.execute('''
            SELECT platform_fee_mode, platform_fee_value, platform_fee_currency, platform_fee_network,
                   platform_fee_paid, platform_fee_transaction_id
            FROM investments
            WHERE added_by = ?
            ORDER BY id DESC
            LIMIT 1
        ''', (self.company_user['id'],)).fetchone()
        admin_wallet = conn.execute('''
            SELECT current_balance, total_received
            FROM admin_wallets
            WHERE currency_id = 1 AND network_id = 1
            ORDER BY id ASC
            LIMIT 1
        ''').fetchone()
        conn.close()

        self.assertAlmostEqual(wallet_after['balance'], 175, places=6)
        self.assertIsNotNone(fee_transaction)
        self.assertEqual(fee_transaction['amount'], 25)
        self.assertEqual(fee_transaction['status'], 'completed')
        self.assertEqual(investment['platform_fee_mode'], 'fixed')
        self.assertEqual(investment['platform_fee_value'], 25)
        self.assertEqual(investment['platform_fee_currency'], 'USDT')
        self.assertEqual(investment['platform_fee_network'], 'TRC20')
        self.assertEqual(investment['platform_fee_paid'], 1)
        self.assertIsNotNone(investment['platform_fee_transaction_id'])
        self.assertEqual(admin_wallet['current_balance'], 25)
        self.assertEqual(admin_wallet['total_received'], 25)


class OperationsReadinessTestCase(unittest.TestCase):
    """اختبارات الجاهزية التشغيلية والنسخ الاحتياطية"""

    def setUp(self):
        app.config.from_object(TestingConfig)
        self.db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.db_file.close()
        self.backup_dir = tempfile.mkdtemp(prefix='readiness-backups-')
        app.config['DATABASE_PATH'] = self.db_file.name
        app.config['BACKUP_FOLDER'] = self.backup_dir
        app.config['RATELIMIT_ENABLED'] = False
        app.config['ADMIN_PASSWORD'] = 'admin123'
        limiter.enabled = False
        self.app = app.test_client()
        self.app_context = app.app_context()
        self.app_context.push()
        init_db()
        set_email_verification(False)

        admin_login = self.app.post('/api/auth/login', json={
            'email': 'admin@invest.com',
            'password': 'admin123'
        })
        self.assertEqual(admin_login.status_code, 200)
        self.admin_token = json.loads(admin_login.data)['data']['access_token']
        self.admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

    def tearDown(self):
        self.app_context.pop()
        os.unlink(self.db_file.name)
        for name in os.listdir(self.backup_dir):
            os.remove(os.path.join(self.backup_dir, name))
        os.rmdir(self.backup_dir)

    def test_health_endpoint_reports_extended_storage_and_backup_state(self):
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('environment', data)
        self.assertIn('storage', data['services'])
        self.assertIn('backups', data['services'])
        self.assertTrue(data['services']['storage']['uploads']['ok'])
        self.assertTrue(data['services']['storage']['backups']['ok'])

    def test_admin_readiness_endpoint_reports_blockers(self):
        response = self.app.get('/api/admin/readiness', headers=self.admin_headers)
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.data)['data']
        self.assertIn('summary', payload)
        self.assertIn('checks', payload)
        blocker_keys = {item['key'] for item in payload['blockers']}
        self.assertIn('receiving_wallets', blocker_keys)
        self.assertIn('mail', blocker_keys)

    def test_backup_retention_keeps_only_latest_backups(self):
        conn = get_db_connection()
        conn.execute("UPDATE system_settings SET value = '1' WHERE key = 'backup_retention_count'")
        conn.commit()
        conn.close()

        first_response = self.app.post('/api/settings/backups/create', headers=self.admin_headers)
        self.assertEqual(first_response.status_code, 201)
        second_response = self.app.post('/api/settings/backups/create', headers=self.admin_headers)
        self.assertEqual(second_response.status_code, 201)

        backups_response = self.app.get('/api/settings/backups', headers=self.admin_headers)
        self.assertEqual(backups_response.status_code, 200)
        backups = json.loads(backups_response.data)['data']['backups']
        self.assertEqual(len(backups), 1)


class ValidationTestCase(unittest.TestCase):
    """اختبارات التحقق من البيانات"""
    
    def test_validate_email(self):
        """اختبار التحقق من البريد الإلكتروني"""
        from utils import validate_email, ValidationError
        
        # البريد الصحيح
        self.assertEqual(validate_email('test@example.com'), 'test@example.com')
        
        # البريد الخاطئ
        with self.assertRaises(ValidationError):
            validate_email('invalid-email')
    
    def test_validate_password_strength(self):
        """اختبار التحقق من قوة كلمة المرور"""
        from utils import validate_password_strength, ValidationError
        
        # كلمة مرور قوية
        self.assertEqual(
            validate_password_strength('StrongPass123!'),
            'StrongPass123!'
        )
        
        # كلمة مرور ضعيفة
        with self.assertRaises(ValidationError):
            validate_password_strength('weak')
    
    def test_calculate_fees(self):
        """اختبار حساب الرسوم"""
        from utils import calculate_fees
        
        result = calculate_fees(100, fee_percentage=2, fee_fixed=5)
        
        self.assertEqual(result['amount'], 100)
        self.assertEqual(result['percentage_fee'], 2)
        self.assertEqual(result['fixed_fee'], 5)
        self.assertEqual(result['total_fee'], 7)
        self.assertEqual(result['total_amount'], 107)


if __name__ == '__main__':
    unittest.main()



