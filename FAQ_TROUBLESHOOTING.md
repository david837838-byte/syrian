# ❓ الأسئلة الشائعة والحلول - نظام حسابات الضيف

## 🎯 الأسئلة الأساسية

### س1: ما الفرق بين Guest و Investor؟
```
Guest (ضيف):
✓ مدعو من قبل شركة محددة
✓ يستطيع الاستثمار فقط في مشاريع الشركة
✓ لا يستطيع إنشاء مشاريع
✓ مرتبط بشركة واحدة فقط
✓ يملك صلاحيات محدودة

Investor (مستثمر):
✓ مسجل بشكل مستقل
✓ يستطيع الاستثمار في أي مشروع
✓ قد يكون محترف/شركة
✓ لا ارتباط مع شركة محددة
✓ صلاحيات أوسع
```

### س2: هل يمكن لضيف الاستثمار في مشاريع شركات أخرى؟
```
الجواب: لا

السبب:
- الضيف مرتبط بشركة محددة عبر company_id
- عند عرض المشاريع، يرى فقط مشاريع شركته
- إذا حاول الوصول مباشرة، سيحصل على خطأ 403

الكود:
    member = cursor.execute('''
        SELECT * FROM company_members
        WHERE company_id = ? AND user_id = ?
    ''', (project['company_id'], current_user_id)).fetchone()
    
    if not member:
        return jsonify({'error': 'ليس لديك صلاحية'}), 403
```

### س3: كيف يعمل نظام الدعوات بالضبط؟
```
الخطوات:
1. شركة ترسل دعوة لبريد إلكتروني
   → insert في guest_invitations مع token عشوائي

2. النظام يرسل بريد إلكتروني يحتوي على:
   - رابط فريد: /register?token=ABC123XYZ
   - اسم الشركة والمشروع

3. الضيف ينقر على الرابط
   → يملأ نموذج التسجيل

4. النظام يتحقق من:
   ✓ token صحيح
   ✓ لم ينتهِ الصلاحية (expiry)
   ✓ لم تُستخدم الدعوة مسبقاً
   ✓ البريد الإلكتروني متطابق

5. ينشئ حساب جديد ويربطه بالشركة

الفوائد:
✓ آمن - لا يمكن لأحد التسجيل بدون دعوة
✓ تتبع - نعرف من دعا من
✓ مرن - يمكن إعادة إرسال الدعوة
✓ سهل - بدون كود تفعيل معقد
```

### س4: ماذا لو انتهت صلاحية الدعوة؟
```
الحل 1: إعادة الإرسال
- شركة تُعيد إرسال دعوة جديدة
- API: POST /api/company/<id>/resend-invitation

الحل 2: إنشاء دعوة جديدة
- حذف القديمة وإنشاء جديدة
- API: DELETE /api/company/<id>/invitations/<id>
- ثم: POST /api/company/<id>/invite-guest

الكود:
    # في API الإرسال
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    # في API التسجيل
    if datetime.fromisoformat(invitation['expires_at']) < datetime.utcnow():
        cursor.execute(
            'UPDATE guest_invitations SET status = ? WHERE id = ?',
            ('expired', invitation['id'])
        )
        return jsonify({'error': 'الدعوة منتهية'}), 400
```

### س5: كيف نمنع الاحتيال في الاستثمارات؟
```
طبقات الحماية:

1. التحقق من الهوية (Authentication):
   ✓ كلمة مرور قوية
   ✓ تحقق من البريد الإلكتروني
   ✓ المصادقة الثنائية (Optional)

2. التحقق من الصلاحيات (Authorization):
   ✓ هل المستخدم عضو بالشركة؟
   ✓ هل لديه صلاحية الاستثمار؟
   ✓ هل الشركة نشطة؟

3. التحقق من البيانات (Validation):
   ✓ المبلغ صحيح؟
   ✓ المشروع نشط؟
   ✓ الحد الأدنى/الأقصى صحيح؟

4. التسجيل والمراقبة (Logging):
   ✓ تسجيل كل عملية استثمار
   ✓ تسجيل محاولات الوصول المرفوضة
   ✓ تنبيهات للأنشطة المريبة

5. الحدود الزمنية:
   ✓ معدل محدود للطلبات (Rate Limiting)
   ✓ فحص الأنماط غير المعتادة
```

