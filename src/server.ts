import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { CardGenerationWorkflow } from "#/server/generation/generation-workflow";
import { addSecurityHeaders } from "#/server/security/http";

export { CardGenerationWorkflow };

export default {
  async fetch(request: Request): Promise<Response> {
    const response = await handler.fetch(request);
    return addSecurityHeaders(response, env.APP_ENV === "production", new URL(request.url).pathname.startsWith("/chats"));
  }
} satisfies ExportedHandler<Env>;
