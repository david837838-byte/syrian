import sqlite3
import os
import sys
from flask_bcrypt import Bcrypt

if '--yes' not in sys.argv:
    print("Refusing to reset database without explicit --yes confirmation.")
    sys.exit(1)

# حذف قاعدة البيانات القديمة إذا كانت موجودة
if os.path.exists('database.db'):
    os.remove('database.db')

bcrypt = Bcrypt()

# إنشاء قاعدة بيانات جديدة
conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# إنشاء جداول
cursor.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        wallet_address TEXT,
        balance REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )
''')

cursor.execute('''
    CREATE TABLE investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        total_amount REAL NOT NULL,
        admin_amount REAL DEFAULT 0,
        min_investment REAL NOT NULL,
        return_rate REAL NOT NULL,
        duration INTEGER NOT NULL,
        category TEXT,
        collected REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        added_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (added_by) REFERENCES users(id)
    )
''')

# إدخال المستخدم الأدمن
admin_password = os.environ.get('ADMIN_PASSWORD')
if not admin_password:
    print("ADMIN_PASSWORD environment variable is required.")
    sys.exit(1)

hashed_password = bcrypt.generate_password_hash(admin_password).decode('utf-8')
import random
import string
wallet_address = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=33))

cursor.execute('''
    INSERT INTO users (name, email, phone, password, role, wallet_address, balance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
''', (
    'مدير النظام',
    'admin@invest.com',
    '+966500000000',
    hashed_password,
    'admin',
    wallet_address,
    100000.0
))

# إدخال مستخدم عادي للاختبار
user_password_raw = os.environ.get('TEST_USER_PASSWORD')
if not user_password_raw:
    print("TEST_USER_PASSWORD environment variable is required.")
    sys.exit(1)

user_password = bcrypt.generate_password_hash(user_password_raw).decode('utf-8')
user_wallet = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=33))

cursor.execute('''
    INSERT INTO users (name, email, phone, password, role, wallet_address, balance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
''', (
    'أحمد محمد',
    'ahmed@example.com',
    '+966511111111',
    user_password,
    'user',
    user_wallet,
    5000.0
))

# إضافة استثمارات تجريبية
cursor.execute('''
    INSERT INTO investments (name, description, total_amount, admin_amount, min_investment, return_rate, duration, category, collected, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', (
    'مشروع العقارات الفاخرة',
    'استثمار في مجمع سكني فاخر في دبي مع عوائد مضمونة',
    500000.0,
    100000.0,
    5000.0,
    18.0,
    24,
    'real-estate',
    350000.0,
    1
))

cursor.execute('''
    INSERT INTO investments (name, description, total_amount, admin_amount, min_investment, return_rate, duration, category, collected, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', (
    'محفظة عملات رقمية',
    'استثمار متنوع في أفضل العملات الرقمية',
    200000.0,
    50000.0,
    1000.0,
    22.0,
    12,
    'crypto',
    180000.0,
    1
))

conn.commit()
conn.close()

print("✅ تمت إعادة تهيئة قاعدة البيانات بنجاح!")
print("\n👤 بيانات تسجيل الدخول:")
print("══════════════════════════════════════")
print("🎯 الأدمن (Admin):")
print("   📧 البريد: admin@invest.com")
print("   🔐 كلمة المرور: من متغير البيئة ADMIN_PASSWORD")
print("   👑 الصلاحية: مدير كامل الصلاحيات")
print("\n👤 المستخدم العادي (User):")
print("   📧 البريد: ahmed@example.com")
print("   🔐 كلمة المرور: من متغير البيئة TEST_USER_PASSWORD")
print("   👤 الصلاحية: مستخدم عادي")
print("\n💰 رصيد الأدمن: 100,000 USDT")
print("💰 رصيد المستخدم: 5,000 USDT")
print("══════════════════════════════════════")
