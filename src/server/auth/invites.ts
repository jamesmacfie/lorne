import { sha256Hex } from "#/shared/ids";

export const INVITE_CODE_BYTES = 24;

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function normalizeInviteCode(code: string): string {
  return code.trim();
}

export async function hashInviteCode(code: string): Promise<string> {
  return sha256Hex(normalizeInviteCode(code));
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username);
}
