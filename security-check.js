const fs = require('fs');
const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));

if (!Array.isArray(users) || !users[0] || !users[0].passwordHash) {
  console.error('FAIL: stored password is not hashed');
  process.exit(1);
}

console.log('PASS');