---

## 🛠️ الأسئلة التقنية

### س6: كيف أضيف صلاحيات جديدة؟
```python
# طريقة 1: إضافة صلاحية للمستخدم
def grant_permission(user_id, company_id, permission_name):
    cursor.execute('''
        INSERT INTO user_permissions
        (user_id, company_id, permission_name, permission_type, granted_by)
        VALUES (?, ?, ?, 'allow', ?)
    ''', (user_id, company_id, permission_name, admin_user_id))
    conn.commit()

# الاستخدام:
grant_permission(user_id=5, company_id=1, permission_name='create_project')

# طريقة 2: إضافة صلاحيات افتراضية للضيوف الجدد
DEFAULT_GUEST_PERMISSIONS = [
    'invest',
    'view_my_investments',
    'withdraw_profits'
]

for perm in DEFAULT_GUEST_PERMISSIONS:
    cursor.execute('''
        INSERT INTO user_permissions
        (user_id, company_id, permission_name, granted_by)
        VALUES (?, ?, ?, ?)
    ''', (new_user_id, company_id, perm, 0))  # 0 = نظام
```

### س7: كيف أتحقق من الصلاحية في الكود؟
```python
# طريقة 1: في الـ Route
@app.route('/api/projects/create', methods=['POST'])
@jwt_required()
def create_project():
    current_user_id = get_jwt_identity()
    company_id = request.json.get('company_id')
    
    # التحقق من الصلاحية
    permission = cursor.execute('''
        SELECT * FROM user_permissions
        WHERE user_id = ? 
        AND company_id = ? 
        AND permission_name = 'create_project'
        AND permission_type = 'allow'
    ''', (current_user_id, company_id)).fetchone()
    
    if not permission:
        return jsonify({'error': 'ليس لديك صلاحية'}), 403
    
    # تابع العملية ...

# طريقة 2: استخدام ديكوريتر
@app.route('/api/projects/create', methods=['POST'])
@jwt_required()
@require_permission('create_project')
def create_project():
    # تابع العملية مباشرة
    pass
```

### س8: كيف أضيف عضو جديد للشركة؟
```python
def add_company_member(company_id, user_id, member_type='member'):
    """
    إضافة عضو للشركة
    member_type: 'owner', 'admin', 'manager', 'member'
    """
    cursor.execute('''
        INSERT INTO company_members
        (company_id, user_id, member_type)
        VALUES (?, ?, ?)
    ''', (company_id, user_id, member_type))
    conn.commit()

# الاستخدام:
add_company_member(company_id=1, user_id=5, member_type='admin')
```

### س9: كيف أحصل على إحصائيات الشركة؟
```python
def get_company_statistics(company_id):
    """الحصول على إحصائيات الشركة"""
    
    stats = {}
    
    # عدد الضيوف
    stats['total_guests'] = cursor.execute('''
        SELECT COUNT(DISTINCT user_id) 
        FROM company_members 
        WHERE company_id = ? AND member_type = 'member'
    ''', (company_id,)).fetchone()[0]
    
    # عدد المشاريع
    stats['total_projects'] = cursor.execute('''
        SELECT COUNT(*) 
        FROM investments 
        WHERE company_id = ? AND status = 'active'
    ''', (company_id,)).fetchone()[0]
    
    # إجمالي الاستثمارات
    stats['total_investment'] = cursor.execute('''
        SELECT COALESCE(SUM(ui.amount), 0)
        FROM user_investments ui
        JOIN investments i ON ui.investment_id = i.id
        WHERE i.company_id = ?
    ''', (company_id,)).fetchone()[0]
    
    # إجمالي الأرباح
    stats['total_profits'] = cursor.execute('''
        SELECT COALESCE(SUM(ui.returns), 0)
        FROM user_investments ui
        JOIN investments i ON ui.investment_id = i.id
        WHERE i.company_id = ?
    ''', (company_id,)).fetchone()[0]
    
    return stats

# الاستخدام:
stats = get_company_statistics(company_id=1)
# النتيجة:
# {
#     'total_guests': 50,
#     'total_projects': 5,
#     'total_investment': 500000,
#     'total_profits': 75000
# }
```

