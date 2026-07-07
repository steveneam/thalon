import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { BLOG_TAGLINE, BLOG_TITLE, listPosts } from "@/lib/blog/posts";

/**
 * The blog index (§9, workspace-ux-v2.md): a site surface, dark-cinematic
 * like the landing. Seed posts ship tracked in this app; engine-published
 * posts join the same list through the ARMED posts-bundle read
 * (lib/blog/live.ts). Cards are era-blind by design. Rendered per request
 * (engine posts are runtime data — a publish must show up without a
 * rebuild); the B6.7 deploy upgrades this to revalidate-on-publish at the
 * own-site door, and the landing `/` stays static regardless.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: BLOG_TAGLINE,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
  openGraph: {
    title: `${BLOG_TITLE} · Thalon`,
    description: BLOG_TAGLINE,
    url: "/blog",
    siteName: "Thalon",
    type: "website",
  },
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default async function BlogIndexPage() {
  const posts = await listPosts();
  return (
    // Dark-cinematic like the landing (workspace-ux-v2.md §4): a site
    // surface, scoped `.dark` since the document root is light-first.
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-14 lg:py-20">
          <p className="u-eyebrow text-primary">Blog</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{BLOG_TITLE}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{BLOG_TAGLINE}</p>

          <ul className="mt-12 space-y-8">
            {posts.map((post) => (
              <li key={post.slug}>
                <article className="group relative rounded-xl border bg-card/50 p-6 transition-colors hover:border-primary/40">
                  <p className="u-eyebrow text-muted-foreground">
                    <time dateTime={post.publishedAt}>
                      {DATE_FORMAT.format(new Date(post.publishedAt))}
                    </time>
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 leading-7 text-muted-foreground">{post.description}</p>
                  {post.tags.length > 0 && (
                    <p className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="u-eyebrow rounded-full border border-primary/25 px-2.5 py-1 text-primary/90"
                        >
                          {tag}
                        </span>
                      ))}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ul>

          <p className="mt-12 text-sm text-muted-foreground">
            Prefer a feed?{" "}
            <a href="/blog/rss.xml" className="text-primary underline-offset-4 hover:underline">
              Subscribe via RSS
            </a>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
