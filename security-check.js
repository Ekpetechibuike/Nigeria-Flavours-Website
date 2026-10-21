// Quick safety check: private data must not be tracked by git or served by the site.
const { execSync } = require('child_process');
const fs = require('fs');

const failures = [];

const privatePatterns = [/(^|\/)users\.json$/, /(^|\/)orders\.json$/, /(^|\/)reservations\.json$/, /^assets\/user-images\//, /(^|\/)\.env$/];
try {
  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  const leaked = tracked.filter((f) => privatePatterns.some((re) => re.test(f)));
  if (leaked.length) failures.push(`Private files are tracked by git: ${leaked.slice(0, 5).join(', ')}${leaked.length > 5 ? ', ...' : ''}`);
} catch (e) {
  console.log('(skipped git check: not a git checkout)');
}

const ignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
['users.json', 'orders.json', 'reservations.json', 'assets/user-images/', '.env'].forEach((entry) => {
  if (!ignore.includes(entry)) failures.push(`.gitignore is missing "${entry}"`);
});

const server = fs.readFileSync('server/server.js', 'utf8');
if (/express\.static\(\s*path\.join\(__dirname,\s*'\.\.'\)\s*\)/.test(server)) failures.push('server serves the whole repo root as static files');
if (/console\.log\([^)]*password/i.test(server)) failures.push('server logs passwords');

if (failures.length) {
  failures.forEach((f) => console.error('FAIL:', f));
  process.exit(1);
}
console.log('PASS');
