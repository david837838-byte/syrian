"""
نظام البريد الإلكتروني
"""

try:
    from flask_mail import Mail, Message
except ImportError:
    Mail = None
    Message = None
from flask import current_app, render_template_string
from logger_config import get_logger
from email.message import EmailMessage
from email.utils import formataddr
import os
import sqlite3
import smtplib
import ssl

logger = get_logger()

mail = Mail() if Mail else None
LAST_EMAIL_ERROR = ''
PLATFORM_BRAND_NAME = 'منصة الاستثمار الذكية الآمنة'


def init_mail(app):
    """تهيئة نظام البريد الإلكتروني"""
    if mail:
        mail.init_app(app)


def get_brand_name():
    configured_name = current_app.config.get('MAIL_SENDER_NAME')
    database_path = current_app.config.get('DATABASE_PATH')
    if database_path:
        try:
            conn = sqlite3.connect(database_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT value FROM system_settings WHERE key = 'mail_sender_name'"
            ).fetchone()
            conn.close()
            if row and row['value']:
                return row['value']
        except Exception as exc:
            logger.warning(f"Could not load mail sender name from settings: {exc}")
    return configured_name or PLATFORM_BRAND_NAME


def get_setting_value(key, default=None):
    database_path = current_app.config.get('DATABASE_PATH')
    if database_path:
        try:
            conn = sqlite3.connect(database_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                'SELECT value FROM system_settings WHERE key = ?',
                (key,)
            ).fetchone()
            conn.close()
            if row and row['value'] not in (None, ''):
                return row['value']
        except Exception as exc:
            logger.warning(f"Could not load setting {key}: {exc}")
    return current_app.config.get(key.upper(), default)


def get_mail_runtime_settings():
    server = get_setting_value('mail_server', current_app.config.get('MAIL_SERVER', 'smtp.gmail.com'))
    port_value = get_setting_value('mail_port', current_app.config.get('MAIL_PORT', 587))
    use_tls_value = get_setting_value('mail_use_tls', current_app.config.get('MAIL_USE_TLS', True))
    username = get_setting_value('mail_username', current_app.config.get('MAIL_USERNAME'))
    password = get_setting_value('mail_password', current_app.config.get('MAIL_PASSWORD'))
    sender_email = get_setting_value('mail_default_sender', current_app.config.get('MAIL_DEFAULT_SENDER'))

    try:
        port = int(port_value)
    except (TypeError, ValueError):
        port = 587

    use_tls = str(use_tls_value).lower() == 'true' if not isinstance(use_tls_value, bool) else use_tls_value

    return {
        'server': server,
        'port': port,
        'use_tls': use_tls,
        'username': username,
        'password': password,
        'sender_email': sender_email,
        'sender_name': get_brand_name()
    }


def get_default_sender():
    settings = get_mail_runtime_settings()
    sender_email = settings['sender_email'] or os.environ.get('MAIL_DEFAULT_SENDER')
    sender_name = settings['sender_name']
    return (sender_name, sender_email) if sender_email else sender_name


def get_last_email_error():
    return LAST_EMAIL_ERROR


def send_email(subject, recipients, text_body=None, html_body=None, sender=None):
    """إرسال بريد إلكتروني"""
    global LAST_EMAIL_ERROR
    try:
        LAST_EMAIL_ERROR = ''
        if current_app.config.get('TESTING'):
            logger.info(f"Email send mocked during tests to {recipients}: {subject}")
            return True
        settings = get_mail_runtime_settings()
        server = settings['server']
        port = settings['port']
        use_tls = settings['use_tls']
        username = settings['username']
        password = settings['password']
        sender_email = settings['sender_email']
        sender_name = settings['sender_name']

        if not server or not sender_email:
            LAST_EMAIL_ERROR = 'إعدادات البريد ناقصة: يجب إدخال خادم SMTP والبريد المرسل.'
            logger.warning("Email service is not fully configured: missing SMTP server or sender email")
            return False

        from_value = sender or formataddr((sender_name, sender_email))
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = from_value
        msg['To'] = ', '.join(recipients)
        msg.set_content(text_body or 'لديك رسالة جديدة من منصة الاستثمار.')
        if html_body:
            msg.add_alternative(html_body, subtype='html')

        if not use_tls and port == 465:
            with smtplib.SMTP_SSL(server, port, context=ssl.create_default_context(), timeout=20) as smtp:
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(server, port, timeout=20) as smtp:
                smtp.ehlo()
                if use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                if username and password:
                    smtp.login(username, password)
                smtp.send_message(msg)
        logger.info(f"Email sent to {recipients}: {subject}")
        return True
    
    except Exception as e:
        LAST_EMAIL_ERROR = str(e)
        logger.error(f"Failed to send email: {str(e)}")
        return False


