const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const webRoot = path.join(projectRoot, 'www');

const rootFiles = [
  'index.html',
  'login.html',
  'register.html',
  'profile.html',
  'reservations-board.html',
  'styles.css',
  'script.js',
  'auth.js',
  'auth-handlers.js',
  'pwa.js',
  'service-worker.js',
  'manifest.webmanifest',
  'favicon.ico',
  'favicon.png',
  'users.json'
];

function copyFile(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(webRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.rmSync(webRoot, { recursive: true, force: true });
fs.mkdirSync(webRoot, { recursive: true });
rootFiles.forEach(copyFile);

const assetsSource = path.join(projectRoot, 'assets', 'images');
const assetsDestination = path.join(webRoot, 'assets', 'images');
fs.cpSync(assetsSource, assetsDestination, { recursive: true });

const apiBase = process.env.CAPACITOR_API_URL || 'https://restaurant-website-trkn.onrender.com/api';
fs.writeFileSync(
  path.join(webRoot, 'app-config.js'),
  `window.APP_API_BASE = ${JSON.stringify(apiBase)};\n`,
  'utf8'
);

console.log(`Prepared Capacitor web assets in ${webRoot}`);
if (apiBase) {
  console.log(`Native API base: ${apiBase}`);
} else {
  console.log('Native API base is empty; set CAPACITOR_API_URL before building.');
}