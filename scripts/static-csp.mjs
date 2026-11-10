import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const META_ID = "family-meal-splitter-csp";
const SCRIPT =
  /<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi;
const META = /<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;

/**
 * This processes our trusted, generated HTML; it is not an HTML sanitizer.
 * Hash the raw inline script text as the HTML parser sees it, including any
 * surrounding whitespace. HTML parsing normalizes CRLF and CR to LF.
 */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, attributes, content] of html.matchAll(SCRIPT)) {
    if (/(?:^|\s)src\s*=/i.test(attributes)) continue;
    const normalized = content.replace(/\r\n?/g, "\n");
    hashes.add(
      `'sha256-${createHash("sha256").update(normalized, "utf8").digest("base64")}'`,
    );
  }
  return [...hashes].sort();
}

export function contentSecurityPolicy(html) {
  return [
    "default-src 'none'",
    // External Next chunks are same-origin; inline hydration needs exact hashes.
    `script-src 'self' ${inlineScriptHashes(html).join(" ")}`.trim(),
    "script-src-attr 'none'",
    // React uses inline numeric styles for sliders and share proportion bars.
    // This allowance applies to styles only, never to executable scripts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "worker-src 'none'",
    "media-src 'none'",
  ].join("; ");
}

export function protectHtml(html) {
  const withoutGeneratedPolicy = html.replace(META, (tag) => {
    if (new RegExp(`\\sid\\s*=\\s*["']${META_ID}["']`, "i").test(tag))
      return "";
    if (/\shttp-equiv\s*=\s*["']content-security-policy["']/i.test(tag)) {
      throw new Error(
        "Unexpected existing CSP in exported HTML; reconcile policies before publishing.",
      );
    }
    // The written file is UTF-8. Move its declaration before a possibly long
    // hash allowlist so it always stays inside HTML's first 1,024-byte window.
    if (/\scharset\s*=/i.test(tag)) return "";
    return tag;
  });
  if (!/<head\b[^>]*>/i.test(withoutGeneratedPolicy)) {
    throw new Error("Cannot install CSP: exported HTML has no head element.");
  }
  const policy = contentSecurityPolicy(withoutGeneratedPolicy);
  // Encoding first, then policy: both precede every script and resource.
  return withoutGeneratedPolicy.replace(
    /<head\b[^>]*>/i,
    (head) =>
      `${head}<meta charset="utf-8"><meta id="${META_ID}" http-equiv="Content-Security-Policy" content="${policy}">`,
  );
}

export async function protectStaticExport(directory) {
  const htmlFiles = [];
  async function collect(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && entry.name.endsWith(".html"))
        htmlFiles.push(path);
    }
  }
  await collect(directory);
  if (!htmlFiles.length)
    throw new Error("Static export has no HTML documents to protect.");
  // Validate every document before writing any, so malformed output fails the build.
  const output = await Promise.all(
    htmlFiles.map(async (path) => ({
      path,
      html: protectHtml(await readFile(path, "utf8")),
    })),
  );
  for (const file of output) await writeFile(file.path, file.html, "utf8");
  return output.length;
}

const invokedDirectly =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly && process.env.GITHUB_PAGES === "true") {
  const count = await protectStaticExport(resolve("out"));
  console.info(
    `Applied static Content Security Policy to ${count} exported HTML documents.`,
  );
}
