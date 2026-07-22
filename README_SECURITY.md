# 🏦 منصة الاستثمار الذكية - النسخة الآمنة

> **Platform Intelijen Investasi - Versi Aman**

## 🎯 نظرة سريعة

منصة استثمار آمنة وموثوقة مع حماية قوية من الهجمات الإلكترونية.

### ✨ المميزات الرئيسية

- 🔐 **أمان شامل**: حماية من SQL Injection, XSS, CSRF وأكثر
- 💰 **إدارة استثمارات**: 5 مشاريع استثمارية جاهزة
- 👥 **إدارة المستخدمين**: تسجيل وتسجيل دخول آمن
- 💳 **محافظ رقمية**: دعم عملات متعددة
- 📊 **لوحة تحكم**: للمدير والمستخدمين
- ⚡ **سريعة وموثوقة**: استجابة فورية وحفظ آمن

---

## 🚀 البدء السريع

### المتطلبات
- Python 3.7+
- pip
- متصفح حديث

### التثبيت

```bash
# 1. استنساخ المشروع
cd c:\Users\USER\Downloads\1\program

# 2. تثبيت المتطلبات
pip install -r requirements.txt

# 3. تشغيل الخادم
python app.py
```

### الدخول

ثم توجه إلى: `http://localhost:5000`

**حساب الأدمن (للاختبار):**
- Email: `admin@invest.com`
- Password: `admin123`

---

## 🔐 ميزات الأمان

| الميزة | الحالة | الوصف |
|-------|--------|-------|
| تشفير كلمات المرور | ✅ | BCrypt مع Salt عشوائي |
| مصادقة JWT | ✅ | Tokens بصلاحية 1 ساعة |
| حماية SQL Injection | ✅ | Parameterized Queries |
| حماية XSS | ✅ | Input Sanitization |
| حماية CSRF | ✅ | SameSite Cookies |
| Rate Limiting | ✅ | منع الهجمات الآلية |
| Security Headers | ✅ | 6 headers أمان |
| Session Security | ✅ | Secure HttpOnly Cookies |

---

## 📁 بنية المشروع

```
.
├── app.py                          # الخادم الرئيسي
├── database_schema.sql             # قاعدة البيانات
├── requirements.txt                # المتطلبات
├── templates/
│   └── index.html                  # الواجهة الرئيسية
├── static/
│   ├── css/                        # أنماط CSS
│   └── js/                         # ملفات JavaScript
├── uploads/                        # ملفات المستخدمين
├── SECURITY.md                     # توثيق الأمان
├── SECURITY_REPORT.md              # تقرير الأمان
├── FINAL_SUMMARY.md                # الملخص النهائي
└── test_security.py               # اختبارات الأمان
```

---

## 🧪 اختبار الأمان

```bash
python test_security.py
```

يختبر:
- Rate Limiting
- SQL Injection Protection
- XSS Protection
- Security Headers
- Token Expiry

---

## 💻 الاستثمارات المتاحة

| # | المشروع | رأس المال | الحد الأدنى | العائد | المدة |
|---|---------|----------|-----------|--------|------|
| 1 | التطوير العقاري | $100,000 | $5,000 | 15% | 12 شهر |
| 2 | محفظة الأسهم | $500,000 | $10,000 | 12% | 6 شهور |
| 3 | الطاقة الشمسية | $250,000 | $5,000 | 18% | 24 شهر |
| 4 | التجارة الإلكترونية | $150,000 | $3,000 | 20% | 12 شهر |
| 5 | الفنادق الفاخرة | $300,000 | $15,000 | 14% | 18 شهر |

---

## 📋 الملفات المهمة

### للأمان:
- 📄 [SECURITY.md](SECURITY.md) - توثيق كامل للأمان
- 📄 [SECURITY_REPORT.md](SECURITY_REPORT.md) - تقرير أمان شامل
- 📄 [SECURITY_IMPROVEMENTS.md](SECURITY_IMPROVEMENTS.md) - التحسينات المضافة

### للاستخدام:
- 📄 [FINAL_SUMMARY.md](FINAL_SUMMARY.md) - ملخص المشروع
- 📄 [README_COMPLETE.md](README_COMPLETE.md) - دليل كامل
- 📄 [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) - مرجع API

---

## ⚙️ الإعدادات

### ملف `.env` (اختياري)

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
FLASK_ENV=development
FLASK_DEBUG=False
```

---

## 📞 التعليمات الهامة

### عند النشر في الإنتاج:

✅ **يجب فعل:**
- [ ] تغيير جميع Secret Keys
- [ ] تفعيل HTTPS
- [ ] استخدام Web Server احترافي
- [ ] نقل البيانات إلى PostgreSQL
- [ ] إعداد النسخ الاحتياطية
- [ ] تفعيل المراقبة والتنبيهات

❌ **لا تفعل:**
- لا تستخدم SQLite في الإنتاج
- لا تستخدم Development Server
- لا تترك Debug Mode مفعلاً
- لا تستخدم Secret Keys الافتراضية

---

## 🐛 حل المشاكل

### المشكلة: "Connection refused"
```bash
# تأكد من تشغيل الخادم
python app.py
```

### المشكلة: "Port already in use"
```bash
# استخدم منفذ مختلف
python app.py --port 5001
```

### المشكلة: "Database error"
```bash
# حذف قاعدة البيانات وإعادة إنشاؤها
del database.db
python app.py
```

---

## 📚 المراجع

- [Flask Documentation](https://flask.palletsprojects.com/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Web Security Academy](https://portswigger.net/web-security)

---

## 📝 الترخيص

هذا المشروع مفتوح المصدر تحت ترخيص MIT.

---

## 👨‍💻 المساهمة

لإرسال تقارير الأخطاء أو الاقتراحات:
1. تحقق من المشاكل الموجودة
2. أنشئ issue جديد
3. أرسل pull request

---

## 🎉 شكراً

شكراً لاستخدام منصة الاستثمار الذكية!

**للدعم الأمني**: لا تنشر الثغرات علناً، أرسل تقرير سري.

---

**آخر تحديث**: 2026-02-06  
**الإصدار**: 1.0.1  
**الحالة**: ✅ آمن وجاهز للاستخدام
