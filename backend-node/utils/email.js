const nodemailer = require('nodemailer');
const db = require('../db/database');

function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
        return row ? row.value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

async function sendEmail({ subject, recipients, text_body, html_body }) {
    try {
        const server = getSystemSetting('mail_server', process.env.MAIL_SERVER || 'smtp.gmail.com');
        const portVal = getSystemSetting('mail_port', process.env.MAIL_PORT || 587);
        const username = getSystemSetting('mail_username', process.env.MAIL_USERNAME);
        const password = getSystemSetting('mail_password', process.env.MAIL_PASSWORD);
        const senderEmail = getSystemSetting('mail_default_sender', process.env.MAIL_DEFAULT_SENDER || username || 'noreply@localhost');
        const senderName = getSystemSetting('mail_sender_name', process.env.MAIL_SENDER_NAME || 'منصة الاستثمار العقاري');
        const useTls = String(getSystemSetting('mail_use_tls', 'true')).toLowerCase() === 'true';

        console.log(`[EMAIL] Sending email to: ${recipients.join(', ')} via ${server}:${portVal}`);

        // If credentials are not set, log code to console (mock mode for dev)
        if (!username || !password) {
            console.log(`========================================`);
            console.log(`[EMAIL MOCK] To: ${recipients.join(', ')}`);
            console.log(`[EMAIL MOCK] Subject: ${subject}`);
            console.log(`[EMAIL MOCK] Body: ${text_body}`);
            console.log(`========================================`);
            return true;
        }

        const transporter = nodemailer.createTransport({
            host: server,
            port: parseInt(portVal, 10),
            secure: parseInt(portVal, 10) === 465, // true for 465, false for other ports
            auth: {
                user: username,
                pass: password
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: recipients.join(', '),
            subject: subject,
            text: text_body,
            html: html_body
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EMAIL ERROR] Failed to send email:', error);
        return false;
    }
}

module.exports = { sendEmail };
