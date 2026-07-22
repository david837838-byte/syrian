require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Keep compatibility with the existing environment naming used in the project.
process.env.JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'jwt-secret-key-change-in-production';

const app = express();
const PORT = process.env.PORT || 2000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    if (req.url.startsWith('/api/api/')) {
        req.url = req.url.substring(4);
    }
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});



// Mount Routes
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallets');
const investmentRoutes = require('./routes/investments');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');
const transactionRoutes = require('./routes/transactions');
const messagesRoutes = require('./routes/messages');

const authMiddleware = require('./middlewares/authMiddleware');
const adminMiddleware = require('./middlewares/adminMiddleware');

app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/api/settings', authMiddleware, adminMiddleware, settingsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/messages', messagesRoutes);

// General initialization routes (settings, governorates, currencies, etc.)
const generalRoutes = require('./routes/general');
const optionalAuthMiddleware = require('./middlewares/optionalAuthMiddleware');
app.use('/api', optionalAuthMiddleware, generalRoutes);


// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Node.js backend is running!' });
});

// Frontend Serving
const path = require('path');
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/manifest.webmanifest', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/manifest.webmanifest'));
});

app.get('/service-worker.js', (req, res) => {
    res.set('Service-Worker-Allowed', '/');
    res.sendFile(path.join(__dirname, '../static/service-worker.js'));
});

// Catch-all for SPA / index.html
const { renderTemplate } = require('./templateEngine');
app.use((req, res, next) => {
    // API calls should not return HTML
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // Only respond to GET requests with the template
    if (req.method !== 'GET') {
        return next();
    }
    res.send(renderTemplate());
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
