// Encrypts the IFEN page with the password in private/ifen-password.txt:
//   private/<slug>.html    -> src/data/<slug>.enc.json    (page content: ifen, ifen-embodied-videos, ...)
//   private/files/<name>   -> public/ifen-files/<name>.enc (PDFs linked from the page)
// Only the encrypted results go to GitHub; the private folder stays on this Mac (see .gitignore).
// AES-GCM 256 with one key derived by PBKDF2-SHA256, matching the decryption on /ifen.
// A file is linked in ifen.html as: <a data-enc-file="<name>" href="#">...</a>
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { webcrypto as crypto, createHash } from 'node:crypto';

const root = new URL('..', import.meta.url);
const at = (p) => new URL(p, root);
const password = readFileSync(at('private/ifen-password.txt'), 'utf8').trim();
if (!password) throw new Error('private/ifen-password.txt is empty');

const iterations = 600000;
// The salt is kept (it is not secret) so the key stays the same between runs and the large PDFs
// only need encrypting again when the PDF or the password changes.
const saltFile = at('private/ifen-salt.txt');
if (!existsSync(saltFile)) writeFileSync(saltFile, Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64'));
const salt = new Uint8Array(Buffer.from(readFileSync(saltFile, 'utf8').trim(), 'base64'));
const keyId = createHash('sha256').update(password + '|' + readFileSync(saltFile, 'utf8').trim()).digest('hex');
const keyIdFile = at('private/ifen-files-key.txt');
const sameKey = existsSync(keyIdFile) && readFileSync(keyIdFile, 'utf8').trim() === keyId;
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const seal = async (bytes) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv, data: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)) };
};
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

// Page content: every private/<slug>.html. A page is only encrypted again when its text or the
// password changed, so unchanged pages do not show up as changed in git.
const hashFile = at('private/ifen-page-hashes.json');
const hashes = sameKey && existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {};
for (const file of readdirSync(at('private')).filter((f) => f.endsWith('.html'))) {
  const slug = file.slice(0, -5);
  const text = readFileSync(at(`private/${file}`), 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  if (hashes[slug] === hash && existsSync(at(`src/data/${slug}.enc.json`))) { console.log(`Unchanged src/data/${slug}.enc.json`); continue; }
  const page = await seal(new TextEncoder().encode(text));
  writeFileSync(at(`src/data/${slug}.enc.json`), JSON.stringify({ iterations, salt: b64(salt), iv: b64(page.iv), data: b64(page.data) }, null, 2) + '\n');
  hashes[slug] = hash;
  console.log(`Wrote src/data/${slug}.enc.json`);
}
writeFileSync(hashFile, JSON.stringify(hashes, null, 2) + '\n');

// Files: 12-byte IV followed by the ciphertext. A file is only encrypted again when it is new,
// has changed since, or the password changed; files no longer in private/files are removed.
mkdirSync(at('public/ifen-files'), { recursive: true });
let files = [];
try { files = readdirSync(at('private/files')).filter((f) => !f.startsWith('.')); } catch {}
for (const name of files) {
  const src = at(`private/files/${name}`), dst = at(`public/ifen-files/${name}.enc`);
  if (sameKey && existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) { console.log(`Unchanged public/ifen-files/${name}.enc`); continue; }
  const { iv, data } = await seal(readFileSync(src));
  writeFileSync(dst, Buffer.concat([iv, data]));
  console.log(`Wrote public/ifen-files/${name}.enc (${(data.length / 1e6).toFixed(1)} MB)`);
}
for (const old of readdirSync(at('public/ifen-files'))) {
  if (!files.includes(old.replace(/\.enc$/, ''))) { rmSync(at(`public/ifen-files/${old}`)); console.log(`Removed public/ifen-files/${old}`); }
}
writeFileSync(keyIdFile, keyId + '\n');
