#!/usr/bin/env node
/* Encrypts cases.src.mjs → cases.enc.json (what case.html actually loads).
   Usage:  node encrypt-cases.mjs <password>     (or run bare to be prompted)
   Re-run after every copy edit in cases.src.mjs, or to rotate the password. */
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const ITERATIONS = 300000;

let password = process.argv[2];
if (!password) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Password: ');
  rl.close();
}
if (!password) { console.error('No password given — nothing written.'); process.exit(1); }

const { default: cases } = await import('./cases.src.mjs');

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);
const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(cases)));

const b64 = (u8) => Buffer.from(u8).toString('base64');
writeFileSync(new URL('./cases.enc.json', import.meta.url), JSON.stringify({
  v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS,
  salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data))
}));
console.log(`cases.enc.json written — ${Object.keys(cases).length} case studies encrypted.`);
