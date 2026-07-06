import { FAQ } from "@/lib/landing/copy";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

/**
 * A13 AEO/GEO pack (docs/FRONTEND.md §4): `FAQPage` generated from the SAME
 * data the visible accordion renders — answer engines and visitors read
 * identical claims — plus `Organization`. Native <script> per the Next
 * JSON-LD guide; `<` is escaped so page copy can never break out of the
 * script context.
 */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_TAGLINE,
        logo: `${SITE_URL}/icon.svg`,
      }}
    />
  );
}

export function FaqJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );
}
