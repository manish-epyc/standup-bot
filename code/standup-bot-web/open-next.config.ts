import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: all pages are dynamic and read from D1.
export default defineCloudflareConfig({});
