const db = require('../db/database');

exports.getInvestments = async (req, res) => {
    try {
        const countryCode = req.query.country_code ? String(req.query.country_code).trim().toUpperCase() : null;
        const governorateId = req.query.governorate_id ? parseInt(req.query.governorate_id, 10) : null;
        const userId = req.user ? req.user.id : null;

        let query = `
            SELECT 
                i.*, 
                u.name as admin_name, 
                g.name as governorate_name,
                g.country_code as governorate_country_code,
                g.country_name as governorate_country_name,
                COUNT(DISTINCT ui.id) as investor_count,
                COALESCE(SUM(ui.amount), 0) as collected
            FROM investments i
            LEFT JOIN users u ON i.added_by = u.id
            LEFT JOIN governorates g ON i.governorate_id = g.id
            LEFT JOIN user_investments ui ON i.id = ui.investment_id AND ui.status = 'active'
            WHERE i.status = 'active'
        `;

        const params = [];

        if (countryCode) {
            query += " AND g.country_code = ?";
            params.push(countryCode);
        }
        if (governorateId) {
            query += " AND i.governorate_id = ?";
            params.push(governorateId);
        }

        query += " GROUP BY i.id ORDER BY i.created_at DESC";

        const investments = db.prepare(query).all(...params);

        investments.forEach(inv => {
            try {
                inv.image_gallery = inv.image_gallery_json ? JSON.parse(inv.image_gallery_json) : [];
            } catch (e) {
                inv.image_gallery = [];
            }
            if (!inv.image_url && inv.image_gallery.length > 0) {
                inv.image_url = inv.image_gallery[0];
            }
            
            if (userId) {
                const userPos = db.prepare(`
                    SELECT COUNT(*) as active_positions, COALESCE(SUM(amount), 0) as invested_amount 
                    FROM user_investments 
                    WHERE user_id = ? AND investment_id = ? AND status = 'active'
                `).get(userId, inv.id);
                
                inv.current_user_invested_amount = userPos.invested_amount;
                inv.current_user_can_cancel = userPos.active_positions > 0;
            } else {
                inv.current_user_invested_amount = 0.0;
                inv.current_user_can_cancel = false;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                investments,
                total: investments.length
            }
        });
    } catch (error) {
        console.error("Get investments error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

exports.createInvestment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, total_amount, min_investment, return_rate, duration, governorate_id } = req.body;

        if (!name || !total_amount || !min_investment || !return_rate || !duration || !governorate_id) {
            return res.status(400).json({ error: 'Missing required field', code: 'MISSING_FIELD' });
        }

        const publisher = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
        if (!publisher || publisher.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can publish investments', code: 'INVESTMENT_PUBLISH_FORBIDDEN' });
        }

        const insert = db.prepare(`
            INSERT INTO investments (
                name, description, total_amount, min_investment, return_rate, duration, 
                governorate_id, added_by, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
        `);

        const info = insert.run(
            name, 
            description || '', 
            total_amount, 
            min_investment, 
            return_rate, 
            duration, 
            governorate_id, 
            userId
        );

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الاستثمار بنجاح',
            data: { investment_id: info.lastInsertRowid }
        });
    } catch (error) {
        console.error("Create investment error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};
