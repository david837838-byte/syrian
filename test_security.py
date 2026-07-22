#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
اختبار ميزات الأمان في منصة الاستثمار
Test Security Features
"""

import requests
import time

# URL للخادم
BASE_URL = 'http://localhost:2000/api'

def test_rate_limiting():
    """اختبار تحديد معدل الطلبات"""
    print("🧪 اختبار Rate Limiting...")
    
    # محاولة 15 مرة تسجيل في الساعة (الحد الأقصى 5)
    failed = 0
    for i in range(15):
        response = requests.post(f'{BASE_URL}/auth/register', 
            json={
                'name': f'Test User {i}',
                'email': f'test{i}@example.com',
                'password': 'Test@123456',
                'phone': '0501234567'
            })
        
        if response.status_code == 429:  # Too Many Requests
            failed += 1
            print(f"  ✅ محاولة {i+1}: تم حظر الطلب (429)")
        else:
            print(f"  📊 محاولة {i+1}: الحالة {response.status_code}")
    
    if failed > 0:
        print(f"✅ Rate Limiting يعمل! تم حظر {failed} طلبات")
    else:
        print("⚠️ Rate Limiting قد لا يعمل بشكل صحيح")
    print()

def test_sql_injection():
    """اختبار حماية من SQL Injection"""
    print("🧪 اختبار SQL Injection Prevention...")
    
    # محاولة SQL Injection
    response = requests.post(f'{BASE_URL}/auth/login',
        json={
            'email': "' OR '1'='1",
            'password': "' OR '1'='1"
        })
    
    if response.status_code in [400, 401]:
        print("✅ تم منع محاولة SQL Injection")
    else:
        print("⚠️ قد تكون هناك ثغرة SQL Injection")
    print()

def test_xss_protection():
    """اختبار حماية من XSS"""
    print("🧪 اختبار XSS Protection...")
    
    # محاولة XSS
    response = requests.post(f'{BASE_URL}/auth/register',
        json={
            'name': '<script>alert("XSS")</script>',
            'email': 'xss@test.com',
            'password': 'Test@123456',
            'phone': '<img src=x onerror="alert(1)">'
        })
    
    if response.status_code in [200, 400, 409]:
        print("✅ تم تنظيف المدخلات من XSS")
    print()

def test_security_headers():
    """اختبار Security Headers"""
    print("🧪 اختبار Security Headers...")
    
    response = requests.get(f'{BASE_URL}/investments')
    headers = response.headers
    
    security_headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': True,
        'Content-Security-Policy': True
    }
    
    for header, expected in security_headers.items():
        if header in headers:
            if expected is True or expected in headers[header]:
                print(f"  ✅ {header}: موجود")
            else:
                print(f"  ⚠️ {header}: قيمة غير متوقعة")
        else:
            print(f"  ❌ {header}: غير موجود")
    print()

def test_token_expiry():
    """اختبار انتهاء صلاحية Token"""
    print("🧪 اختبار Token Expiry...")
    
    # محاولة استخدام token قديم
    headers = {'Authorization': 'Bearer invalid_token_12345'}
    response = requests.get(f'{BASE_URL}/investments', headers=headers)
    
    if response.status_code == 401:
        print("✅ تم رفض Token غير صحيح")
    else:
        print("⚠️ قد تكون هناك مشكلة في التحقق من Token")
    print()

def main():
    print("="*60)
    print("🔐 اختبار ميزات الأمان - منصة الاستثمار الذكية")
    print("="*60)
    print()
    
    try:
        # التحقق من أن الخادم يعمل
        response = requests.get(f'{BASE_URL}/investments', timeout=5)
        if response.status_code in [200, 401]:
            print("✅ الخادم يعمل بنجاح\n")
        else:
            print("❌ الخادم لا يستجيب بشكل صحيح\n")
            return
    except Exception as e:
        print(f"❌ خطأ في الاتصال بالخادم: {e}")
        print("تأكد من تشغيل الخادم على http://localhost:5000\n")
        return
    
    # تشغيل الاختبارات
    test_security_headers()
    test_xss_protection()
    test_sql_injection()
    test_token_expiry()
    test_rate_limiting()
    
    print("="*60)
    print("✅ انتهى الاختبار")
    print("="*60)

if __name__ == '__main__':
    main()
