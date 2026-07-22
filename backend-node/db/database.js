const Database = require('better-sqlite3');
const path = require('path');

// Connect to the existing database in the parent folder
const dbPath = path.resolve(__dirname, '../../database.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

module.exports = db;
