# 🏢 نظام حسابات الضيف للشركات مع صلاحيات إنشاء المشاريع

## 📌 المقدمة
هذا التوثيق يشرح كيفية تصميم وتطبيق نظام يسمح للشركات بـ:
1. إنشاء حسابات ضيف للمستثمرين
2. إدارة صلاحيات الأدمن من الشركة (إنشاء المشاريع)
3. السماح للمستثمرين بالاستثمار في المشاريع المُنشأة

---

## 🔑 المفاهيم الأساسية

### 1️⃣ أنواع المستخدمين
```
┌─────────────────────────┐
│     نظام المستخدمين     │
├─────────────────────────┤
│ 1. Admin (إداري عام)    │ ← يدير النظام كاملاً
│ 2. Company (شركة)       │ ← يمكنها إنشاء مشاريع
│ 3. Company Admin        │ ← يدير الشركة و يدعو ضيوف
│ 4. Guest (ضيف)         │ ← يستثمر في المشاريع
│ 5. Investor (مستثمر)    │ ← يستثمر مباشرة
└─────────────────────────┘
```

### 2️⃣ الصلاحيات (Permissions)
```
Admin:
  ✓ إدارة الشركات
  ✓ إدارة المستخدمين
  ✓ مراجعة المشاريع
  ✓ إدارة النظام

Company Admin:
  ✓ إنشاء/تعديل/حذف المشاريع
  ✓ دعوة ضيوف (Guests)
  ✓ إدارة محافظ الشركة
  ✓ عرض إحصائيات المشاريع

Guest:
  ✓ الاستثمار في مشاريع الشركة
  ✓ عرض الاستثمارات الخاصة به
  ✓ سحب الأرباح
  ✗ إنشاء مشاريع
  ✗ دعوة مستخدمين آخرين
```

---

## 💾 تصميم قاعدة البيانات

### 1️⃣ إضافة جدول الشركات
```sql
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_user_id INTEGER NOT NULL,
    logo_url TEXT,
    is_verified BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

### 2️⃣ جدول أعضاء الشركة
```sql
CREATE TABLE IF NOT EXISTS company_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    member_type TEXT DEFAULT 'member',  -- 'admin', 'manager', 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(company_id, user_id)
);
```

### 3️⃣ جدول دعوات الضيوف
```sql
CREATE TABLE IF NOT EXISTS guest_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    invitation_token TEXT UNIQUE NOT NULL,
    invitation_type TEXT DEFAULT 'investor',  -- 'investor', 'manager'
    status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'expired'
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 4️⃣ تحديث جدول المشاريع (Investments)
```sql
-- أضف هذه الأعمدة للجدول الموجود
ALTER TABLE investments ADD COLUMN company_id INTEGER;
ALTER TABLE investments ADD COLUMN created_by_type TEXT DEFAULT 'admin';  -- 'admin', 'company'
ALTER TABLE investments ADD FOREIGN KEY (company_id) REFERENCES companies(id);
```

### 5️⃣ جدول الصلاحيات
```sql
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,  -- NULL إذا كانت صلاحيات عامة
    permission_name TEXT NOT NULL,
    granted_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, company_id, permission_name)
);
```

---

## 🔄 سير العمل

### السيناريو 1: إنشاء حساب ضيف من قبل شركة

```
1. شركة (Company Admin) يريد دعوة مستثمر
   ↓
2. يدخل البريد الإلكتروني للمستثمر
   ↓
3. يرسل دعوة عبر البريد الإلكتروني
   ↓
4. في البريد:
   - رابط التسجيل الخاص
   - معلومات الشركة
   - نوع الحساب (Guest/Investor)
   ↓
5. المستثمر ينقر على الرابط
   ↓
6. يملأ النموذج:
   - الاسم
   - كلمة المرور
   - قبول الشروط
   ↓
7. ينشئ حساب برقم معرف خاص: GUEST_XXXXX
   ↓
8. يُضاف تلقائياً إلى الشركة
```

### السيناريو 2: شركة تنشئ مشروع

```
1. Company Admin يدخل لوحة التحكم
   ↓
2. ينقر على "مشروع جديد"
   ↓
3. يملأ النموذج:
   - اسم المشروع
   - الوصف
   - المبلغ الإجمالي
   - الحد الأدنى للاستثمار
   - معدل العائد
   - المدة
   ↓
4. يُحفظ المشروع مع company_id
   ↓
5. يظهر للضيوف المرتبطين بالشركة فقط
```

