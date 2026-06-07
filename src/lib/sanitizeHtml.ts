/**
 * sanitizeHtml — wrapper sobre isomorphic-dompurify.
 * Permite sólo formato seguro: NO <script>, NO <iframe>, NO atributos on*,
 * NO `javascript:` en href/src. Se usa para body_html proveniente de DB
 * (landing pages, hubs SEO) que se renderiza en páginas públicas.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "a", "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "img", "figure", "figcaption", "hr", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "title", "alt", "src", "loading", "class", "id", "target", "rel"];

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"],
  });
}
