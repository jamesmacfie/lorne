import { z } from "zod";

export const sortableIdSchema = z
  .string()
  .min(20)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const nonEmptyIdSchema = z.string().min(1).max(128);

export const safeErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_INPUT",
  "RATE_LIMITED",
  "ACTIVE_JOB_LIMIT",
  "TOPIC_JOB_ACTIVE",
  "CREDENTIAL_REQUIRED",
  "CREDENTIAL_INVALID",
  "CREDENTIAL_LIMITED",
  "PROVIDER_AMBIGUOUS",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_REFUSED",
  "PROVIDER_SCHEMA_ERROR",
  "IMAGE_UNAVAILABLE",
  "INTERNAL_ERROR"
]);

export type SafeErrorCode = z.infer<typeof safeErrorCodeSchema>;

export type ApiFailure = {
  ok: false;
  code: SafeErrorCode;
  message: string;
};

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function failure(code: SafeErrorCode, message: string): ApiFailure {
  return { ok: false, code, message };
}
