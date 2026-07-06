import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The workspace, approve queue, and API are operator surfaces; /brand is the internal mark review. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/app", "/approve", "/brand"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
