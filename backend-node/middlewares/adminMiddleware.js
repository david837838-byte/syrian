module.exports = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'غير مصرح لك بالوصول إلى هذا القسم الإداري',
            code: 'FORBIDDEN'
        });
    }
    next();
};
