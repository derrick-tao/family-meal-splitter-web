import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  contentSecurityPolicy,
  inlineScriptHashes,
  protectHtml,
  protectStaticExport,
} from "../scripts/static-csp.mjs";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const digest = (text: string) =>
  `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

describe("exported Content Security Policy", () => {
  it("hashes the complete inline hydration script while excluding external scripts", () => {
    const code = 'self.__next_f.push([1,"Family A 🍽️"]);';
    const html = `<head><script src="/_next/static/app.js" async></script><script>${code}</script><script>${code}</script></head>`;
    expect(inlineScriptHashes(html)).toEqual([digest(code)]);
    expect(inlineScriptHashes(`<script>\r\n${code}\r</script>`)).toEqual([
      digest(`\n${code}\n`),
    ]);
  });
  it("sets the policy first and allows styling without allowing inline script or eval", () => {
    const html =
      '<!doctype html><html><head><meta charset="utf-8"><script>self.__next_f=[]</script></head><body></body></html>';
    const output = protectHtml(html);
    expect(output).toMatch(
      /<head><meta charset="utf-8"><meta id="family-meal-splitter-csp"/,
    );
    expect(output).toContain(digest("self.__next_f=[]"));
    const directives = contentSecurityPolicy(html).split("; ");
    expect(
      directives.find((directive) => directive.startsWith("script-src ")),
    ).not.toContain("'unsafe-inline'");
    expect(directives.join(";")).not.toContain("'unsafe-eval'");
    expect(directives).toContain("style-src 'self' 'unsafe-inline'");
    for (const directive of [
      "object-src 'none'",
      "base-uri 'none'",
      "frame-src 'none'",
      "form-action 'none'",
      "script-src-attr 'none'",
    ])
      expect(directives).toContain(directive);
    expect(output).not.toContain("frame-ancestors");
    expect(protectHtml(output)).toBe(output);
  });
  it("keeps UTF-8 declaration first even when the script hash allowlist exceeds 1,024 bytes", () => {
    const scripts = Array.from(
      { length: 30 },
      (_, i) => `<script>void "🍽️${i}";</script>`,
    ).join("");
    const output = protectHtml(
      `<html><head><meta charSet="utf-8">${scripts}</head><body></body></html>`,
    );
    expect(contentSecurityPolicy(scripts).length).toBeGreaterThan(1024);
    expect(output).toMatch(
      /<head><meta charset="utf-8"><meta id="family-meal-splitter-csp"/,
    );
    expect(output.match(/<meta charset=/gi)).toHaveLength(1);
    expect(output.indexOf("charset")).toBeLessThan(100);
    expect(output.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(
      output.indexOf("<script>"),
    );
    expect(protectHtml(output)).toBe(output);
  });
  it("rejects conflicting policies and missing head rather than claiming protection", () => {
    expect(() =>
      protectHtml(
        '<head><meta http-equiv="Content-Security-Policy" content="default-src *"></head>',
      ),
    ).toThrow("Unexpected existing CSP");
    expect(() => protectHtml("<html><body>Family A</body></html>")).toThrow(
      "no head",
    );
  });
  it("protects every exported document including nested routes and preserves asset files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "family-csp-"));
    directories.push(directory);
    await mkdir(join(directory, "_not-found"));
    const html =
      "<html><head><script>self.__next_f=[]</script></head><body>Family A</body></html>";
    await writeFile(join(directory, "index.html"), html);
    await writeFile(join(directory, "404.html"), html);
    await writeFile(join(directory, "_not-found", "index.html"), html);
    await writeFile(join(directory, "asset.js"), "original");
    expect(await protectStaticExport(directory)).toBe(3);
    for (const file of ["index.html", "404.html", "_not-found/index.html"])
      expect(await readFile(join(directory, file), "utf8")).toContain(
        'http-equiv="Content-Security-Policy"',
      );
    expect(await readFile(join(directory, "asset.js"), "utf8")).toBe(
      "original",
    );
  });
});
