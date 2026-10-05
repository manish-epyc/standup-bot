import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET() {
  const { env } = getCloudflareContext();
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all<{ name: string }>();

  return Response.json({
    ok: true,
    tables: results.map((r) => r.name),
    timezone: env.TEAM_TIMEZONE,
  });
}
