const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// Helpers
function findSupportAdmin(database) {
    return database.prepare("SELECT id, name, public_user_id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id ASC LIMIT 1").get();
}

function getSystemSetting(database, key, defaultValue) {
    const row = database.prepare("SELECT value, data_type FROM system_settings WHERE key = ?").get(key);
    if (!row) return defaultValue;
    let val = row.value;
    if (row.data_type === 'boolean') return val === '1' || val === 'true';
    return val !== null && val !== undefined ? val : defaultValue;
}

function buildCallPayload(database, callId) {
    const row = database.prepare(`
        SELECT 
            cs.id, cs.conversation_id, cs.initiated_by, cs.call_type, cs.status,
            cs.created_at, cs.accepted_at, cs.ended_at, cs.ended_by, cs.last_signal_at,
            initiator.name AS initiator_name,
            initiator.public_user_id AS initiator_public_user_id,
            ended_user.name AS ended_by_name
        FROM call_sessions cs
        JOIN users initiator ON initiator.id = cs.initiated_by
        LEFT JOIN users ended_user ON ended_user.id = cs.ended_by
        WHERE cs.id = ?
    `).get(callId);
    return row ? row : null;
}

function getActiveCall(database, conversationId) {
    const row = database.prepare("SELECT id FROM call_sessions WHERE conversation_id = ? AND status IN ('ringing', 'active') ORDER BY id DESC LIMIT 1").get(conversationId);
    return row ? buildCallPayload(database, row.id) : null;
}

function buildConversationPayload(database, conversationId, userId) {
    const conversation = database.prepare("SELECT id, kind, title, created_at, updated_at FROM conversations WHERE id = ?").get(conversationId);
    if (!conversation) return null;
    
    const participants = database.prepare(`
        SELECT u.id, u.name, u.public_user_id, u.role
        FROM conversation_participants cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.conversation_id = ?
        ORDER BY u.role DESC, u.name ASC
    `).all(conversationId);

    const last_message = database.prepare(`
        SELECT 
            m.id, m.body, m.message_type, m.message_origin, m.attachment_url, m.read_at, m.created_at,
            u.name AS sender_name
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
    `).get(conversationId);

    const unread_count = database.prepare(`
        SELECT COUNT(*) AS total
        FROM messages
        WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL
    `).get(conversationId, userId);

    const other_participants = participants.filter(p => p.id !== userId);
    const counterpart = other_participants[0] || participants[0] || null;

    return {
        ...conversation,
        participants,
        counterpart,
        last_message: last_message || null,
        unread_count: unread_count ? unread_count.total : 0,
        active_call: getActiveCall(database, conversationId)
    };
}

function ensureParticipant(database, conversationId, userId) {
    const row = database.prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?").get(conversationId, userId);
    return !!row;
}

function ensureCallAccess(database, callId, userId) {
    const row = database.prepare(`
        SELECT cs.id, cs.conversation_id, cs.status
        FROM call_sessions cs
        JOIN conversation_participants cp ON cp.conversation_id = cs.conversation_id
        WHERE cs.id = ? AND cp.user_id = ?
        LIMIT 1
    `).get(callId, userId);
    return row ? row : null;
}

