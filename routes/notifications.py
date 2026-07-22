import sqlite3
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import os

def register_notifications_routes(app, ctx):
    get_db_connection = ctx.get_db_connection
    logger = ctx.logger
    
    notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

    @notifications_bp.route('', methods=['GET'])
    @jwt_required()
    def get_notifications():
        user_id = get_jwt_identity()
        try:
            conn = get_db_connection()
            rows = conn.execute(
                '''
                SELECT * FROM notifications
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
                ''', (user_id,)
            ).fetchall()
            conn.close()
            
            notifications = [dict(row) for row in rows]
            return jsonify({'success': True, 'notifications': notifications}), 200
        except Exception as e:
            logger.error(f"Error fetching notifications for user {user_id}: {e}")
            return jsonify({'error': 'حدث خطأ أثناء جلب الإشعارات', 'success': False}), 500

    @notifications_bp.route('/read/<int:notification_id>', methods=['POST'])
    @jwt_required()
    def mark_as_read(notification_id):
        user_id = get_jwt_identity()
        try:
            conn = get_db_connection()
            conn.execute(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                (notification_id, user_id)
            )
            conn.commit()
            conn.close()
            return jsonify({'success': True}), 200
        except Exception as e:
            logger.error(f"Error marking notification {notification_id} as read for user {user_id}: {e}")
            return jsonify({'error': 'حدث خطأ أثناء تحديث الإشعار', 'success': False}), 500

    @notifications_bp.route('/read-all', methods=['POST'])
    @jwt_required()
    def mark_all_as_read():
        user_id = get_jwt_identity()
        try:
            conn = get_db_connection()
            conn.execute(
                'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
                (user_id,)
            )
            conn.commit()
            conn.close()
            return jsonify({'success': True}), 200
        except Exception as e:
            logger.error(f"Error marking all notifications as read for user {user_id}: {e}")
            return jsonify({'error': 'حدث خطأ أثناء تحديث الإشعارات', 'success': False}), 500

    app.register_blueprint(notifications_bp)
