#!/usr/bin/env node
/* Encrypts cases.src.mjs → cases.enc.json (what case.html actually loads).
   Usage:  node encrypt-cases.mjs <password>
           CASES_PW='…' node encrypt-cases.mjs      (no password in argv/history)
           node encrypt-cases.mjs                   (prompts, needs a real terminal)
   Re-run after every copy edit in cases.src.mjs, or to rotate the password. */
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';

const ITERATIONS = 300000;

/* Password resolution, in order:
     1. argv            node encrypt-cases.mjs <password>
     2. CASES_PW env    CASES_PW='…' node encrypt-cases.mjs
     3. interactive prompt — ONLY when stdin is a TTY.
   The isTTY guard matters: without a terminal, readline's promise never settles,
   so node exits on an unsettled top-level await having written nothing and
   having printed no useful reason. That is what happens under any non-interactive
   runner, which is most of them. Fail loudly there instead. */
let password = process.argv[2] || process.env.CASES_PW;
if (!password && process.stdin.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Password: ');
  rl.close();
}
if (!password) {
  console.error('No password given — nothing written.');
  console.error('Pass it as an argument, set CASES_PW, or run from an interactive terminal.');
  process.exit(1);
}

const { default: cases } = await import('./cases.src.mjs');

const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString('base64');

/* One envelope per file: fresh salt + iv, same password and KDF settings, so
   the one gate form on case.html opens any of them. */
async function seal(plaintext, outName) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  writeFileSync(new URL('./' + outName, import.meta.url), JSON.stringify({
    v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS,
    salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data))
  }));
}

await seal(JSON.stringify(cases), 'cases.enc.json');
console.log(`cases.enc.json written — ${Object.keys(cases).length} case studies encrypted.`);

/* Slide-deck case studies: decks-src/<id>.html (gitignored plaintext) →
   deck-<id>.enc.json. case.html loads that file instead of cases.enc.json when
   ?id=<id> names a deck, and shows the decrypted page in a full-screen frame. */
if (existsSync(new URL('./decks-src/', import.meta.url))) {
  for (const f of readdirSync(new URL('./decks-src/', import.meta.url)).filter((n) => n.endsWith('.html'))) {
    const id = f.replace(/\.html$/, '');
    await seal(readFileSync(new URL('./decks-src/' + f, import.meta.url), 'utf8'), `deck-${id}.enc.json`);
    console.log(`deck-${id}.enc.json written.`);
  }
}
