import sqlite3
import os

db_path = os.environ.get('DATABASE_PATH', 'database.db')

conn = sqlite3.connect(db_path)
conn.executescript('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        section TEXT DEFAULT 'general',
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
''')

# Insert a test notification for the first user
user = conn.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1').fetchone()
if user:
    user_id = user[0]
    conn.execute('''
        INSERT INTO notifications (user_id, title, body, type, section)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, 'إيداع ناجح', 'تم تأكيد إيداعك بقيمة 500 USDT بنجاح. أصبحت جاهزة للاستثمار!', 'success', 'wallet'))
    conn.commit()
    print(f"Test notification inserted successfully for user {user_id}")
else:
    print("No users found to insert notification for.")

conn.close()
