import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogPostingJsonLd } from "@/components/landing/json-ld";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { getSeedPost, POST_DISCLOSURE, SEED_POSTS } from "@/lib/blog/posts";

/**
 * A blog post page (§9): statically prerendered from the tracked content
 * module — `generateStaticParams` covers every seed post, so the whole
 * route ships as SSG. Engine-published post bodies (posts-bundle `htmlRef`)
 * join when the lead arms the lib/blog/live.ts seam at the merge train;
 * until then unknown slugs are honest 404s. BlogPosting JSON-LD and the
 * visible article render from the SAME post object (the A13 no-drift rule).
 */

export function generateStaticParams(): Array<{ slug: string }> {
  return SEED_POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getSeedPost(slug);
  if (!post) return {};
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
  const post = getSeedPost(slug);
  if (!post) notFound();

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

          {post.sections.map((section, i) => (
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
          ))}

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
