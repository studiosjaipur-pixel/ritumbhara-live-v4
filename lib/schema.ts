// Small JSON-LD builders shared by pages that add structured data.
// Only describes what is visibly on the page: FAQ schema text must match the FAQ shown to visitors.

const SITE = "https://www.ritumbhara.com";

export interface Faq {
  question: string;
  answer: string;
}

export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(function (c, i) {
      return { "@type": "ListItem", position: i + 1, name: c.name, item: SITE + c.path };
    }),
  };
}

export function faqSchema(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(function (f) {
      return { "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } };
    }),
  };
}

export function pageSchema(type: "AboutPage" | "ContactPage" | "CollectionPage" | "WebPage", name: string, path: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: name,
    url: SITE + path,
    description: description,
    isPartOf: { "@type": "WebSite", name: "Ritumbhara", url: SITE },
  };
}
