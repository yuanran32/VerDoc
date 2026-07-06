import type { BundledLanguage } from "shiki";

let singleHighlighterPromise: Promise<
  (code: string, lang: string) => string
> | null = null;

async function getHighlighter(): Promise<
  (code: string, lang: string) => string
> {
  if (!singleHighlighterPromise) {
    singleHighlighterPromise = (async () => {
      const { createHighlighter } = await import("shiki");
      const highlighter = await createHighlighter({
        themes: ["github-dark-default"],
        langs: [
          "javascript",
          "typescript",
          "jsx",
          "tsx",
          "vue",
          "html",
          "css",
          "json",
          "bash",
          "shell",
          "markdown",
          "vue-html"
        ]
      });

      return (code: string, lang: string): string => {
        const language = normalizeLanguage(lang);
        try {
          return extractCodeHtml(highlighter.codeToHtml(code, {
            lang: language,
            theme: "github-dark-default"
          }));
        } catch {
          return extractCodeHtml(highlighter.codeToHtml(code, {
            lang: "javascript",
            theme: "github-dark-default"
          }));
        }
      };
    })();
  }

  return singleHighlighterPromise;
}

function normalizeLanguage(lang: string): BundledLanguage {
  const lower = (lang ?? "").toLowerCase();
  const aliasMap: Record<string, BundledLanguage> = {
    js: "javascript",
    ts: "typescript",
    "react": "jsx",
    "react-ts": "tsx",
    sh: "bash",
    shell: "bash",
    py: "python",
    "vue-template": "vue-html"
  };

  return aliasMap[lower] ?? (lower as BundledLanguage);
}

function extractCodeHtml(shikiHtml: string): string {
  const match = shikiHtml.match(/<code>([\s\S]*)<\/code>/);
  return match?.[1] ?? shikiHtml;
}

export async function highlightCode(
  code: string,
  lang: string
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter(code, lang);
}
