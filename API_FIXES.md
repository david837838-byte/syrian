# توثيق API - الأخطاء المصححة

## 🔴 الأخطاء التي كانت تسبب 422

### 1. المعاملات - الإيداع والسحب

#### المشكلة الأصلية:
```
❌ POST /api/transactions/deposit
Request Body:
{
    "currency_id": 1,      ← الخادم يتوقع ID لكن الواجهة ترسل string
    "network_id": 1,       ← الخادم يتوقع ID لكن الواجهة ترسل string
    "amount": 100,
    "tx_hash": "0x123..."
}

Error: 422 Unprocessable Entity
```

#### الحل المطبق:
```python
# تغيير البيانات المتوقعة
required_fields = ['currency', 'network', 'amount', 'tx_hash']

# تحويل الرموز إلى IDs
currency_code = data['currency'].upper()  # "USDT"
network_code = data['network'].upper()    # "TRC20"

currency = conn.execute(
    'SELECT id FROM currencies WHERE code = ? AND is_active = 1',
    (currency_code,)
).fetchone()

network = conn.execute(
    'SELECT id FROM networks WHERE code = ? AND is_active = 1',
    (network_code,)
).fetchone()

# الآن لدينا currency['id'] و network['id']
```

---

### 2. محافظ الأدمن - المسارات المفقودة

#### المشكلة:
```
❌ POST /api/admin/wallets
Response: 404 Not Found

❌ GET /api/admin/wallets
Response: 404 Not Found
```

#### الحل:
```python
# ✅ تم إضافة المسارات

@app.route('/api/admin/wallets', methods=['POST'])
@admin_required
def create_admin_wallet():
    """إضافة محفظة أدمن جديدة"""
    # التحقق من البيانات
    # تحويل رموز العملة والشبكة إلى IDs
    # إضافة المحفظة إلى قاعدة البيانات

@app.route('/api/admin/wallets', methods=['GET'])
@admin_required
def get_admin_wallets():
    """جلب محافظ الأدمن"""
    # استرجاع قائمة المحافظ مع معلومات العملات والشبكات
```

---

### 3. سجل المعاملات - المسار المفقود

#### المشكلة:
```
❌ GET /api/transactions
Response: 404 Not Found
```

#### الحل:
```python
# ✅ تم إضافة المسار

@app.route('/api/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    """جلب سجل معاملات المستخدم"""
    user_id = get_jwt_identity()
    
    transactions = conn.execute('''
        SELECT 
            t.id,
            t.type,
            t.status,
            t.amount,
            c.code as currency,
            c.symbol,
            n.name as network_name,
            t.tx_hash,
            t.created_at as date,
            t.note
        FROM transactions t
        JOIN currencies c ON t.currency_id = c.id
        JOIN networks n ON t.network_id = n.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 50
    ''', (user_id,)).fetchall()
    
    return jsonify({
        'success': True,
        'data': {'transactions': [dict(t) for t in transactions]}
    }), 200
```

---

### 4. الاستثمار - المسار المفقود

#### المشكلة:
```
❌ POST /api/invest
Response: 404 Not Found
```

#### الحل:
```python
# ✅ تم إضافة المسار

@app.route('/api/invest', methods=['POST'])
@jwt_required()
def invest():
    """الاستثمار في مشروع"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # التحقق من وجود المشروع
    investment = conn.execute(
        'SELECT * FROM investments WHERE id = ? AND status = "active"',
        (data['investment_id'],)
    ).fetchone()
    
    # التحقق من الحد الأدنى
    if amount < investment['min_investment']:
        return jsonify({'error': 'Minimum investment...'}), 400
    
    # خصم المبلغ والتسجيل
    cursor.execute('''
        UPDATE user_wallets 
        SET balance = balance - ?
        WHERE user_id = ? AND currency_id = 1
    ''', (amount, user_id))
    
    cursor.execute('''
        INSERT INTO user_investments (user_id, investment_id, amount, status)
        VALUES (?, ?, ?, 'active')
    ''', (user_id, data['investment_id'], amount))
    
    return jsonify({'success': True}), 201
```

---

### 5. لوحة المدير - الاستثمارات

#### المشكلة:
```
❌ GET /api/admin/investments
Response: 404 Not Found
```