def send_verification_email(user_email, user_name, verification_link):
    """إرسال بريد التحقق من الحساب"""
    brand_name = get_brand_name()
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>مرحباً {user_name}</h2>
        <p>شكراً لتسجيلك في منصتنا! يرجى تأكيد بريدك الإلكتروني بالنقر على الرابط أدناه:</p>
        <p><a href="{verification_link}" style="background-color: #0a7c3d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">تأكيد البريد الإلكتروني</a></p>
        <p>أو انسخ والصق الرابط أدناه في متصفحك:</p>
        <p>{verification_link}</p>
        <p>الرابط ساري المفعول لمدة 24 ساعة فقط.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">منصة الاستثمار الذكية</p>
    </div>
    """
    
    return send_email(
        subject=f"تأكيد بريدك الإلكتروني - {brand_name}",
        recipients=[user_email],
        html_body=html_body
    )


def send_verification_code_email(user_email, user_name, verification_code):
    """إرسال كود تحقق للبريد الإلكتروني"""
    brand_name = get_brand_name()
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>تأكيد البريد الإلكتروني</h2>
        <p>مرحباً {user_name},</p>
        <p>أدخل الكود التالي داخل المنصة لتأكيد بريدك الإلكتروني:</p>
        <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0a7c3d;">
            {verification_code}
        </div>
        <p>صلاحية الكود 15 دقيقة فقط.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">{brand_name}</p>
    </div>
    """

    return send_email(
        subject=f"كود التحقق - {brand_name}",
        recipients=[user_email],
        html_body=html_body
    )


def send_password_reset_email(user_email, user_name, reset_link):
    """إرسال بريد إعادة تعيين كلمة المرور"""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>مرحباً {user_name},</p>
        <p>لقد طلبت إعادة تعيين كلمة المرور. انقر على الرابط أدناه:</p>
        <p><a href="{reset_link}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">إعادة تعيين كلمة المرور</a></p>
        <p>أو انسخ والصق الرابط أدناه:</p>
        <p>{reset_link}</p>
        <p>الرابط ساري المفعول لمدة 1 ساعة فقط.</p>
        <p style="color: #f59e0b; font-weight: bold;">إذا لم تطلب هذا، يرجى تجاهل هذا البريد.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">منصة الاستثمار الذكية</p>
    </div>
    """
    
    return send_email(
        subject="إعادة تعيين كلمة المرور - منصة الاستثمار الذكية",
        recipients=[user_email],
        html_body=html_body
    )


def send_password_reset_code_email(user_email, user_name, reset_code):
    """Send a password reset code email."""
    brand_name = get_brand_name()
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>إعادة تعيين كلمة المرور</h2>
        <p>مرحباً {user_name},</p>
        <p>استخدم الكود التالي داخل المنصة لإنشاء كلمة مرور جديدة:</p>
        <div style="margin: 24px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ef4444;">
            {reset_code}
        </div>
        <p>صلاحية الكود 15 دقيقة فقط.</p>
        <p style="color: #f59e0b; font-weight: bold;">إذا لم تطلب هذه العملية فيرجى تجاهل الرسالة.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">{brand_name}</p>
    </div>
    """

    return send_email(
        subject=f"كود إعادة المرور - {brand_name}",
        recipients=[user_email],
        html_body=html_body
    )


def send_transaction_notification(user_email, user_name, transaction_type, amount, currency, status):
    """إرسال إشعار بمعاملة"""
    status_ar = {
        'pending': 'قيد الانتظار',
        'completed': 'مكتملة',
        'rejected': 'مرفوضة',
        'failed': 'فشلت'
    }.get(status, status)
    
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>إشعار معاملة جديدة</h2>
        <p>مرحباً {user_name},</p>
        <p>لديك معاملة جديدة:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>نوع المعاملة:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">{transaction_type}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>المبلغ:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">{amount} {currency}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>الحالة:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">{status_ar}</td>
            </tr>
        </table>
        <p><a href="{os.environ.get('PLATFORM_URL', 'http://localhost:5000')}/dashboard" style="background-color: #0a7c3d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">عرض التفاصيل</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">منصة الاستثمار الذكية</p>
    </div>
    """
    
    return send_email(
        subject=f"إشعار معاملة - {transaction_type}",
        recipients=[user_email],
        html_body=html_body
    )


def send_investment_notification(user_email, user_name, investment_name, amount, expected_return):
    """إرسال إشعار بالاستثمار"""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>شكراً على استثمارك!</h2>
        <p>مرحباً {user_name},</p>
        <p>تم تسجيل استثمارك بنجاح:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>المشروع:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">{investment_name}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>المبلغ المستثمر:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${amount}</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>العائد المتوقع:</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${expected_return}</td>
            </tr>
        </table>
        <p>سيتم إرسال تقارير مرحلية إليك بانتظام.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">منصة الاستثمار الذكية</p>
    </div>
    """
    
    return send_email(
        subject="تأكيد الاستثمار - منصة الاستثمار الذكية",
        recipients=[user_email],
        html_body=html_body
    )


def send_admin_notification(admin_email, subject, message):
    """إرسال إشعار للأدمن"""
    html_body = f"""
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
        <h2>{subject}</h2>
        <p>{message}</p>
        <p><a href="{os.environ.get('ADMIN_URL', 'http://localhost:5000/admin')}" style="background-color: #0a7c3d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">إلى لوحة التحكم</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">منصة الاستثمار الذكية</p>
    </div>
    """
    
    return send_email(
        subject=f"[إشعار أدمن] {subject}",
        recipients=[admin_email],
        html_body=html_body
    )
