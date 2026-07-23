import type { SafeErrorCode } from "#/shared/contracts";

export function mapCardChatProviderError(error: unknown): { code: SafeErrorCode; message: string } {
  const value = error as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = value.statusCode ?? value.status;
  if (status === 401 || status === 403 || status === 404)
    return { code: "CREDENTIAL_LIMITED", message: "Your OpenAI key cannot use the configured chat model." };
  if (status === 429) return { code: "PROVIDER_RATE_LIMITED", message: "OpenAI is rate limiting this project. Try again shortly." };
  if (value.name === "AbortError" || value.name === "TimeoutError")
    return { code: "CHAT_TIMEOUT", message: "The answer took too long. You can retry it." };
  if (/refus/i.test(value.message ?? "")) return { code: "PROVIDER_REFUSED", message: "OpenAI declined to answer this question." };
  return {
    code: "PROVIDER_AMBIGUOUS",
    message: "The provider outcome is unclear. Retrying may create another billed request."
  };
}