### السيناريو 3: ضيف يستثمر في مشروع

```
1. Guest يسجل دخول
   ↓
2. يرى قائمة مشاريع الشركة
   ↓
3. ينقر على مشروع
   ↓
4. يملأ مبلغ الاستثمار
   ↓
5. يؤكد الاستثمار
   ↓
6. يُضاف سجل في user_investments
   ↓
7. يرى تحديث الأرباح تلقائياً
```

---

## 🛡️ الأمان والحماية

### 1️⃣ التحقق من الهوية (Authentication)
```python
# تأكد أن الحساب نشط ومؤكد
def verify_guest_account(token):
    user = get_user_from_token(token)
    
    # تحقق من أن المستخدم:
    # ✓ مرتبط بشركة
    # ✓ نوعه guest أو investor
    # ✓ الحساب نشط
    # ✓ لا توجد علامات احتيالية
    
    return user
```

### 2️⃣ التحقق من الصلاحيات (Authorization)
```python
# قبل السماح بعملية:
def check_permission(user_id, company_id, action):
    # مثال: السماح بإنشاء مشروع
    if action == "create_project":
        # تحقق:
        # ✓ هل المستخدم admin بالشركة؟
        # ✓ هل الشركة نشطة؟
        # ✓ هل الحد الأقصى من المشاريع متجاوز؟
        pass
    
    # مثال: السماح بالاستثمار
    if action == "invest":
        # تحقق:
        # ✓ هل المستخدم guest أو investor؟
        # ✓ هل لديه رصيد كافي؟
        # ✓ هل المشروع نشط؟
        pass
```

### 3️⃣ حماية البيانات
```
✓ كل guest ترتبط تلقائياً بشركة محددة
✓ لا يمكن للضيف رؤية مشاريع شركات أخرى
✓ لا يمكن للضيف إنشاء مشاريع
✓ كل الرغبات تُسجل مع user_id و company_id
```

---

## 📝 APIs المطلوبة

### 1️⃣ إدارة الدعوات
```
POST /api/company/invitations
- إرسال دعوة لضيف جديد
- Body: { email, invitation_type }

GET /api/company/invitations
- عرض قائمة الدعوات

DELETE /api/company/invitations/<id>
- حذف دعوة قديمة
```

### 2️⃣ إدارة الشركة
```
POST /api/companies
- إنشاء شركة جديدة

GET /api/companies/<id>
- عرض معلومات الشركة

GET /api/companies/<id>/members
- عرض أعضاء الشركة

POST /api/companies/<id>/members
- إضافة عضو للشركة
```

### 3️⃣ إدارة المشاريع
```
POST /api/company/projects
- إنشاء مشروع جديد
- Body: { name, description, total_amount, ... }

GET /api/company/projects
- عرض مشاريع الشركة

GET /api/projects/my-investments
- عرض استثمارات الضيف

POST /api/investments/<id>/invest
- استثمار في مشروع
```

### 4️⃣ التسجيل عبر الدعوة
```
POST /api/auth/register-with-invitation
- تسجيل ضيف جديد عبر دعوة
- Body: 
  {
    invitation_token: "abc123",
    name: "أحمد",
    password: "..."
  }
```

---

## 🚀 خطوات التطبيق

### المرحلة الأولى: قاعدة البيانات
```
1. ✓ أنشئ جداول الشركات والأعضاء
2. ✓ أنشئ جدول الدعوات
3. ✓ أضف حقول للصلاحيات
4. ✓ تحديث جدول المشاريع
```

### المرحلة الثانية: الـ Backend
```
1. ✓ API إرسال الدعوات
2. ✓ API التسجيل عبر الدعوة
3. ✓ API إنشاء المشاريع (شركة فقط)
4. ✓ API الاستثمار (ضيف/مستثمر)
5. ✓ التحقق من الصلاحيات
```

### المرحلة الثالثة: الـ Frontend
```
1. ✓ واجهة دعوة الضيوف
2. ✓ صفحة التسجيل عبر الدعوة
3. ✓ لوحة تحكم الشركة
4. ✓ واجهة إنشاء المشاريع
5. ✓ واجهة الاستثمار
```

### المرحلة الرابعة: الأمان
```
1. ✓ التحقق من انتهاء الدعوات
2. ✓ تشفير كلمات المرور
3. ✓ تسجيل العمليات (Logging)
4. ✓ حماية من الاحتيال
```

---

## 📊 مخطط العلاقات

