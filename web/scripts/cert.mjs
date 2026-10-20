// A self-signed HTTPS certificate for this laptop's Wi-Fi addresses, so a phone on the same network
// gets a secure origin (camera, microphone) without installing anything into Windows' trust store.
// The phone shows a one-time warning ("Advanced → Proceed"). Writes web/certificates/lan-{key,cert}.pem.
//   node scripts/cert.mjs            (npm run demo -- --https calls it)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { X509Certificate } from "node:crypto";
import selfsigned from "selfsigned";

const DIR = resolve(import.meta.dirname, "..", "certificates");
export const KEY = resolve(DIR, "lan-key.pem");
export const CERT = resolve(DIR, "lan-cert.pem");

export function lanAddresses() {
  return Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
}

export function ensureCertificate() {
  const ips = ["127.0.0.1", ...lanAddresses()];
  if (existsSync(KEY) && existsSync(CERT)) {
    const cert = new X509Certificate(readFileSync(CERT));
    const fresh = new Date(cert.validTo) > new Date(Date.now() + 7 * 864e5);
    if (fresh && ips.every((ip) => cert.checkIP(ip))) return { key: KEY, cert: CERT, ips, created: false };
  }
  const pems = selfsigned.generate([{ name: "commonName", value: "KhetKundli local demo" }], {
    keySize: 2048,
    days: 365,
    algorithm: "sha256",
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, ...ips.map((ip) => ({ type: 7, ip }))] },
    ],
  });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(KEY, pems.private);
  writeFileSync(CERT, pems.cert);
  return { key: KEY, cert: CERT, ips, created: true };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const r = ensureCertificate();
  console.log(`${r.created ? "created" : "kept"} ${r.cert} for ${r.ips.join(", ")}`);
}
