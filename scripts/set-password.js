'use strict';

/*
  Ganti password user.
  Pemakaian:
    node scripts/set-password.js <username> <password-baru>
  Contoh:
    node scripts/set-password.js admin rahasia123
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Pemakaian: node scripts/set-password.js <username> <password-baru>');
  process.exit(1);
}

if (password.length < 6) {
  console.error('Password minimal 6 karakter.');
  process.exit(1);
}

const usersFile = path.join(__dirname, '..', 'data', 'users.json');
if (!fs.existsSync(usersFile)) {
  console.error('data/users.json belum ada. Jalankan server sekali dulu: npm start');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
const user = payload.users.find((u) => u.username.toLowerCase() === username.toLowerCase());

if (!user) {
  console.error('User tidak ditemukan. Akun tersedia: ' + payload.users.map((u) => u.username).join(', '));
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
user.salt = salt;
user.hash = crypto.scryptSync(password, salt, 64).toString('hex');

const tmp = usersFile + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
fs.renameSync(tmp, usersFile);

console.log('Password untuk "' + user.username + '" berhasil diperbarui.');
console.log('Restart server (npm start) agar session lama tidak berlaku.');
