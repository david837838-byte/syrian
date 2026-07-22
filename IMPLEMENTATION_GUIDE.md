# 💻 أمثلة الكود الفعلي - نظام حسابات الضيف للشركات

## 📂 ملف: database_schema.sql

```sql
-- جدول الشركات
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_user_id INTEGER NOT NULL,
    logo_url TEXT,
    industry TEXT,
    is_verified BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- جدول أعضاء الشركة
CREATE TABLE IF NOT EXISTS company_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    member_type TEXT DEFAULT 'member',  -- 'owner', 'admin', 'manager', 'member'
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(company_id, user_id)
);

-- جدول دعوات الضيوف
CREATE TABLE IF NOT EXISTS guest_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    invitation_token TEXT UNIQUE NOT NULL,
    invitation_type TEXT DEFAULT 'investor',  -- 'investor', 'advisor'
    status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'expired'
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    accepted_by_user_id INTEGER,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (accepted_by_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- تحديث جدول المستخدمين
ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'user';  -- 'user', 'company', 'guest', 'admin'
ALTER TABLE users ADD COLUMN company_id INTEGER;
ALTER TABLE users ADD FOREIGN KEY (company_id) REFERENCES companies(id);

-- تحديث جدول الاستثمارات
ALTER TABLE investments ADD COLUMN company_id INTEGER;
ALTER TABLE investments ADD COLUMN created_by_type TEXT DEFAULT 'admin';  -- 'admin', 'company'
ALTER TABLE investments ADD FOREIGN KEY (company_id) REFERENCES companies(id);

-- جدول الصلاحيات
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,  -- NULL إذا كانت صلاحيات عامة
    permission_name TEXT NOT NULL,
    permission_type TEXT DEFAULT 'allow',  -- 'allow', 'deny'
    granted_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, company_id, permission_name)
);

-- جدول سجل الأنشطة
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,
    action_type TEXT NOT NULL,
    action_details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

---

## 🐍 ملف: routes/company_management.py

```python
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import secrets
import sqlite3

