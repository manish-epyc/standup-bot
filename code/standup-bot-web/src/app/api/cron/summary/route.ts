import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { jobResponse } from "@/lib/jobs";

export async function POST(request: Request) {
  const { env } = getCloudflareContext();
  if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  return jobResponse(env, "summary");
}
