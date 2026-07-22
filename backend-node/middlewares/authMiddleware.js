const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token', code: 'UNAUTHORIZED' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = decoded; // { id, role }
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token expired or invalid', code: 'UNAUTHORIZED' });
    }
};
