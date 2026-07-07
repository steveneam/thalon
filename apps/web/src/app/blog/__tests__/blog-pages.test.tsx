// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SEED_POSTS } from "@/lib/blog/posts";
import BlogIndexPage from "@/app/blog/page";
import BlogPostPage, { generateStaticParams } from "@/app/blog/[slug]/page";

/**
 * §9 presence pins: the blog index lists every post as a link, every post
 * page renders its sections + the disclosure stance + BlogPosting JSON-LD
 * from the same content object. Structural pins, not styling tests.
 */

function jsonLdBlocks(container: HTMLElement): Array<Record<string, unknown>> {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (node) => JSON.parse(node.textContent ?? "{}") as Record<string, unknown>,
  );
}

describe("blog index /blog", () => {
  it("lists every seed post as a link, newest first, with the RSS pointer", async () => {
    render(await BlogIndexPage());
    for (const post of SEED_POSTS) {
      const link = screen.getByRole("link", { name: post.title });
      expect(link).toHaveAttribute("href", `/blog/${post.slug}`);
    }
    expect(screen.getByRole("link", { name: /subscribe via rss/i })).toHaveAttribute(
      "href",
      "/blog/rss.xml",
    );
  });

  it("keeps the cadence claim honest on the visible surface", async () => {
    const { container } = render(await BlogIndexPage());
    expect(container.textContent).toContain("regularly");
    expect(container.textContent).not.toMatch(/posts daily|new post every day/i);
  });
});

describe("blog post /blog/[slug]", () => {
  it("prerenders every seed post (generateStaticParams covers them all)", () => {
    expect(generateStaticParams()).toEqual(SEED_POSTS.map(({ slug }) => ({ slug })));
  });

  it("renders the article: one h1, every section, the disclosure footer", async () => {
    const post = SEED_POSTS[0];
    render(await BlogPostPage({ params: Promise.resolve({ slug: post.slug }) }));
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(post.title);
    const article = screen.getByRole("article");
    for (const section of post.sections) {
      if (section.heading) {
        expect(within(article).getByRole("heading", { name: section.heading })).toBeInTheDocument();
      }
    }
    expect(within(article).getByText(/reviewed by a human/i)).toBeInTheDocument();
  });

  it("embeds BlogPosting JSON-LD generated from the same post object", async () => {
    const post = SEED_POSTS[1];
    const { container } = render(await BlogPostPage({ params: Promise.resolve({ slug: post.slug }) }));
    const posting = jsonLdBlocks(container).find((b) => b["@type"] === "BlogPosting");
    expect(posting).toMatchObject({
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
    });
  });
});