function buildSupportAiReply(database, body, messageType) {
    const aiName = (getSystemSetting(database, 'support_ai_name', 'مساعد المنصة الذكي') || 'مساعد المنصة الذكي').trim();
    const escalationNotice = (getSystemSetting(database, 'support_ai_escalation_notice', 'إذا كانت الحالة تحتاج متابعة أعمق فسيكمل فريق الإدارة الرد داخل نفس المحادثة.') || '').trim();
    const text = String(body || '').trim().toLowerCase();

    if ((messageType === 'image' || messageType === 'audio') && !text) {
        return {
            body: `${aiName}: تم استلام الملف داخل المحادثة. إذا كان يحتاج مراجعة تفصيلية فسيكمل الأدمن المتابعة هنا.`,
            should_escalate: true
        };
    }

    const categories = [
        [
            ['ايداع', 'إيداع', 'deposit', 'tx hash', 'وصل المبلغ', 'تحويل للمحفظة'],
            'تحقق من العملة والشبكة والعنوان أولًا، ثم راقب حالة العملية داخل قسم المعاملات. وعند تفعيل التحقق on-chain يظهر الإيداع بعد المطابقة على الشبكة.'
        ],
        [
            ['سحب', 'withdraw', 'طلب السحب', 'كود السحب'],
            'تأكد من الرصيد ثم اطلب كود السحب من البريد وأدخل العنوان الصحيح. بعد التأكيد يظهر الطلب للمراجعة، وخلال 24 ساعة تتم متابعة التحويل حسب حالته.'
        ],
        [
            ['محفظة', 'wallet', 'عنوان', 'qr', 'شبكة', 'trc20', 'erc20', 'bep20', 'btc'],
            'من قسم المحفظة اختر العملة ثم الشبكة، وبعدها اربط العنوان أو أنشئ المحفظة المطلوبة. إذا لم يظهر العنوان فغالبًا لا توجد قناة استقبال مفعلة لهذه العملة أو الشبكة.'
        ],
        [
            ['استثمار', 'مشروع', 'invest', 'استثمر', 'رصيد غير كافي', 'الغاء الاستثمار'],
            'عند الضغط على الاستثمار يفحص النظام الرصيد أولًا، وإذا كان كافيًا يخصم المبلغ وتُسجل العملية مباشرة. ويمكنك مراجعة تفاصيل المشروع والعائد والمدة قبل التأكيد.'
        ],
        [
            ['kyc', 'توثيق', 'وثائق', 'هوية', 'جواز', 'verification'],
            'حالة التوثيق تظهر في الحساب. ارفع الوثائق بصورة واضحة ومطابقة لبيانات الحساب، وبعد الإرسال تبقى الحالة قيد المراجعة حتى يعتمدها الأدمن أو يطلب إعادة الرفع.'
        ],
        [
            ['دخول', 'login', 'تسجيل الدخول', 'كلمة مرور', 'password', 'نسيت كلمة المرور', 'google'],
            'إذا كانت المشكلة في الدخول فتحقق من البريد وكلمة المرور أولًا، واستخدم استعادة كلمة المرور عند الحاجة. وإذا كان الحساب غير موثق فسيطلب النظام إكمال التحقق قبل بعض الإجراءات.'
        ],
        [
            ['رسائل', 'message', 'محادثة', 'اتصال', 'call', 'mic', 'microphone', 'صوت', 'تسجيل صوتي'],
            'في قسم الرسائل يمكنك بدء محادثة عبر رقم الحساب العام، وإرسال نص أو صورة أو صوت، كما يمكن قبول أو إنهاء الاتصال من نفس الواجهة بعد السماح للمتصفح بالميكروفون.'
        ]
    ];

    const difficultKeywords = [
        'error', '500', 'internal server', 'لا يعمل', 'مشكلة', 'مشكله', 'تعذر',
        'فشل', 'مرفوض', 'محظور', 'اختفى', 'مفقود', 'bug', 'ثغرة', 'اختراق'
    ];

    let matchedReply = '';
    for (const [keywords, reply] of categories) {
        if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
            matchedReply = reply;
            break;
        }
    }

    let shouldEscalate = difficultKeywords.some(keyword => text.includes(keyword)) || text.length >= 260;
    if (!matchedReply) {
        matchedReply = 'استلمت رسالتك، وأقرب خطوة الآن هي مراجعة القسم المرتبط بالمشكلة ثم إعادة المحاولة بخطوات مرتبة. وإذا بقيت الحالة غير واضحة فسيتم تصعيدها للإدارة.';
        shouldEscalate = true;
    }

    if (shouldEscalate && escalationNotice) {
        matchedReply = `${matchedReply} ${escalationNotice}`;
    } else if (!shouldEscalate) {
        matchedReply = `${matchedReply} وإذا احتجت متابعة بشرية فالإدارة موجودة داخل نفس المحادثة.`;
    }

    return {
        body: `${aiName}: ${matchedReply}`,
        should_escalate: shouldEscalate
    };
}

