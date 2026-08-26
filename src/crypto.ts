const ALGORITHM: EcKeyImportParams = { name: "ECDSA", namedCurve: "P-256" };
const VERIFY_ALGORITHM: EcdsaParams = {
  name: "ECDSA",
  hash: { name: "SHA-256" },
};

function hexToUint8Array(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) throw new Error("Invalid hex string");
  return new Uint8Array(match.map((b) => parseInt(b, 16)));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verify(
  publicKeyHex: string,
  signedData: string,
  signatureBase64: string
): Promise<boolean> {
  const publicKeyBytes = hexToUint8Array(publicKeyHex);
  const signatureBytes = base64ToUint8Array(signatureBase64);
  const dataBytes = new TextEncoder().encode(signedData);

  // Discord gives the raw 32-byte key; ECDSA P-256 needs the 65-byte uncompressed point (04 || X || Y)
  const uncompressedKey = new Uint8Array(65);
  uncompressedKey[0] = 0x04;
  uncompressedKey.set(publicKeyBytes, 1);

  const publicKey = await crypto.subtle.importKey(
    "raw",
    uncompressedKey,
    ALGORITHM,
    false,
    ["verify"]
  );

  return crypto.subtle.verify(VERIFY_ALGORITHM, publicKey, signatureBytes, dataBytes);
}
