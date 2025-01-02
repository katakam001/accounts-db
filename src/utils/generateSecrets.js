const crypto = require('crypto');

// Generate a random secret key
const secret = crypto.randomBytes(64).toString('hex');
const refreshSecret = crypto.randomBytes(64).toString('hex');

console.log('Secret:', secret);
console.log('Refresh Secret:', refreshSecret);