def register_company_routes(app, ctx):
    """إدارة الشركات والضيوف"""
    
    # ========================
    # إنشاء شركة جديدة
    # ========================
    @app.route('/api/companies', methods=['POST'])
    @jwt_required()
    def create_company():
        """
        إنشاء شركة جديدة
        Body: {
            name: "اسم الشركة",
            description: "الوصف",
            industry: "المجال"
        }
        """
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # التحقق من البيانات
            if not data.get('name') or not data.get('description'):
                return jsonify({'error': 'البيانات غير مكتملة'}), 400
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # التحقق من عدم وجود شركة بنفس الاسم
            existing = cursor.execute(
                'SELECT id FROM companies WHERE name = ?',
                (data['name'],)
            ).fetchone()
            
            if existing:
                return jsonify({'error': 'اسم الشركة موجود بالفعل'}), 400
            
            # إنشاء الشركة
            slug = data['name'].lower().replace(' ', '-')
            cursor.execute('''
                INSERT INTO companies 
                (name, slug, description, owner_user_id, industry)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['name'], slug, data['description'], current_user_id, data.get('industry', '')))
            
            company_id = cursor.lastrowid
            
            # إضافة المالك كعضو admin
            cursor.execute('''
                INSERT INTO company_members 
                (company_id, user_id, member_type)
                VALUES (?, ?, ?)
            ''', (company_id, current_user_id, 'owner'))
            
            # تحديث type المستخدم
            cursor.execute(
                'UPDATE users SET user_type = ? WHERE id = ?',
                ('company', current_user_id)
            )
            
            conn.commit()
            conn.close()
            
            # تسجيل النشاط
            log_activity(app, current_user_id, company_id, 'create_company', 
                        {'company_name': data['name']})
            
            return jsonify({
                'message': 'تم إنشاء الشركة بنجاح',
                'company_id': company_id,
                'name': data['name']
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # دعوة ضيف جديد
    # ========================
    @app.route('/api/company/<int:company_id>/invite-guest', methods=['POST'])
    @jwt_required()
    def invite_guest(company_id):
        """
        دعوة ضيف للاستثمار في مشاريع الشركة
        Body: {
            email: "guest@example.com",
            invitation_type: "investor"
        }
        """
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # التحقق من أن المستخدم admin بالشركة
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            member = cursor.execute('''
                SELECT member_type FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (company_id, current_user_id)).fetchone()
            
            if not member or member['member_type'] not in ['owner', 'admin']:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية'}), 403
            
            # التحقق من البريد الإلكتروني
            if not data.get('email'):
                conn.close()
                return jsonify({'error': 'البريد الإلكتروني مطلوب'}), 400
            
            # التحقق من عدم وجود حساب بهذا البريد
            existing_user = cursor.execute(
                'SELECT id FROM users WHERE email = ?',
                (data['email'],)
            ).fetchone()
            
            if existing_user:
                conn.close()
                return jsonify({'error': 'البريد الإلكتروني مسجل بالفعل'}), 400
            
            # إنشاء token فريد للدعوة
            invitation_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(days=30)
            
            # إنشاء الدعوة
            cursor.execute('''
                INSERT INTO guest_invitations
                (company_id, email, invitation_token, invitation_type, expires_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (company_id, data['email'], invitation_token, 
                  data.get('invitation_type', 'investor'), expires_at, current_user_id))
            
            conn.commit()
            
            # الحصول على معلومات الشركة
            company = cursor.execute(
                'SELECT name FROM companies WHERE id = ?',
                (company_id,)
            ).fetchone()
            
            conn.close()
            
            # إرسال البريد الإلكتروني
            invitation_url = f"{request.host_url}register?token={invitation_token}"
            send_guest_invitation_email(
                email=data['email'],
                company_name=company['name'],
                invitation_url=invitation_url
            )
            
            # تسجيل النشاط
            log_activity(app, current_user_id, company_id, 'invite_guest',
                        {'guest_email': data['email']})
            
            return jsonify({
                'message': 'تم إرسال الدعوة بنجاح',
                'invitation_token': invitation_token
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # التسجيل عبر الدعوة
    # ========================
    @app.route('/api/auth/register-with-invitation', methods=['POST'])
    def register_with_invitation():
        """
        تسجيل حساب ضيف جديد عبر دعوة
        Body: {
            invitation_token: "token123",
            name: "أحمد محمد",
            password: "SecurePass123!",
            phone: "1234567890"
        }
        """
        try:
            data = request.get_json()
            
            # التحقق من البيانات
            required_fields = ['invitation_token', 'name', 'password']
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'بيانات ناقصة'}), 400
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # البحث عن الدعوة
            invitation = cursor.execute('''
                SELECT * FROM guest_invitations
                WHERE invitation_token = ? AND status = 'pending'
            ''', (data['invitation_token'],)).fetchone()
            
            if not invitation:
                conn.close()
                return jsonify({'error': 'الدعوة غير صحيحة أو منتهية'}), 400
            
            # التحقق من انتهاء الدعوة
            if datetime.fromisoformat(invitation['expires_at']) < datetime.utcnow():
                cursor.execute(
                    'UPDATE guest_invitations SET status = ? WHERE id = ?',
                    ('expired', invitation['id'])
                )
                conn.commit()
                conn.close()
                return jsonify({'error': 'الدعوة منتهية الصلاحية'}), 400
            
            # التحقق من عدم وجود حساب بهذا البريد
            existing_user = cursor.execute(
                'SELECT id FROM users WHERE email = ?',
                (invitation['email'],)
            ).fetchone()
            
            if existing_user:
                conn.close()
                return jsonify({'error': 'البريد الإلكتروني مسجل بالفعل'}), 400
            
            # تشفير كلمة المرور
            hashed_password = ctx.bcrypt.generate_password_hash(
                data['password']
            ).decode('utf-8')
            
            # إنشاء المستخدم
            public_user_id = 100000 + int(datetime.utcnow().timestamp())
            
            cursor.execute('''
                INSERT INTO users
                (name, email, phone, password, role, user_type, company_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (data['name'], invitation['email'], data.get('phone', ''),
                  hashed_password, 'user', 'guest', invitation['company_id']))
            
            user_id = cursor.lastrowid
            
            # إضافة المستخدم كعضو في الشركة
            cursor.execute('''
                INSERT INTO company_members
                (company_id, user_id, member_type)
                VALUES (?, ?, ?)
            ''', (invitation['company_id'], user_id, 'member'))
            
            # تحديث حالة الدعوة
            cursor.execute('''
                UPDATE guest_invitations
                SET status = 'accepted', accepted_at = ?, accepted_by_user_id = ?
                WHERE id = ?
            ''', (datetime.utcnow(), user_id, invitation['id']))
            
            # إضافة الصلاحيات الافتراضية
            default_permissions = ['invest', 'view_my_investments', 'withdraw_profits']
            for perm in default_permissions:
                cursor.execute('''
                    INSERT INTO user_permissions
                    (user_id, company_id, permission_name, granted_by)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, invitation['company_id'], perm, 0))  # 0 = نظام
            
            conn.commit()
            
            # إنشاء token للتسجيل الفوري
            access_token = ctx.create_access_token(
                identity=user_id,
                additional_claims={'role': 'user'}
            )
            
            # تسجيل النشاط
            log_activity(app, user_id, invitation['company_id'], 'register_as_guest',
                        {'invitation_id': invitation['id']})
            
            conn.close()
            
            return jsonify({
                'message': 'تم التسجيل بنجاح',
                'access_token': access_token,
                'user_id': user_id,
                'user_type': 'guest'
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # عرض الدعوات المعلقة
    # ========================
    @app.route('/api/company/<int:company_id>/invitations', methods=['GET'])
    @jwt_required()
    def get_company_invitations(company_id):
        """عرض قائمة الدعوات المعلقة والمقبولة"""
        try:
            current_user_id = get_jwt_identity()
            status = request.args.get('status', 'pending')
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # التحقق من الصلاحية
            member = cursor.execute('''
                SELECT member_type FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (company_id, current_user_id)).fetchone()
            
            if not member:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية'}), 403
            
            # الحصول على الدعوات
            invitations = cursor.execute('''
                SELECT 
                    id, email, invitation_type, status,
                    created_at, expires_at, accepted_at
                FROM guest_invitations
                WHERE company_id = ? AND status = ?
                ORDER BY created_at DESC
            ''', (company_id, status)).fetchall()
            
            conn.close()
            
            return jsonify({
                'invitations': [dict(inv) for inv in invitations]
            }), 200
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # حذف دعوة
    # ========================
    @app.route('/api/company/<int:company_id>/invitations/<int:inv_id>', 
               methods=['DELETE'])
    @jwt_required()
    def delete_invitation(company_id, inv_id):
        """حذف دعوة لم تُستخدم بعد"""
        try:
            current_user_id = get_jwt_identity()
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # التحقق من الصلاحية
            member = cursor.execute('''
                SELECT member_type FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (company_id, current_user_id)).fetchone()
            
            if not member or member['member_type'] not in ['owner', 'admin']:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية'}), 403
            
            # التحقق من وجود الدعوة
            invitation = cursor.execute('''
                SELECT id FROM guest_invitations
                WHERE id = ? AND company_id = ? AND status = 'pending'
            ''', (inv_id, company_id)).fetchone()
            
            if not invitation:
                conn.close()
                return jsonify({'error': 'الدعوة غير موجودة أو تم استخدامها'}), 404
            
            # حذف الدعوة
            cursor.execute('DELETE FROM guest_invitations WHERE id = ?', (inv_id,))
            conn.commit()
            conn.close()
            
            return jsonify({'message': 'تم حذف الدعوة'}), 200
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500


def log_activity(app, user_id, company_id, action_type, details=None):
    """تسجيل نشاط المستخدم"""
    try:
        conn = sqlite3.connect(app.config['DATABASE'])
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO activity_logs
            (user_id, company_id, action_type, action_details)
            VALUES (?, ?, ?, ?)
        ''', (user_id, company_id, action_type, str(details)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging activity: {e}")


def send_guest_invitation_email(email, company_name, invitation_url):
    """إرسال بريد الدعوة للضيف"""
    # يمكن استخدام خدمة البريد الموجودة
    # from email_service import send_email
    pass
```

---

## 🐍 ملف: routes/company_projects.py

```python
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

def register_company_project_routes(app, ctx):
    """إدارة مشاريع الشركة"""
    
    # ========================
    # إنشاء مشروع جديد (شركة فقط)
    # ========================
    @app.route('/api/company/<int:company_id>/projects', methods=['POST'])
    @jwt_required()
    def create_company_project(company_id):
        """
        إنشاء مشروع جديد من قبل شركة
        Body: {
            name: "اسم المشروع",
            description: "الوصف",
            total_amount: 100000,
            min_investment: 1000,
            return_rate: 15,
            duration: 12,
            category: "عقارات"
        }
        """
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            # التحقق من البيانات
            required_fields = ['name', 'total_amount', 'min_investment', 'return_rate', 'duration']
            if not all(field in data for field in required_fields):
                return jsonify({'error': 'بيانات ناقصة'}), 400
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # التحقق من أن المستخدم admin بالشركة
            member = cursor.execute('''
                SELECT member_type FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (company_id, current_user_id)).fetchone()
            
            if not member or member['member_type'] not in ['owner', 'admin']:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية لإنشاء مشاريع'}), 403
            
            # التحقق من الصلاحية
            permission = cursor.execute('''
                SELECT * FROM user_permissions
                WHERE user_id = ? AND company_id = ? 
                AND permission_name = 'create_project'
                AND permission_type = 'allow'
            ''', (current_user_id, company_id)).fetchone()
            
            if not permission:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية'}), 403
            
            # إنشاء المشروع
            cursor.execute('''
                INSERT INTO investments
                (name, description, total_amount, min_investment, return_rate, 
                 duration, category, company_id, created_by_type, added_by, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'company', ?, 'active')
            ''', (
                data['name'],
                data.get('description', ''),
                data['total_amount'],
                data['min_investment'],
                data['return_rate'],
                data['duration'],
                data.get('category', 'عام'),
                company_id,
                current_user_id
            ))
            
            project_id = cursor.lastrowid
            conn.commit()
            
            # تسجيل النشاط
            log_activity(app, current_user_id, company_id, 'create_project',
                        {'project_id': project_id, 'project_name': data['name']})
            
            conn.close()
            
            return jsonify({
                'message': 'تم إنشاء المشروع بنجاح',
                'project_id': project_id,
                'project_name': data['name']
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # عرض مشاريع الشركة (للأعضاء والضيوف)
    # ========================
    @app.route('/api/company/<int:company_id>/projects', methods=['GET'])
    @jwt_required()
    def get_company_projects(company_id):
        """عرض مشاريع الشركة"""
        try:
            current_user_id = get_jwt_identity()
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # التحقق من أن المستخدم عضو بالشركة
            member = cursor.execute('''
                SELECT member_type FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (company_id, current_user_id)).fetchone()
            
            if not member:
                conn.close()
                return jsonify({'error': 'ليس لديك صلاحية'}), 403
            
            # الحصول على المشاريع
            projects = cursor.execute('''
                SELECT 
                    i.id, i.name, i.description, i.total_amount, i.min_investment,
                    i.return_rate, i.duration, i.category, i.collected, i.status,
                    i.created_at, u.name as created_by_name,
                    COUNT(DISTINCT ui.id) as investor_count,
                    COALESCE(SUM(ui.amount), 0) as total_invested
                FROM investments i
                LEFT JOIN users u ON i.added_by = u.id
                LEFT JOIN user_investments ui ON i.id = ui.investment_id 
                    AND ui.status = 'active'
                WHERE i.company_id = ? AND i.status = 'active'
                GROUP BY i.id
                ORDER BY i.created_at DESC
            ''', (company_id,)).fetchall()
            
            # إذا كان المستخدم guest، أضف معلومات استثماراته
            user_investments = {}
            if member['member_type'] == 'member':
                investments = cursor.execute('''
                    SELECT investment_id, amount, returns, status
                    FROM user_investments
                    WHERE user_id = ?
                ''', (current_user_id,)).fetchall()
                user_investments = {inv['investment_id']: inv for inv in investments}
            
            conn.close()
            
            projects_data = []
            for project in projects:
                project_dict = dict(project)
                project_dict['user_investment'] = user_investments.get(project['id'])
                projects_data.append(project_dict)
            
            return jsonify({'projects': projects_data}), 200
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # ========================
    # الاستثمار في مشروع
    # ========================
    @app.route('/api/projects/<int:project_id>/invest', methods=['POST'])
    @jwt_required()
    def invest_in_project(project_id):
        """
        الاستثمار في مشروع
        Body: {
            amount: 5000
        }
        """
        try:
            current_user_id = get_jwt_identity()
            data = request.get_json()
            
            if not data.get('amount') or data['amount'] <= 0:
                return jsonify({'error': 'المبلغ غير صحيح'}), 400
            
            conn = ctx.get_db_connection()
            cursor = conn.cursor()
            
            # الحصول على معلومات المشروع
            project = cursor.execute('''
                SELECT * FROM investments WHERE id = ?
            ''', (project_id,)).fetchone()
            
            if not project:
                conn.close()
                return jsonify({'error': 'المشروع غير موجود'}), 404
            
            # التحقق من أن المشروع نشط
            if project['status'] != 'active':
                conn.close()
                return jsonify({'error': 'المشروع غير متاح'}), 400
            
            # التحقق من أن المستخدم عضو بالشركة
            member = cursor.execute('''
                SELECT * FROM company_members
                WHERE company_id = ? AND user_id = ?
            ''', (project['company_id'], current_user_id)).fetchone()
            
            if not member:
                conn.close()
                return jsonify({'error': 'لا يمكنك الاستثمار في هذا المشروع'}), 403
            
            # التحقق من الحد الأدنى والأقصى للاستثمار
            if data['amount'] < project['min_investment']:
                conn.close()
                return jsonify({'error': f'الحد الأدنى للاستثمار: {project["min_investment"]}'}), 400
            
            # التحقق من عدم تجاوز الحد الأقصى المجموع
            remaining = project['total_amount'] - project['collected']
            if data['amount'] > remaining:
                conn.close()
                return jsonify({'error': f'المبلغ الباقي: {remaining}'}), 400
            
            # التحقق من رصيد المستخدم
            # (يمكن إضافة نظام محافظ هنا)
            
            # إنشاء الاستثمار
            cursor.execute('''
                INSERT INTO user_investments
                (user_id, investment_id, amount, status, role)
                VALUES (?, ?, ?, 'active', 'investor')
            ''', (current_user_id, project_id, data['amount']))
            
            # تحديث المبلغ المجموع للمشروع
            new_collected = project['collected'] + data['amount']
            cursor.execute('''
                UPDATE investments SET collected = ? WHERE id = ?
            ''', (new_collected, project_id))
            
            conn.commit()
            
            # تسجيل النشاط
            log_activity(app, current_user_id, project['company_id'], 'invest',
                        {'project_id': project_id, 'amount': data['amount']})
            
            conn.close()
            
            return jsonify({
                'message': 'تم تأكيد الاستثمار',
                'investment_id': cursor.lastrowid,
                'amount': data['amount']
            }), 201
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
```

---

## 📋 ملف: middleware/permissions.py

```python
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

def require_permission(permission_name):
    """
    ديكوريتر للتحقق من الصلاحيات
    
    مثال:
    @app.route('/api/project', methods=['POST'])
    @require_permission('create_project')
    def create_project():
        pass
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                current_user_id = get_jwt_identity()
                company_id = kwargs.get('company_id')
                
                # الحصول على قاعدة البيانات من app
                from flask import current_app as app
                conn = app.config['get_db_connection']()
                cursor = conn.cursor()
                
                # التحقق من الصلاحية
                permission = cursor.execute('''
                    SELECT * FROM user_permissions
                    WHERE user_id = ? 
                    AND (company_id = ? OR company_id IS NULL)
                    AND permission_name = ?
                    AND permission_type = 'allow'
                ''', (current_user_id, company_id, permission_name)).fetchone()
                
                conn.close()
                
                if not permission:
                    return jsonify({'error': 'ليس لديك صلاحية'}), 403
                
                return fn(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        return wrapper
    return decorator

def check_user_role(role):
    """التحقق من دور المستخدم"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                from flask import current_app as app
                from flask_jwt_extended import get_jwt
                
                jwt_claims = get_jwt()
                user_role = jwt_claims.get('role', 'user')
                
                if user_role not in role if isinstance(role, list) else [role]:
                    return jsonify({'error': 'دور غير مصرح'}), 403
                
                return fn(*args, **kwargs)
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        return wrapper
    return decorator
```

---

## 🧪 أمثلة الاستخدام

### 1. إنشاء شركة جديدة
```bash
POST /api/companies
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "شركة الاستثمار الذهبي",
    "description": "شركة متخصصة في الاستثمار العقاري",
    "industry": "عقارات"
}

Response:
{
    "message": "تم إنشاء الشركة بنجاح",
    "company_id": 1,
    "name": "شركة الاستثمار الذهبي"
}
```

### 2. دعوة ضيف جديد
```bash
POST /api/company/1/invite-guest
Authorization: Bearer <token>
Content-Type: application/json

{
    "email": "investor@example.com",
    "invitation_type": "investor"
}

Response:
{
    "message": "تم إرسال الدعوة بنجاح",
    "invitation_token": "....."
}
```

### 3. التسجيل عبر الدعوة
```bash
POST /api/auth/register-with-invitation
Content-Type: application/json

{
    "invitation_token": "...",
    "name": "أحمد محمد",
    "password": "SecurePass123!",
    "phone": "1234567890"
}

Response:
{
    "message": "تم التسجيل بنجاح",
    "access_token": "...",
    "user_id": 5,
    "user_type": "guest"
}
```

### 4. إنشاء مشروع
```bash
POST /api/company/1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "مشروع الفلل السكنية",
    "description": "مشروع سكني بـ 50 فيلا",
    "total_amount": 500000,
    "min_investment": 5000,
    "return_rate": 12,
    "duration": 24,
    "category": "عقارات"
}

Response:
{
    "message": "تم إنشاء المشروع بنجاح",
    "project_id": 10,
    "project_name": "مشروع الفلل السكنية"
}
```

### 5. الاستثمار في مشروع
```bash
POST /api/projects/10/invest
Authorization: Bearer <token>
Content-Type: application/json

{
    "amount": 10000
}

Response:
    {
    "message": "تم تأكيد الاستثمار",
    "investment_id": 1,
    "amount": 10000
}
```

---

## 🔒 نقاط الأمان المهمة

```python
# 1. التحقق من الصلاحيات دائماً
def check_authorization(user_id, company_id, action):
    # تحقق من صلاحيات المستخدم
    pass

# 2. تشفير البيانات الحساسة
password_hash = bcrypt.generate_password_hash(password)

# 3. التحقق من البريد الإلكتروني
if not is_valid_email(email):
    return error

# 4. تسجيل العمليات
log_activity(user_id, company_id, action, details)

# 5. معالجة الأخطاء بأمان
try:
    # العملية
except Exception as e:
    log_error(e)
    return safe_error_message
```

---

## 📈 الخطوة التالية

بعد تطبيق هذا الكود:
1. قم باختبار كل API منفصلة
2. أضف واجهات frontend للعمليات
3. قم بإضافة نظام التنبيهات عبر البريد
4. أضف نظام التقارير والإحصائيات
5. قم بتحسين الأمان والأداء

