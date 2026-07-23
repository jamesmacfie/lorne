import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential, importMasterKey } from "./credential-vault";

function base64Key(seed: number): string {
  return btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => (seed + index) % 256)));
}

describe("credential vault", () => {
  it("round trips an OpenAI key with bound AAD", async () => {
    const masterKey = await importMasterKey(base64Key(3));
    const plaintext = "test-credential-secret-value";
    const envelope = await encryptCredential({
      plaintext,
      credentialId: "cred_1",
      userId: "user_1",
      keyVersion: 1,
      masterKey
    });
    await expect(decryptCredential({ envelope, credentialId: "cred_1", userId: "user_1", masterKey })).resolves.toBe(plaintext);
    expect(envelope.iv).not.toContain(plaintext);
    expect(envelope.ciphertext).not.toContain(plaintext);
  });

  it("rejects ciphertext tampering and incorrect AAD", async () => {
    const masterKey = await importMasterKey(base64Key(7));
    const envelope = await encryptCredential({
      plaintext: "test-sensitive-credential",
      credentialId: "cred_2",
      userId: "user_2",
      keyVersion: 1,
      masterKey
    });
    const bytes = Uint8Array.from(atob(envelope.ciphertext), (value) => value.charCodeAt(0));
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    const tampered = { ...envelope, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(decryptCredential({ envelope: tampered, credentialId: "cred_2", userId: "user_2", masterKey })).rejects.toThrow();
    await expect(decryptCredential({ envelope, credentialId: "cred_2", userId: "someone_else", masterKey })).rejects.toThrow();
  });

  it("can re-encrypt an envelope during key rotation", async () => {
    const v1 = await importMasterKey(base64Key(11));
    const v2 = await importMasterKey(base64Key(19));
    const oldEnvelope = await encryptCredential({
      plaintext: "test-rotating-credential",
      credentialId: "cred_3",
      userId: "user_3",
      keyVersion: 1,
      masterKey: v1
    });
    const plaintext = await decryptCredential({ envelope: oldEnvelope, credentialId: "cred_3", userId: "user_3", masterKey: v1 });
    const newEnvelope = await encryptCredential({ plaintext, credentialId: "cred_3", userId: "user_3", keyVersion: 2, masterKey: v2 });
    expect(newEnvelope.keyVersion).toBe(2);
    await expect(decryptCredential({ envelope: newEnvelope, credentialId: "cred_3", userId: "user_3", masterKey: v2 })).resolves.toBe(
      "test-rotating-credential"
    );
  });
});