#### الحل:
```python
# ✅ تم إضافة المسار

@app.route('/api/admin/investments', methods=['GET'])
@admin_required
def get_admin_investments():
    """جلب الاستثمارات للأدمن"""
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
            i.status,
            i.category,
            u.name as admin_name,
            (SELECT COUNT(*) FROM user_investments 
             WHERE investment_id = i.id) as investor_count,
            i.created_at
        FROM investments i
        LEFT JOIN users u ON i.added_by = u.id
        ORDER BY i.created_at DESC
    ''').fetchall()
    
    return jsonify({
        'success': True,
        'data': {'investments': [dict(inv) for inv in investments]}
    }), 200
```

---

### 6. الموافقة على السحب - مسارات بديلة

#### المشكلة:
```
❌ POST /api/admin/withdrawals/<id>/approve
❌ POST /api/admin/withdrawals/<id>/reject
Response: 404 Not Found

(الخادم كان يملك /process فقط)
```

#### الحل:
```python
# ✅ تم إضافة مسارات بديلة

@app.route('/api/admin/withdrawals/<int:withdrawal_id>/approve', methods=['POST'])
@admin_required
def admin_approve_withdrawal(withdrawal_id):
    """الموافقة على السحب"""
    # تحديث حالة الطلب إلى completed
    # تحرير المبلغ المعلق

@app.route('/api/admin/withdrawals/<int:withdrawal_id>/reject', methods=['POST'])
@admin_required
def admin_reject_withdrawal(withdrawal_id):
    """رفض السحب"""
    # تحديث حالة الطلب إلى rejected
    # إرجاع المبلغ إلى الرصيد
```

---

### 7. حذف المستخدمين والاستثمارات

#### المشكلة:
```
❌ DELETE /api/admin/users/<id>
❌ DELETE /api/admin/investments/<id>
Response: 404 Not Found
```

#### الحل:
```python
# ✅ تم إضافة المسارات

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """حذف مستخدم"""
    if user_id == 1:  # منع حذف الأدمن الأول
        return jsonify({'error': 'Cannot delete admin user'}), 403
    
    cursor.execute('DELETE FROM user_wallets WHERE user_id = ?', (user_id,))
    cursor.execute('DELETE FROM users WHERE id = ? AND role != "admin"', (user_id,))

@app.route('/api/admin/investments/<int:investment_id>', methods=['DELETE'])
@admin_required
def delete_investment_admin(investment_id):
    """حذف استثمار"""
    investment = conn.execute(
        'SELECT collected FROM investments WHERE id = ?',
        (investment_id,)
    ).fetchone()
    
    if investment['collected'] > 0:
        return jsonify({'error': 'Cannot delete investment with collected funds'}), 400
    
    cursor.execute('DELETE FROM investments WHERE id = ?', (investment_id,))
```

---

## 📊 جدول المقارنة

| الميزة | قبل | بعد |
|------|-----|-----|
| **المعاملات (Deposit/Withdraw)** | ❌ معاملات خاطئة | ✅ معاملات صحيحة |
| **محافظ الأدمن** | ❌ مفقود | ✅ إضافة/جلب/حذف |
| **سجل المعاملات** | ❌ مفقود | ✅ جلب السجل |
| **الاستثمار** | ❌ مفقود | ✅ إضافة استثمار |
| **الاستثمارات للأدمن** | ❌ مفقود | ✅ جلب القائمة |
| **الموافقة على السحب** | ❌ مسار مختلف | ✅ مسارات متعددة |
| **حذف المستخدمين** | ❌ مفقود | ✅ حذف آمن |
| **حذف الاستثمارات** | ❌ مفقود | ✅ حذف آمن |

---

## ✅ الحالة الحالية

جميع الأخطاء 422 المتعلقة بـ:
- ✅ **المعاملات (Transactions)** - تم التصحيح
- ✅ **المحفظة (Wallet)** - تم التصحيح
- ✅ **لوحة المدير (Admin Dashboard)** - تم التصحيح
- ✅ **محافظ الأدمن (Admin Wallets)** - تم التصحيح

---

## 🧪 اختبار الإصلاحات

```bash
# 1. تشغيل التطبيق
python app.py

# 2. اختبار الإيداع
curl -X POST http://localhost:5000/api/transactions/deposit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USDT",
    "network": "TRC20",
    "amount": 100,
    "tx_hash": "0x123..."
  }'

# 3. اختبار جلب محافظ الأدمن
curl -X GET http://localhost:5000/api/admin/wallets \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 4. اختبار إضافة محفظة أدمن
curl -X POST http://localhost:5000/api/admin/wallets \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "BTC",
    "network": "Bitcoin",
    "address": "1A1z...",
    "label": "المحفظة الرئيسية"
  }'
```

---

**آخر تحديث:** 2026-01-18
**الحالة:** ✅ جميع الأخطاء تم إصلاحها
