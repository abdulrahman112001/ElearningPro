import sanitizeHtml from "sanitize-html"

// Sanitizes rich-text HTML written by instructors (course and lesson
// descriptions). Uses sanitize-html instead of isomorphic-dompurify because
// the latter pulls in jsdom on the server, which crashes on Vercel's Node
// runtime and turned the course page into a 500.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "h1",
    "h2",
    "span",
    "u",
    "s",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["class", "dir"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
}

export function sanitizeRichText(html: string | null | undefined): string {
  return html ? sanitizeHtml(html, OPTIONS) : ""
}
