import nacl from "tweetnacl";

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const keyPair = nacl.sign.keyPair();
const publicKeyHex = toHex(keyPair.publicKey);

const body = '{"type":1,"id":"test-ping"}';
const timestamp = String(Math.floor(Date.now() / 1000));
const message = new TextEncoder().encode(timestamp + body);
const signatureHex = toHex(nacl.sign.detached(message, keyPair.secretKey));

const res = await fetch("http://localhost:8787/interactions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Signature-Ed25519": signatureHex,
    "X-Signature-Timestamp": timestamp,
  },
  body,
});
const text = await res.text();
console.log("status:", res.status);
console.log("body:", text);

// Also test a tampered signature is rejected
const badRes = await fetch("http://localhost:8787/interactions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Signature-Ed25519": signatureHex,
    "X-Signature-Timestamp": String(Number(timestamp) + 5),
  },
  body,
});
console.log("tampered status:", badRes.status);