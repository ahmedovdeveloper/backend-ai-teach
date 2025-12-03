// middleware/auth.js
const jwt = require('jsonwebtoken');


module.exports = (req, res, next) => {
// check Authorization header or cookie
const authHeader = req.headers.authorization;
let token = null;
if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
else if (req.cookies && req.cookies.token) token = req.cookies.token;


if (!token) return res.status(401).json({ message: 'No token, authorization denied' });


try {
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = { id: decoded.id, role: decoded.role };
next();
} catch (err) {
return res.status(401).json({ message: 'Token is not valid' });
}
};