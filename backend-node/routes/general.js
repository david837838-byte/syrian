const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/settings
router.get('/settings', (req, res) => {
    try {
        const settingsRows = db.prepare("SELECT * FROM system_settings").all();
        const settings = {};
        settingsRows.forEach(row => {
            let val = row.value;
            if (row.data_type === 'boolean') val = val === '1' || val === 'true';
            else if (row.data_type === 'integer' || row.data_type === 'number') val = Number(val);
            settings[row.key] = val;
        });

        const currencies = db.prepare("SELECT * FROM currencies WHERE is_active = 1").all();
        const networks = db.prepare("SELECT * FROM networks WHERE is_active = 1").all();

        res.json({
            success: true,
            data: { settings, currencies, networks }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/governorates
router.get('/governorates', (req, res) => {
    try {
        let query = "SELECT * FROM governorates WHERE is_active = 1";
        const params = [];
        if (req.query.country_code) {
            query += " AND country_code = ?";
            params.push(req.query.country_code);
        }
        
        const governorates = db.prepare(query).all(...params);
        
        res.json({
            success: true,
            data: {
                governorates,
                countries: [
                    {code: 'SY', name: 'سوريا'},
                    {code: 'SA', name: 'السعودية'},
                    {code: 'AE', name: 'الإمارات العربية المتحدة'},
                    {code: 'QA', name: 'قطر'},
                    {code: 'KW', name: 'الكويت'},
                    {code: 'BH', name: 'البحرين'},
                    {code: 'OM', name: 'عُمان'},
                    {code: 'JO', name: 'الأردن'},
                    {code: 'LB', name: 'لبنان'},
                    {code: 'IQ', name: 'العراق'},
                    {code: 'EG', name: 'مصر'}
                ],
                detected_country_code: 'SY'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/currencies
router.get('/currencies', (req, res) => {
    try {
        const currencies = db.prepare("SELECT * FROM currencies WHERE is_active = 1").all();
        res.json({
            success: true,
            data: { currencies }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/properties
router.get('/properties', (req, res) => {
    try {
        // Just return empty array if properties table doesn't exist or is not fully migrated
        let properties = [];
        try {
            properties = db.prepare("SELECT * FROM properties WHERE status = 'active'").all();
        } catch(e) {}
        
        res.json({
            success: true,
            data: { properties }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