### س10: كيف أحذف ضيف من الشركة؟
```python
def remove_guest_from_company(company_id, user_id):
    """إزالة ضيف من الشركة"""
    
    # التحقق من أن المستخدم ضيف فقط (ليس admin)
    member = cursor.execute('''
        SELECT member_type FROM company_members
        WHERE company_id = ? AND user_id = ?
    ''', (company_id, user_id)).fetchone()
    
    if not member or member['member_type'] != 'member':
        raise Exception('لا يمكن حذف admin')
    
    # حذف العضو
    cursor.execute('''
        DELETE FROM company_members
        WHERE company_id = ? AND user_id = ?
    ''', (company_id, user_id))
    
    # ملاحظة: الاستثمارات تبقى محفوظة في السجلات
    # لكن الضيف لن يستطيع الاستثمار مجدداً
    
    conn.commit()

# الاستخدام:
remove_guest_from_company(company_id=1, user_id=5)
```

---

## ⚠️ حل المشاكل الشائعة

### مشكلة 1: "الدعوة غير صحيحة أو منتهية"
```
الأسباب الممكنة:
1. ✗ Token مكتوب بشكل خاطئ
2. ✗ انتهت صلاحية الدعوة (أكثر من 30 يوم)
3. ✗ تم استخدام الدعوة مسبقاً
4. ✗ حذفت الدعوة من قبل الشركة

الحل:
✓ اطلب من الشركة أن ترسل دعوة جديدة
✓ تأكد من نسخ الرابط بشكل صحيح
✓ تحقق من البريد الإلكتروني (في المجلد spam)
✓ تواصل مع دعم الشركة
```

### مشكلة 2: "ليس لديك صلاحية"
```
السبب:
- محاولة عمل ليس لديك صلاحية له

الحل:
✓ إذا كنت admin، تأكد من إضافة الصلاحية
✓ إذا كنت guest، اطلب من admin الشركة
✓ تحقق من نوع حسابك (guest vs admin)

الكود للتحقق:
    # اطلب معلومات حسابك
    GET /api/me
    
    # سيعيد:
    {
        "id": 5,
        "name": "أحمد",
        "user_type": "guest",
        "company_id": 1
    }
```

### مشكلة 3: "المشروع غير متوفر"
```
الأسباب:
1. ✗ المشروع محذوف أو أغلق
2. ✗ انتهت الاستثمارات (المبلغ الكلي تم تجميعه)
3. ✗ ليس عضو بالشركة التي تملك المشروع
4. ✗ المشروع تابع لشركة أخرى

الحل:
✓ تحقق من حالة المشروع
✓ اطلب معلومات المشروع من admin
✓ اسأل عن المشاريع البديلة
```

### مشكلة 4: "المبلغ المستثمر أقل من الحد الأدنى"
```
الخطأ:
    "الحد الأدنى للاستثمار: 5000"

الحل:
✓ استثمر مبلغ أكبر من أو يساوي الحد الأدنى
✓ تحقق من حدود المشروع قبل الاستثمار

مثال:
    POST /api/projects/10/invest
    Body: {"amount": 10000}  // ✓ صحيح (أكبر من الحد الأدنى)
    Body: {"amount": 2000}   // ✗ خطأ (أقل من 5000)
```