function createSupportAiMessage(database, conversationId, adminUserId, body, messageType) {
    if (!getSystemSetting(database, 'support_ai_enabled', true)) {
        return null;
    }
    const reply = buildSupportAiReply(database, body, messageType);
    const info = database.prepare(`
        INSERT INTO messages (conversation_id, sender_id, body, message_type, message_origin, attachment_url)
        VALUES (?, ?, ?, 'text', 'assistant', NULL)
    `).run(conversationId, adminUserId, reply.body);
    
    database.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
    return info.lastInsertRowid;
}

// Controller Actions
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const rows = db.prepare(`
            SELECT c.id
            FROM conversations c
            JOIN conversation_participants cp ON cp.conversation_id = c.id
            WHERE cp.user_id = ?
            ORDER BY c.updated_at DESC, c.id DESC
        `).all(userId);
        
        const conversations = rows.map(row => buildConversationPayload(db, row.id, userId)).filter(Boolean);
        res.json({ success: true, data: { conversations } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.startConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { target_type, recipient_public_id } = req.body;
        const targetType = String(target_type || 'support').trim().toLowerCase();

        let counterpartId;
        let title;
        let kind;

        if (targetType === 'support') {
            const admin = findSupportAdmin(db);
            if (!admin) {
                return res.status(404).json({ error: 'Support admin not found', code: 'SUPPORT_NOT_AVAILABLE' });
            }
            counterpartId = admin.id;
            title = 'الدعم والمساعدة';
            kind = 'support';
        } else {
            const publicUserId = String(recipient_public_id || '').trim();
            if (!publicUserId) {
                return res.status(400).json({ error: 'Recipient public user ID is required', code: 'MISSING_RECIPIENT' });
            }
            const isNumeric = /^\d+$/.test(publicUserId);
            const query = `
                SELECT id, name, public_user_id, role
                FROM users
                WHERE (public_user_id = ? ${isNumeric ? 'OR id = ?' : ''}) AND is_active = 1
            `;
            const queryParams = isNumeric ? [publicUserId, Number(publicUserId)] : [publicUserId];
            const counterpart = db.prepare(query).get(...queryParams);
            if (!counterpart) {
                return res.status(404).json({ error: 'Recipient not found', code: 'RECIPIENT_NOT_FOUND' });
            }
            if (counterpart.id === userId) {
                return res.status(400).json({ error: 'You cannot message yourself', code: 'SELF_MESSAGE_NOT_ALLOWED' });
            }
            counterpartId = counterpart.id;
            title = `محادثة مع ${counterpart.name}`;
            kind = 'direct';
        }

        // Check existing conversation
        const existing = db.prepare(`
            SELECT c.id
            FROM conversations c
            JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
            JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?
            WHERE c.kind = ?
            LIMIT 1
        `).get(userId, counterpartId, kind);

        if (existing) {
            const payload = buildConversationPayload(db, existing.id, userId);
            return res.json({ success: true, data: { conversation: payload } });
        }

        // Create new conversation
        const info = db.prepare(`
            INSERT INTO conversations (kind, title, created_by, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(kind, title, userId);
        const conversationId = info.lastInsertRowid;

        db.prepare(`
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (?, ?)
        `).run(conversationId, userId);

        db.prepare(`
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (?, ?)
        `).run(conversationId, counterpartId);

        const payload = buildConversationPayload(db, conversationId, userId);
        res.status(201).json({
            success: true,
            message: 'تم إنشاء المحادثة بنجاح',
            data: { conversation: payload }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getConversationMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.conversationId);

        if (!ensureParticipant(db, conversationId, userId)) {
            return res.status(403).json({ error: 'Conversation not accessible', code: 'CONVERSATION_FORBIDDEN' });
        }

        // Mark incoming messages as read
        db.prepare(`
            UPDATE messages
            SET read_at = CURRENT_TIMESTAMP
            WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL
        `).run(conversationId, userId);

        const conversation = buildConversationPayload(db, conversationId, userId);
        const messages = db.prepare(`
            SELECT
                m.id, m.body, m.message_type, m.message_origin, m.attachment_url, m.read_at, m.created_at, m.sender_id,
                u.name AS sender_name,
                u.public_user_id AS sender_public_user_id
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC, m.id ASC
        `).all(conversationId);

        res.json({
            success: true,
            data: {
                conversation,
                messages
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId);
        const conversationId = Number(req.params.conversationId);
        const { body, message_type, attachment_url } = req.body;
        const messageType = String(message_type || 'text').trim().toLowerCase();

        if (!['text', 'image', 'audio'].includes(messageType)) {
            return res.status(400).json({ error: 'Invalid message type', code: 'INVALID_MESSAGE_TYPE' });
        }
        if (!body && !attachment_url) {
            return res.status(400).json({ error: 'Message body or attachment required', code: 'EMPTY_MESSAGE' });
        }

        if (!ensureParticipant(db, conversationId, userId)) {
            return res.status(403).json({ error: 'Conversation not accessible', code: 'CONVERSATION_FORBIDDEN' });
        }

        const conversation = db.prepare("SELECT id, kind FROM conversations WHERE id = ?").get(conversationId);

        const info = db.prepare(`
            INSERT INTO messages (conversation_id, sender_id, body, message_type, message_origin, attachment_url)
            VALUES (?, ?, ?, ?, 'user', ?)
        `).run(conversationId, userId, body, messageType, attachment_url || null);
        const messageId = info.lastInsertRowid;

        let assistantMessageId = null;
        if (conversation && conversation.kind === 'support' && user.role !== 'admin') {
            const supportAdmin = findSupportAdmin(db);
            if (supportAdmin) {
                assistantMessageId = createSupportAiMessage(db, conversationId, supportAdmin.id, body, messageType);
            }
        }

        db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);

        const message = db.prepare(`
            SELECT
                m.id, m.body, m.message_type, m.message_origin, m.attachment_url, m.read_at, m.created_at, m.sender_id,
                u.name AS sender_name,
                u.public_user_id AS sender_public_user_id
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.id = ?
        `).get(messageId);

        let assistantMessage = null;
        if (assistantMessageId) {
            assistantMessage = db.prepare(`
                SELECT
                    m.id, m.body, m.message_type, m.message_origin, m.attachment_url, m.read_at, m.created_at, m.sender_id,
                    u.name AS sender_name,
                    u.public_user_id AS sender_public_user_id
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.id = ?
            `).get(assistantMessageId);
        }

        const payload = { message_item: message };
        if (assistantMessage) {
            payload.assistant_message_item = assistantMessage;
        }

        res.status(201).json({
            success: true,
            message: 'تم إرسال الرسالة',
            data: payload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = Number(req.params.messageId);

        const message = db.prepare("SELECT id, conversation_id, sender_id FROM messages WHERE id = ?").get(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found', code: 'MESSAGE_NOT_FOUND' });
        }

        if (!ensureParticipant(db, message.conversation_id, userId)) {
            return res.status(403).json({ error: 'Conversation not accessible', code: 'CONVERSATION_FORBIDDEN' });
        }

        if (Number(message.sender_id) !== Number(userId)) {
            return res.status(403).json({ error: 'Only the sender can delete this message for everyone', code: 'DELETE_NOT_ALLOWED' });
        }

        db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
        db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(message.conversation_id);

        res.json({ success: true, message: 'تم حذف الرسالة لدى الجميع' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.startCall = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = Number(req.params.conversationId);
        const { call_type } = req.body;
        const callType = String(call_type || 'audio').trim().toLowerCase();

        if (callType !== 'audio') {
            return res.status(400).json({ error: 'Only audio calls are supported', code: 'UNSUPPORTED_CALL_TYPE' });
        }

        if (!ensureParticipant(db, conversationId, userId)) {
            return res.status(403).json({ error: 'Conversation not accessible', code: 'CONVERSATION_FORBIDDEN' });
        }

        const existing = db.prepare(`
            SELECT id FROM call_sessions WHERE conversation_id = ? AND status IN ('ringing', 'active') ORDER BY id DESC LIMIT 1
        `).get(conversationId);
        if (existing) {
            const payload = buildCallPayload(db, existing.id);
            return res.json({ success: true, data: { call: payload } });
        }

        const activeCall = db.prepare(`
            SELECT cs.id
            FROM call_sessions cs
            JOIN conversation_participants cp ON cp.conversation_id = cs.conversation_id
            WHERE cp.user_id = ? AND cs.status IN ('ringing', 'active')
            ORDER BY cs.id DESC LIMIT 1
        `).get(userId);
        if (activeCall) {
            const payload = buildCallPayload(db, activeCall.id);
            return res.status(409).json({
                error: 'An active call already exists for this user',
                code: 'CALL_ALREADY_ACTIVE',
                data: { call: payload }
            });
        }

        const info = db.prepare(`
            INSERT INTO call_sessions (conversation_id, initiated_by, call_type, status, last_signal_at)
            VALUES (?, ?, ?, 'ringing', CURRENT_TIMESTAMP)
        `).run(conversationId, userId, callType);
        const callId = info.lastInsertRowid;

        db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);

        const payload = buildCallPayload(db, callId);
        res.status(201).json({ success: true, message: 'تم بدء الاتصال', data: { call: payload } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getCall = async (req, res) => {
    try {
        const userId = req.user.id;
        const callId = Number(req.params.callId);

        if (!ensureCallAccess(db, callId, userId)) {
            return res.status(403).json({ error: 'Call not accessible', code: 'CALL_FORBIDDEN' });
        }

        const payload = buildCallPayload(db, callId);
        res.json({ success: true, data: { call: payload } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.actOnCall = async (req, res) => {
    try {
        const userId = req.user.id;
        const callId = Number(req.params.callId);
        const { action } = req.body;
        const act = String(action || '').trim().toLowerCase();

        if (!['accept', 'reject', 'end'].includes(act)) {
            return res.status(400).json({ error: 'Invalid call action', code: 'INVALID_CALL_ACTION' });
        }

        if (!ensureCallAccess(db, callId, userId)) {
            return res.status(403).json({ error: 'Call not accessible', code: 'CALL_FORBIDDEN' });
        }

        const current = buildCallPayload(db, callId);
        if (!current) {
            return res.status(404).json({ error: 'Call not found', code: 'CALL_NOT_FOUND' });
        }

        if (act === 'accept') {
            if (current.status !== 'ringing') {
                return res.status(409).json({ error: 'Call is no longer ringing', code: 'CALL_NOT_RINGING' });
            }
            db.prepare(`
                UPDATE call_sessions SET status = 'active', accepted_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(callId);
        } else if (act === 'reject') {
            if (!['ringing', 'active'].includes(current.status)) {
                return res.status(409).json({ error: 'Call already closed', code: 'CALL_ALREADY_CLOSED' });
            }
            db.prepare(`
                UPDATE call_sessions SET status = 'rejected', ended_at = CURRENT_TIMESTAMP, ended_by = ? WHERE id = ?
            `).run(userId, callId);
        } else { // end
            if (!['ringing', 'active'].includes(current.status)) {
                return res.status(409).json({ error: 'Call already closed', code: 'CALL_ALREADY_CLOSED' });
            }
            db.prepare(`
                UPDATE call_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP, ended_by = ? WHERE id = ?
            `).run(userId, callId);
        }

        const payload = buildCallPayload(db, callId);
        res.json({ success: true, message: 'تم تحديث حالة الاتصال', data: { call: payload } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.addCallSignal = async (req, res) => {
    try {
        const userId = req.user.id;
        const callId = Number(req.params.callId);
        const { signal_type, payload } = req.body;
        const sigType = String(signal_type || '').trim().toLowerCase();

        if (!['offer', 'answer', 'ice-candidate'].includes(sigType)) {
            return res.status(400).json({ error: 'Invalid signal type', code: 'INVALID_SIGNAL_TYPE' });
        }

        if (!ensureCallAccess(db, callId, userId)) {
            return res.status(403).json({ error: 'Call not accessible', code: 'CALL_FORBIDDEN' });
        }

        const current = buildCallPayload(db, callId);
        if (!current || !['ringing', 'active'].includes(current.status)) {
            return res.status(409).json({ error: 'Call is not active', code: 'CALL_NOT_ACTIVE' });
        }

        const info = db.prepare(`
            INSERT INTO call_signals (call_id, sender_id, signal_type, payload)
            VALUES (?, ?, ?, ?)
        `).run(callId, userId, sigType, JSON.stringify(payload));
        const signalId = info.lastInsertRowid;

        db.prepare("UPDATE call_sessions SET last_signal_at = CURRENT_TIMESTAMP WHERE id = ?").run(callId);

        res.status(201).json({ success: true, data: { signal_id: signalId } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getCallSignals = async (req, res) => {
    try {
        const userId = req.user.id;
        const callId = Number(req.params.callId);
        const afterId = Number(req.query.after_id || 0);

        if (!ensureCallAccess(db, callId, userId)) {
            return res.status(403).json({ error: 'Call not accessible', code: 'CALL_FORBIDDEN' });
        }

        const signals = db.prepare(`
            SELECT id, call_id, sender_id, signal_type, payload, created_at
            FROM call_signals
            WHERE call_id = ? AND id > ?
            ORDER BY id ASC
        `).all(callId, afterId);

        const payload = buildCallPayload(db, callId);

        const items = signals.map(row => {
            let parsedPayload = null;
            try {
                parsedPayload = JSON.parse(row.payload || 'null');
            } catch (e) {}
            return {
                ...row,
                payload: parsedPayload
            };
        });

        res.json({ success: true, data: { call: payload, signals: items } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getRtcConfig = async (req, res) => {
    try {
        const stunUrlsStr = getSystemSetting(db, 'rtc_stun_urls', 'stun:stun.l.google.com:19302');
        const turnEnabled = !!getSystemSetting(db, 'rtc_turn_enabled', false);
        const turnUrl = (getSystemSetting(db, 'rtc_turn_url', '') || '').trim();

        const stun_urls = String(stunUrlsStr || '').replace(/,/g, '\n').split('\n').map(x => x.trim()).filter(Boolean);

        res.json({
            success: true,
            data: {
                stun_urls: stun_urls.length ? stun_urls : ['stun:stun.l.google.com:19302'],
                turn_enabled: turnEnabled,
                turn_configured: !!turnUrl
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Multer integration for routes
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || (file.mimetype.startsWith('image/') ? '.jpg' : '.webm');
        const generatedName = `${Date.now()}_${uuidv4().substring(0, 10)}${ext}`;
        cb(null, generatedName);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const mime = file.mimetype.toLowerCase();
        if (mime.startsWith('image/') || mime.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and audio files are supported'));
        }
    }
});

exports.uploadMiddleware = upload.single('file');

exports.uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided', code: 'NO_FILE' });
        }

        const mime = req.file.mimetype.toLowerCase();
        let messageType = 'image';
        if (mime.startsWith('audio/')) {
            messageType = 'audio';
        }

        res.status(201).json({
            success: true,
            message: 'تم رفع الملف بنجاح',
            data: {
                attachment_url: `/uploads/${req.file.filename}`,
                message_type: messageType
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
