const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db/database');

const backupsDir = path.resolve(__dirname, '../../backups');
const dbPath = path.resolve(__dirname, '../../database.db');

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

// Helper to get system setting
function getSystemSetting(key, defaultValue) {
    try {
        const row = db.prepare("SELECT value, data_type FROM system_settings WHERE key = ?").get(key);
        if (!row) return defaultValue;
        let val = row.value;
        if (row.data_type === 'boolean') return val === '1' || val === 'true';
        if (row.data_type === 'integer' || row.data_type === 'number') return Number(val);
        return val;
    } catch(e) {
        return defaultValue;
    }
}

// Helper to list backup files
function getBackupFiles() {
    if (!fs.existsSync(backupsDir)) return [];
    
    return fs.readdirSync(backupsDir)
        .filter(name => name.toLowerCase().endsWith('.db'))
        .map(name => {
            const filePath = path.join(backupsDir, name);
            const stat = fs.statSync(filePath);
            const date = new Date(stat.mtime);
            const formattedDate = date.toISOString().replace('T', ' ').substring(0, 19);
            return {
                filename: name,
                size_bytes: stat.size,
                created_at: formattedDate
            };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Helper to cleanup old backups
function cleanupOldBackups(maxCount) {
    try {
        const count = Math.max(1, parseInt(maxCount) || 10);
        const backups = getBackupFiles();
        if (backups.length > count) {
            for (let i = count; i < backups.length; i++) {
                const filePath = path.join(backupsDir, backups[i].filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }
    } catch (e) {
        console.error("Cleanup backups error:", e);
    }
}

// 1. List Backups
exports.listBackups = async (req, res) => {
    try {
        const backups = getBackupFiles();
        res.status(200).json({
            success: true,
            data: { backups }
        });
    } catch (error) {
        console.error("List backups error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

// 2. Create Backup
exports.createBackup = async (req, res) => {
    try {
        const retentionCount = getSystemSetting('backup_retention_count', 10);
        
        const timestamp = new Date().toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '_')
            .substring(0, 15);
        const filename = `platform_backup_${timestamp}.db`;
        const backupPath = path.join(backupsDir, filename);

        // Perform online backup using better-sqlite3 backup feature
        await db.backup(backupPath);
        
        cleanupOldBackups(retentionCount);

        res.status(201).json({
            success: true,
            message: 'تم إنشاء النسخة الاحتياطية بنجاح',
            data: {
                filename,
                backups: getBackupFiles()
            }
        });
    } catch (error) {
        console.error("Create backup error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

// 3. Download Backup
exports.downloadBackup = async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const backupPath = path.join(backupsDir, filename);

        if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
            return res.status(404).json({ error: 'Backup not found', code: 'BACKUP_NOT_FOUND' });
        }

        res.download(backupPath, filename);
    } catch (error) {
        console.error("Download backup error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};

// 4. Restore Backup
exports.restoreBackup = async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ error: 'Backup filename is required', code: 'MISSING_BACKUP_FILENAME' });
        }

        const safeFilename = path.basename(filename);
        const backupPath = path.join(backupsDir, safeFilename);

        if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
            return res.status(404).json({ error: 'Backup not found', code: 'BACKUP_NOT_FOUND' });
        }

        // Validate backup tables
        let validationDb;
        try {
            validationDb = new Database(backupPath);
            const tables = validationDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
            const requiredTables = ['users', 'system_settings', 'transactions', 'investments'];
            const isValid = requiredTables.every(t => tables.includes(t));
            if (!isValid) {
                validationDb.close();
                return res.status(400).json({ error: 'Backup structure is invalid', code: 'INVALID_BACKUP_FILE' });
            }
        } catch (e) {
            if (validationDb) validationDb.close();
            return res.status(400).json({ error: 'Backup structure is invalid', code: 'INVALID_BACKUP_FILE' });
        } finally {
            if (validationDb) validationDb.close();
        }

        const retentionCount = getSystemSetting('backup_retention_count', 10);
        const autoBackupBeforeRestore = getSystemSetting('backup_auto_create_before_restore', true);

        let preRestoreBackup = null;
        if (autoBackupBeforeRestore) {
            const timestamp = new Date().toISOString()
                .replace(/[-:]/g, '')
                .replace('T', '_')
                .substring(0, 15);
            preRestoreBackup = `pre_restore_backup_${timestamp}.db`;
            const preRestorePath = path.join(backupsDir, preRestoreBackup);
            await db.backup(preRestorePath);
        }

        // Perform restore by backing up the selected file into the active database path
        const sourceDb = new Database(backupPath);
        await sourceDb.backup(dbPath);
        sourceDb.close();

        cleanupOldBackups(retentionCount);

        res.status(200).json({
            success: true,
            message: 'تمت استعادة النسخة الاحتياطية بنجاح',
            data: {
                filename: safeFilename,
                pre_restore_backup: preRestoreBackup
            }
        });
    } catch (error) {
        console.error("Restore backup error:", error);
        res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
};