### مشكلة 5: "البريد الإلكتروني مسجل بالفعل"
```
السبب:
- حساب بنفس البريد الإلكتروني موجود

الحل:
✓ استخدم بريد إلكتروني مختلف
✓ إذا نسيت كلمة المرور، استخدم "نسيت كلمة المرور"
✓ تواصل مع دعم إذا حدث الخطأ بالخطأ
```

### مشكلة 6: "خطأ 500 - خطأ في الخادم"
```
السبب:
- خطأ غير متوقع في الخادم

الحل:
✓ حاول مرة أخرى بعد دقائق قليلة
✓ امسح ذاكرة التخزين المؤقت (Cache)
✓ حاول من متصفح مختلف
✓ تواصل مع فريق الدعم

معلومات للدعم:
- وقت حدوث المشكلة (بالضبط)
- ما كنت تفعل عندما حدثت
- رسالة الخطأ الكاملة (إن أمكن)
```

---

## 🔐 أسئلة الأمان

### س11: هل بياناتي آمنة؟
```
نعم! نستخدم:

1. تشفير كلمات المرور:
   ✓ bcrypt مع salt
   ✓ لا يمكن استرجاع كلمة المرور الأصلية

2. Authentication:
   ✓ JWT tokens
   ✓ تنتهي صلاحية الـ token بعد وقت محدد
   ✓ لا يمكن استخدام token قديم

3. Authorization:
   ✓ فحص صلاحيات في كل عملية
   ✓ فصل الأدوار والمسؤوليات
   ✓ منع الوصول غير المصرح

4. Validation:
   ✓ فحص جميع المدخلات
   ✓ منع SQL Injection
   ✓ منع Cross-Site Scripting (XSS)

5. Logging:
   ✓ تسجيل كل الأنشطة الحساسة
   ✓ كشف الأنشطة المريبة
```

### س12: ماذا لو نسيت كلمة المرور؟
```
الخطوات:
1. انقر على "نسيت كلمة المرور"
2. أدخل بريدك الإلكتروني
3. سيصلك بريد إلكتروني برابط آمن
4. انقر على الرابط
5. أدخل كلمة مرور جديدة
6. سجل دخول بالكلمة الجديدة

ملاحظات:
✓ الرابط صالح لـ 24 ساعة فقط
✓ استخدم كلمة مرور قوية
✓ لا تشارك الرابط مع أحد
```

### س13: كيف أعرف أن اتصالي آمن؟
```
علامات الأمان:
1. ✓ الرابط يبدأ بـ https:// (و ليس http://)
2. ✓ يوجد قفل في شريط العنوان
3. ✓ رسالة "اتصال آمن" من المتصفح
4. ✓ البيانات مشفرة أثناء الإرسال

تحذيرات:
✗ إذا رأيت "غير آمن"
✗ إذا اختفى القفل
✗ إذا ظهرت رسالة تحذير
→ لا تدخل بيانات حساسة
```

---

## 📊 أسئلة الأداء

### س14: لماذا النظام بطيء أحياناً؟
```
الأسباب الممكنة:
1. ✗ اتصال إنترنت بطيء
2. ✗ خادم مشغول جداً
3. ✗ متصفح به مشاكل
4. ✗ كمية بيانات كثيرة جداً

الحل:
✓ تحقق من سرعة الإنترنت
✓ حاول الاستخدام في وقت أقل ازدحام
✓ امسح ذاكرة المتصفح
✓ استخدم متصفح حديث
✓ لا تفتح عدد كبير من الـ tabs

للنظام:
✓ نستخدم pagination (حمل البيانات تدريجياً)
✓ نستخدم caching (حفظ البيانات مؤقتاً)
✓ نستخدم indexes على قاعدة البيانات
✓ ننقل البيانات الثقيلة بشكل متزامن
```

