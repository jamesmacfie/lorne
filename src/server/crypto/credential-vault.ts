export type CredentialEnvelope = {
  ciphertext: string;
  iv: string;
  keyVersion: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function makeAad(credentialId: string, userId: string, keyVersion: number): Uint8Array {
  return encoder.encode(`lorne-credential\u0000${credentialId}\u0000${userId}\u0000openai\u0000v${keyVersion}`);
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

export async function importMasterKey(base64Key: string): Promise<CryptoKey> {
  const bytes = decodeBase64(base64Key);
  if (bytes.byteLength !== 32) throw new Error("Credential encryption key must decode to exactly 32 bytes.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(input: {
  plaintext: string;
  credentialId: string;
  userId: string;
  keyVersion: number;
  masterKey: CryptoKey;
}): Promise<CredentialEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: arrayBuffer(iv),
      additionalData: arrayBuffer(makeAad(input.credentialId, input.userId, input.keyVersion)),
      tagLength: 128
    },
    input.masterKey,
    encoder.encode(input.plaintext)
  );
  return { ciphertext: encodeBase64(new Uint8Array(ciphertext)), iv: encodeBase64(iv), keyVersion: input.keyVersion };
}

export async function decryptCredential(input: {
  envelope: CredentialEnvelope;
  credentialId: string;
  userId: string;
  masterKey: CryptoKey;
}): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: arrayBuffer(decodeBase64(input.envelope.iv)),
      additionalData: arrayBuffer(makeAad(input.credentialId, input.userId, input.envelope.keyVersion)),
      tagLength: 128
    },
    input.masterKey,
    arrayBuffer(decodeBase64(input.envelope.ciphertext))
  );
  return decoder.decode(plaintext);
}
