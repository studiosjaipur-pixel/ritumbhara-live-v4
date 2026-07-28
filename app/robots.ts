export default function robots() {
    return {
          rules: [
            {
                      userAgent: "*",
                      allow: "/",
            },
            {
                      userAgent: [
                                  "GPTBot",
                                  "ChatGPT-User",
                                  "OAI-SearchBot",
                                  "PerplexityBot",
                                  "Perplexity-User",
                                  "ClaudeBot",
                                  "Claude-User",
                                  "Claude-SearchBot",
                                  "anthropic-ai",
                                  "Google-Extended",
                                  "Applebot-Extended",
                                  "CCBot",
                                  "Bytespider",
                                  "Amazonbot",
                                ],
                      allow: "/",
            },
                ],
          sitemap: "https://ritumbhara.com/sitemap.xml",
          host: "https://ritumbhara.com",
    };
}
