from flask import render_template, send_from_directory


def register_site_routes(app, ctx):
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/manifest.webmanifest')
    def web_manifest():
        return send_from_directory('static', 'manifest.webmanifest')

    @app.route('/service-worker.js')
    def service_worker():
        response = send_from_directory('static', 'service-worker.js')
        response.headers['Content-Type'] = 'application/javascript'
        response.headers['Service-Worker-Allowed'] = '/'
        response.headers['Cache-Control'] = 'no-cache'
        return response

    @app.route('/static/<path:filename>')
    def static_files(filename):
        return send_from_directory('static', filename)

    @app.route('/uploads/<path:filename>')
    def uploaded_files(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
