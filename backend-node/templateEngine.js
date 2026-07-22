const fs = require('fs');
const path = require('path');

function renderTemplate() {
    const templatesDir = path.join(__dirname, '../templates');
    let content = fs.readFileSync(path.join(templatesDir, 'index.html'), 'utf-8');

    // Recursively replace includes
    let maxDepth = 5;
    while (maxDepth > 0 && /\{%\s*include\s*'([^']+)'\s*%\}/.test(content)) {
        content = content.replace(/\{%\s*include\s*'([^']+)'\s*%\}/g, (match, partialPath) => {
            try {
                return fs.readFileSync(path.join(templatesDir, partialPath), 'utf-8');
            } catch (e) {
                console.error(`Missing partial: ${partialPath}`);
                return `<!-- Missing: ${partialPath} -->`;
            }
        });
        maxDepth--;
    }

    // Replace url_for
    content = content.replace(/\{\{\s*url_for\('static',\s*filename='([^']+)'(?:,\s*v='([^']+)')?\)\s*\}\}/g, (match, filename, version) => {
        return version ? `/static/${filename}?v=${version}` : `/static/${filename}`;
    });
    content = content.replace(/\{\{\s*url_for\('favicon'\)\s*\}\}/g, '/favicon.ico');

    // Replace config
    content = content.replace(/\{\{\s*config\.get\('GOOGLE_CLIENT_ID',\s*''\)\s*\|\s*tojson\s*\}\}/g, '""');

    return content;
}

module.exports = { renderTemplate };
