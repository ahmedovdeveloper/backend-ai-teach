// config/db.js
const mongoose = require('mongoose');
const connectDB = async (mongoUri) => {
try {
await mongoose.connect(mongoUri, {
// options handled internally by Mongoose 6+
});
console.log('MongoDB connected');
} catch (err) {
console.error('MongoDB connection error:', err.message);
process.exit(1);
}
};


module.exports = connectDB;