```
┌─────────────┐
│  Companies  │
│  (الشركات)  │
└─────┬───────┘
      │ 1:M
      ├─────────────────────────────┐
      │                             │
      ▼                             ▼
┌─────────────────┐      ┌──────────────────┐
│ Company Members │      │ Investments      │
│ (أعضاء الشركة)  │      │ (المشاريع)       │
└─────────────────┘      └─────┬────────────┘
      │ M:1                      │ 1:M
      │                          │
      ▼                          ▼
┌─────────────┐        ┌────────────────────┐
│    Users    │◄───────│ User_Investments   │
│ (المستخدمين)│        │ (استثمارات المستخدم)
└─────────────┘        └────────────────────┘
```

---

## ⚙️ إعدادات النظام

### 1️⃣ متغيرات البيئة
```
# في .env
GUEST_INVITATION_EXPIRY_DAYS=30
MAX_PROJECTS_PER_COMPANY=100
MAX_GUESTS_PER_COMPANY=1000
GUEST_ACCOUNT_PREFIX=GUEST_
ENABLE_GUEST_REGISTRATIONS=true
```

### 2️⃣ الصلاحيات الافتراضية
```python
DEFAULT_PERMISSIONS = {
    'admin': [
        'manage_system',
        'manage_users',
        'manage_companies',
        'approve_projects',
        'view_all_analytics'
    ],
    'company_admin': [
        'create_project',
        'edit_project',
        'delete_project',
        'invite_guest',
        'manage_company_members',
        'view_company_analytics'
    ],
    'guest': [
        'invest',
        'view_my_investments',
        'withdraw_profits'
    ]
}
```

---

## 🔍 نقاط تفتيش (Checkpoints)

### عند إنشاء دعوة:
```
✓ التحقق من البريد الإلكتروني الصحيح
✓ التحقق من عدم وجود حساب بنفس البريد
✓ إنشاء token فريد وآمن
✓ إرسال البريد الإلكتروني
✓ تسجيل العملية في السجلات
```

### عند قبول الدعوة:
```
✓ التحقق من صحة الـ token
✓ التحقق من انتهاء الدعوة
✓ التحقق من عدم استخدام الدعوة مسبقاً
✓ إنشاء المستخدم الجديد
✓ ربط المستخدم بالشركة
✓ تعيين الصلاحيات الافتراضية
```

### عند إنشاء مشروع:
```
✓ التحقق من أن المستخدم admin بالشركة
✓ التحقق من عدم تجاوز الحد الأقصى من المشاريع
✓ التحقق من صحة البيانات المدخلة
✓ ربط المشروع بالشركة
✓ تسجيل العملية
```

### عند الاستثمار:
```
✓ التحقق من أن المستخدم نشط
✓ التحقق من رصيد المستخدم
✓ التحقق من أن المشروع نشط
✓ التحقق من الحد الأدنى والأقصى للاستثمار
✓ تحديث رصيد المحفظة
✓ تسجيل الاستثمار
```

---

## 📈 المقاييس والتحليلات

```
للشركة:
- عدد الضيوف المدعوين
- عدد الضيوف الفعليين
- إجمالي الاستثمارات في مشاريعها
- معدل التحويل من دعوة إلى استثمار
- متوسط الاستثمار لكل ضيف

للمستثمر:
- عدد الاستثمارات
- إجمالي المبلغ المستثمر
- إجمالي الأرباح
- أفضل مشروع بالعائد

للإداري:
- عدد الشركات
- إجمالي الاستثمارات
- عدد المستثمرين
- معدل الرضا
```

---

## 🎯 الخلاصة

### المميزات الرئيسية:
```
✅ نظام دعوات آمن وفعال
✅ فصل واضح بين الأدوار والصلاحيات
✅ حماية قوية من الاحتيال
✅ واجهات سهلة الاستخدام
✅ تحليلات شاملة
✅ قابلية التوسع
```

### النتائج المتوقعة:
```
📈 زيادة عدد المستثمرين
📈 تحسين تجربة المستخدم
📈 تقليل الأخطاء والاحتيال
📈 إدارة أفضل للبيانات
📈 تقارير أدق
```

---

## 📞 الدعم والتطوير

في حالة احتياجك لـ:
1. تطبيق الكود الفعلي
2. إضافة ميزات إضافية
3. تحسين الأمان
4. حل مشاكل محددة

**اطلب مساعدة مع الأمثلة الفعلية!**