### س15: هل النظام يدعم عدد كبير من المستثمرين؟
```
نعم! النظام مصمم لـ:

✓ 1,000+ شركة
✓ 100,000+ مستثمر
✓ 1,000,000+ عملية استثمار
✓ 100,000+ مشروع

كيفية القياس:
1. نستخدم database indexes الفعالة
2. نستخدم pagination للبيانات الكبيرة
3. نستخدم caching لتقليل الاستعلامات
4. نراقب الأداء باستمرار
5. نقوم بـ load testing قبل الإطلاق
```

---

## 📞 الدعم والمساعدة

### كيف أتواصل مع الدعم؟
```
قنوات الدعم:
1. البريد الإلكتروني: support@example.com
2. الهاتف: 1800-INVEST-1
3. الدردشة الحية: www.example.com/chat
4. وسائل التواصل: @example على فيسبوك

أوقات العمل:
السبت - الخميس: 9:00 AM - 6:00 PM
الجمعة: مغلق
الأعياد: مغلق

وقت الاستجابة:
- قضايا حرجة: أقل من ساعة
- قضايا عادية: أقل من 24 ساعة
- استفسارات: أقل من 48 ساعة
```

### ما يجب تجهيزه عند طلب الدعم؟
```
معلومات مهمة:
1. ✓ وصف واضح للمشكلة
2. ✓ خطوات لتكرار المشكلة
3. ✓ رسالة الخطأ بالكامل
4. ✓ الوقت الذي حدثت فيه
5. ✓ اسم المتصفح والجهاز
6. ✓ رقم حسابك أو البريد
7. ✓ لقطة شاشة (إن أمكن)

مثال:
    الموضوع: "خطأ عند الاستثمار"
    
    الوصف:
    عندما أحاول الاستثمار في المشروع #5 بمبلغ 10,000
    يظهر خطأ "خطأ في الخادم"
    
    التفاصيل:
    - الوقت: 2024-05-31 02:30 PM
    - المتصفح: Chrome 120
    - الجهاز: Windows 10
    - الحساب: user@example.com
```

---

## 🎓 نصائح إضافية

### كيف أستخدم النظام بفعالية؟
```
1. اقرأ الشروط والأحكام بعناية
2. تحقق من تقييم المشاريع قبل الاستثمار
3. نوّع استثماراتك (لا تستثمر كل أموالك في مشروع واحد)
4. راقب الأرباح بانتظام
5. احتفظ بسجل لاستثماراتك
6. لا تشارك بيانات حسابك مع أحد
7. استخدم كلمة مرور قوية وفريدة
8. فعّل المصادقة الثنائية (إن توفرت)
```

### ماذا تفعل قبل الاستثمار؟
```
✓ اقرأ تفاصيل المشروع بالكامل
✓ تحقق من صاحب المشروع والشركة
✓ افهم الحد الأدنى للاستثمار
✓ احسب العائد المتوقع
✓ تأكد من مدة الاستثمار
✓ اقرأ التقييمات من مستثمرين آخرين
✓ لا تقرر بسرعة - خذ وقتك
```

---

## ✅ قائمة التحقق (Checklist)

قبل البدء:
```
□ فهمت الفرق بين Guest و Investor
□ فهمت كيف يعمل نظام الدعوات
□ فهمت الصلاحيات والأدوار
□ قرأت سياسة الخصوصية
□ اتفقت على الشروط والأحكام
□ لدي بريد إلكتروني صحيح
□ لدي كلمة مرور قوية
```

عند الاستثمار:
```
□ تحققت من تفاصيل المشروع
□ تحققت من رصيدي
□ المبلغ أكبر من الحد الأدنى
□ المشروع نشط
□ فهمت شروط السحب
□ احتفظت برقم الاستثمار
```

---

هل لديك سؤال آخر؟ 📧
اطلب مساعدة إضافية!
