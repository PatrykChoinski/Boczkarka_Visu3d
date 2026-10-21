// Uzytkownicy logowania (#145): plik users.json (skroty scrypt hasel) obok config.json - nie trafia do repo.
//
//   node scripts/users.mjs set <Operator|Serwis|Admin> [--file users.json]   haslo z wejscia (jedna linia)
//   node scripts/users.mjs remove <uzytkownik> [--file users.json]
//   node scripts/users.mjs list [--file users.json]
//
// Przyklad (PowerShell): "haslo" | node scripts/users.mjs set Operator

import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { LEVELS, USERS_FILE, hashPassword, loadUsers, saveUsers } from '../src/server/auth.js';

const { values: opts, positionals: [cmd, name] } = parseArgs({ options: { file: { type: 'string' } }, allowPositionals: true });
const file = path.resolve(opts.file || USERS_FILE);
const users = loadUsers(file);

async function readPassword() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdin.isTTY ? process.stdout : undefined, terminal: false });
  if (process.stdin.isTTY) process.stdout.write(`Hasło dla ${name}: `);
  for await (const line of rl) { rl.close(); return line.replace(/\r$/, ''); }
  return '';
}

if (cmd === 'set' && LEVELS[name]) {
  const password = await readPassword();
  if (!password) { console.error('Puste hasło - bez zmian'); process.exit(1); }
  users[name] = { level: LEVELS[name], ...hashPassword(password) };
  saveUsers(file, users);
  console.log(`${name} (poziom ${LEVELS[name]}) zapisany w ${file}`);
} else if (cmd === 'remove' && name) {
  delete users[name];
  saveUsers(file, users);
  console.log(`${name} usunięty z ${file}`);
} else if (cmd === 'list') {
  for (const [n, u] of Object.entries(users)) console.log(`${n}: poziom ${u.level}`);
  if (!Object.keys(users).length) console.log(`Brak użytkowników (${file}) - logowanie wyłączone`);
} else {
  console.log('Użycie: node scripts/users.mjs set <Operator|Serwis|Admin> | remove <użytkownik> | list [--file users.json]');
  process.exit(1);
}
