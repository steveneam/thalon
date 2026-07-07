import { readPublishedPageHtml } from "@thalon/engine";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogPostingJsonLd } from "@/components/landing/json-ld";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { findEnginePost, toBlogPostCard } from "@/lib/blog/live";
import { getSeedPost, POST_DISCLOSURE, SEED_POSTS } from "@/lib/blog/posts";
import type { BlogPostCard } from "@/lib/blog/types";

/**
 * A blog post page (§9): seed posts statically prerender from the tracked
 * content module (`generateStaticParams` covers them, `dynamicParams` stays
 * on) — engine-PUBLISHED posts resolve at request time through the armed
 * lib/blog/live.ts seam: bundle entry → verified `htmlRef` artifact read
 * (engine `readPublishedPageHtml`) → the artifact's own <body> markup.
 * Rendering that markup is safe BY CONSTRUCTION: `selfContainmentViolations`
 * gates every web_page draft before judging — no <script>/<iframe>/<object>/
 * <embed>, no external resource loads — and the read is content-address
 * verified. Unknown slugs stay honest 404s. BlogPosting JSON-LD and the
 * visible article render from the SAME post object (the A13 no-drift rule).
 */

export function generateStaticParams(): Array<{ slug: string }> {
  return SEED_POSTS.map(({ slug }) => ({ slug }));
}

async function resolvePost(
  slug: string,
): Promise<{ card: BlogPostCard; engineHtml?: string } | null> {
  const seed = getSeedPost(slug);
  if (seed) {
    const { slug: seedSlug, title, description, publishedAt, tags } = seed;
    return { card: { slug: seedSlug, title, description, publishedAt, tags } };
  }
  const entry = await findEnginePost(slug);
  if (!entry) return null;
  const html = await readPublishedPageHtml(entry.htmlRef);
  if (!html) return null;
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1]?.trim();
  if (!body) return null;
  return { card: toBlogPostCard(entry), engineHtml: body };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolvePost(slug);
  if (!resolved) return {};
  const post = resolved.card;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      siteName: "Thalon",
      type: "article",
      publishedTime: post.publishedAt,
      tags: post.tags,
    },
  };
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seed = getSeedPost(slug);
  const resolved = await resolvePost(slug);
  if (!resolved) notFound();
  const post = resolved.card;

  return (
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <BlogPostingJsonLd post={post} />
      <SiteHeader />

      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 py-14 lg:py-20">
          <p className="u-eyebrow">
            <Link href="/blog" className="text-muted-foreground transition-colors hover:text-foreground">
              ← Blog
            </Link>
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {post.title}
          </h1>
          <p className="u-eyebrow mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
            <time dateTime={post.publishedAt}>{DATE_FORMAT.format(new Date(post.publishedAt))}</time>
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-primary/25 px-2.5 py-1 text-primary/90">
                {tag}
              </span>
            ))}
          </p>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{post.description}</p>

          {seed ? (
            seed.sections.map((section, i) => (
              <section key={section.heading ?? `intro-${i}`} className="mt-10">
                {section.heading && (
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="mt-4 leading-8 text-foreground/90">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))
          ) : (
            /* Judged, approved, self-contained-by-construction markup (see the module doc). */
            <div
              className="post-engine-body mt-10 leading-8 text-foreground/90"
              dangerouslySetInnerHTML={{ __html: resolved.engineHtml ?? "" }}
            />
          )}

          {/* §9 guardrail 2: the FAQ's AI-disclosure stance, on every post. */}
          <footer className="mt-14 border-t pt-6">
            <p className="text-sm leading-6 text-muted-foreground">{POST_DISCLOSURE}</p>
          </footer>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
