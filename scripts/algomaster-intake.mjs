#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultOutDir = join(repoRoot, "tmp/algomaster-intake");

let globalBrowser = null;
let globalBrowserContext = null;

// Automatically load private/algomaster.cookie if env is not set
if (!process.env.ALGOMASTER_COOKIE) {
  try {
    const cookiePath = join(repoRoot, "private/algomaster.cookie");
    const content = await readFile(cookiePath, "utf8");
    const trimmed = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .join("")
      .trim();
    if (trimmed) {
      process.env.ALGOMASTER_COOKIE = trimmed;
    }
  } catch {
    // Ignore if file doesn't exist
  }
}

const args = parseArgs(process.argv.slice(2));

if (
  args.help ||
  (args.urls.length === 0 && args.inputs.length === 0 && !args.listFile && !args.courseUrl)
) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

if (args.courseUrl) {
  await runCourseIntake(args);
  await closeBrowser();
  process.exit(0);
}

if (args.listFile) {
  const listPath = resolvePath(args.listFile);
  const listText = await readFile(listPath, "utf8");
  for (const line of listText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) args.urls.push(trimmed);
  }
}

const pages = [];

for (const url of args.urls) {
  pages.push(await fetchPage(url, args.browser));
}

for (const input of args.inputs) {
  pages.push(await readInput(input));
}

const markdown = buildMarkdown(pages);
const outPath = resolveOutput(args.out);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, markdown, "utf8");

console.log(`wrote ${relative(repoRoot, outPath)}`);
await closeBrowser();

function parseArgs(argv) {
  const parsed = {
    urls: [],
    inputs: [],
    listFile: "",
    out: "",
    help: false,
    courseUrl: "",
    courseOutDir: "",
    freeOnly: false,
    force: false,
    limit: 0,
    delayMs: 250,
    browser: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--url") parsed.urls.push(requireValue(argv, (i += 1), arg));
    else if (arg === "--input") parsed.inputs.push(requireValue(argv, (i += 1), arg));
    else if (arg === "--list") parsed.listFile = requireValue(argv, (i += 1), arg);
    else if (arg === "--out") parsed.out = requireValue(argv, (i += 1), arg);
    else if (arg === "--course") parsed.courseUrl = requireValue(argv, (i += 1), arg);
    else if (arg === "--course-out") parsed.courseOutDir = requireValue(argv, (i += 1), arg);
    else if (arg === "--free-only") parsed.freeOnly = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--limit") parsed.limit = Number(requireValue(argv, (i += 1), arg)) || 0;
    else if (arg === "--delay-ms") parsed.delayMs = Number(requireValue(argv, (i += 1), arg)) || 0;
    else if (arg === "--browser") parsed.browser = true;
    else if (arg.startsWith("http://") || arg.startsWith("https://")) parsed.urls.push(arg);
    else if (arg) parsed.inputs.push(arg);
  }

  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    console.error(`missing value for ${flag}`);
    process.exit(1);
  }
  return value;
}

function printHelp() {
  console.log(`AlgoMaster intake: extract authorized AlgoMaster lessons into clean Markdown.

Usage:
  bun run algomaster:intake -- --url https://algomaster.io/learn/system-design/top-30-system-design-concepts
  bun run algomaster:intake -- --input lesson.html --out tmp/algomaster-intake/lesson.md
  bun run algomaster:intake -- --list urls.txt
  bun run algomaster:intake -- --course https://algomaster.io/learn/system-design/course-introduction

Course mode (--course <any-lesson-url>):
  Reads the sidebar from one lesson page, then writes every chapter to:
    tmp/algomaster-intake/<course-slug>/<NN>-<section-id>/<MM>-<chapter-slug>.md
  plus an _index.md per section and one at the course root.
  Flags: --free-only, --force, --limit <N>, --delay-ms <ms>, --course-out <dir>, --browser.

Browser intake (--browser):
  Launches a headless browser (Playwright Chromium) to bypass Vercel Bot Defense.
  Use when raw fetch returns incomplete/intro-only extracts (thin files).

Authorized paid access:
  ALGOMASTER_COOKIE='name=value; ...' bun run algomaster:intake -- --url <paid-url>
  ALGOMASTER_AUTHORIZATION='Bearer ...' bun run algomaster:intake -- --url <paid-url>

Rules:
  - Use only content you are authorized to access.
  - Authenticated fetches are restricted to https://algomaster.io and its subdomains.
  - Do not commit tmp/ output or credentials.
  - Extracted Markdown is raw intake, not final published notes.
`);
}

async function fetchPage(url, useBrowser = false) {
  if (useBrowser) {
    const pageData = await fetchBrowser(url);
    return extractPage(pageData);
  }

  const initialUrl = parseFetchUrl(url);
  const hasCredentials = Boolean(
    process.env.ALGOMASTER_COOKIE || process.env.ALGOMASTER_AUTHORIZATION,
  );
  if (hasCredentials) assertCredentialSafeUrl(initialUrl);

  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const headers = buildFetchHeaders(currentUrl, hasCredentials);
    const response = await fetch(currentUrl, { headers, redirect: "manual" });

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new Error(`redirect from ${currentUrl.href} did not include a Location header`);
      const nextUrl = new URL(location, currentUrl);
      if (hasCredentials) assertCredentialSafeUrl(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const status = `${response.status} ${response.statusText}`.trim();

    if (!response.ok) {
      console.warn(
        `warning: fetched ${currentUrl.href} with status ${status}; inventory may be an error or login page`,
      );
    }

    return extractPage({
      source: currentUrl.href,
      status,
      contentType,
      raw: body,
    });
  }

  throw new Error(`too many redirects while fetching ${initialUrl.href}`);
}

function parseFetchUrl(url) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol))
    throw new Error(`unsupported URL protocol: ${parsed.protocol}`);
  return parsed;
}

function buildFetchHeaders(url, hasCredentials) {
  const headers = {
    "user-agent": "knowledge-base-algomaster-intake/1.0",
    accept: "text/html, text/plain, application/xhtml+xml, */*",
  };

  if (!hasCredentials) return headers;

  assertCredentialSafeUrl(url);
  if (process.env.ALGOMASTER_COOKIE) headers.cookie = process.env.ALGOMASTER_COOKIE;
  if (process.env.ALGOMASTER_AUTHORIZATION) {
    headers.authorization = process.env.ALGOMASTER_AUTHORIZATION;
  }

  return headers;
}

function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function assertCredentialSafeUrl(url) {
  if (url.protocol !== "https:") {
    throw new Error(`refusing to send AlgoMaster credentials to non-HTTPS URL: ${url.href}`);
  }

  if (!isAlgoMasterHost(url.hostname)) {
    throw new Error(`refusing to send AlgoMaster credentials to non-AlgoMaster URL: ${url.href}`);
  }
}

function isAlgoMasterHost(hostname) {
  return hostname === "algomaster.io" || hostname.endsWith(".algomaster.io");
}

async function readInput(input) {
  const path = resolvePath(input);
  const raw = await readFile(path, "utf8");
  return extractPage({
    source: relative(repoRoot, path),
    status: "local file",
    contentType: guessContentType(path),
    raw,
  });
}

function resolvePath(path) {
  return isAbsolute(path) ? path : resolve(repoRoot, path);
}

function resolveOutput(out) {
  if (out) return resolvePath(out);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(defaultOutDir, `${stamp}.md`);
}

function guessContentType(path) {
  if (/\.html?$/i.test(path)) return "text/html";
  if (/\.mdx?$/i.test(path)) return "text/markdown";
  return "text/plain";
}

function extractPage({ source, status, contentType, raw }) {
  const isHtml =
    contentType.includes("html") || /<html[\s>]/i.test(raw) || /<article[\s>]/i.test(raw);
  const pageTitle = isHtml ? extractTitle(raw) : "";
  const payload = isHtml ? extractCanonicalPayload(raw, pageTitle) : null;
  const title = pageTitle || payload?.title || titleFromSource(source);
  const canonicalMarkdown = payload ? normalizePayloadMarkdown(payload.content) : "";
  const hydrationText = isHtml ? extractHydrationText(raw) : "";
  const text = normalizeText(isHtml ? `${htmlToText(raw)}\n${hydrationText}` : raw);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headings = lines.filter((line) => /^#{1,4}\s+/.test(line)).slice(0, 80);
  const lessonLines = canonicalMarkdown ? [] : extractLessonLines(lines);
  const candidates = extractClaimCandidates(lines);
  const accessWarning = detectAccessWarning(text);
  const images = isHtml ? extractImages(raw, source) : [];

  return {
    source,
    status,
    contentType,
    title,
    headings,
    canonicalMarkdown,
    lessonLines,
    images,
    candidates,
    accessWarning,
  };
}

function extractCanonicalPayload(html, expectedTitle) {
  // AlgoMaster ships the rendered lesson as canonical Markdown inside a
  // React Flight chunk: self.__next_f.push([1, "..."]).
  // Two shapes seen in the wild:
  //   A. Embedded object: {"title":"...","content":"..."}
  //   B. pageContext string: "pageContext":"{\"title\":...,\"content\":...}"
  // After JSON-decoding the chunk text, scan for both.
  const candidates = [];
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    let decoded;
    try {
      decoded = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }

    // Shape A: direct embedded object.
    let searchFrom = 0;
    while (true) {
      const idx = decoded.indexOf('{"title":"', searchFrom);
      if (idx === -1) break;
      const obj = readBalancedJson(decoded, idx);
      searchFrom = idx + 1;
      if (!obj) continue;
      tryPushCandidate(obj, candidates);
    }

    // Shape B: pageContext string value (doubly-encoded).
    let pcFrom = 0;
    while (true) {
      const key = '"pageContext":"';
      const idx = decoded.indexOf(key, pcFrom);
      if (idx === -1) break;
      const stringStart = idx + key.length - 1; // include opening quote
      const stringEnd = findJsonStringEnd(decoded, stringStart);
      pcFrom = stringEnd > 0 ? stringEnd : idx + key.length;
      if (stringEnd <= 0) continue;
      const quoted = decoded.slice(stringStart, stringEnd + 1);
      try {
        const inner = JSON.parse(quoted); // JSON-decode the string value
        tryPushCandidate(inner, candidates);
      } catch {
        // Not parseable; skip.
      }
    }
  }
  if (candidates.length === 0) return null;

  const matching = candidates.filter((c) => isTitleMatch(c.title, expectedTitle));
  if (matching.length > 0) {
    matching.sort((a, b) => b.content.length - a.content.length);
    return matching[0];
  }

  if (!expectedTitle || expectedTitle === "Untitled AlgoMaster page") {
    candidates.sort((a, b) => b.content.length - a.content.length);
    return candidates[0];
  }

  return null;
}

function isTitleMatch(candTitle, expectedTitle) {
  if (!expectedTitle) return true;
  const clean = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c = clean(candTitle);
  const e = clean(expectedTitle);
  return c === e || c.includes(e) || e.includes(c);
}

function tryPushCandidate(input, candidates) {
  let parsed;
  try {
    parsed = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return;
  }
  if (typeof parsed?.title === "string" && typeof parsed?.content === "string") {
    candidates.push(parsed);
  }
}

function findJsonStringEnd(str, openQuoteIndex) {
  if (str[openQuoteIndex] !== '"') return -1;
  let esc = false;
  for (let i = openQuoteIndex + 1; i < str.length; i++) {
    const ch = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') return i;
  }
  return -1;
}

function readBalancedJson(str, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

function normalizePayloadMarkdown(content) {
  if (!content) return "";
  // Strip AlgoMaster's payload marker comments (<!-- payload:calloutBlock:START ... -->),
  // leaving the > blockquote callouts intact as plain Markdown.
  return content
    .replace(/[ \t]*<!--\s*payload:[^>]*-->[ \t]*\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return decodeEntities(stripTags(h1Match[1])).trim();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return cleanTitle(decodeEntities(stripTags(titleMatch[1])).trim());

  return "Untitled AlgoMaster page";
}

function cleanTitle(title) {
  return title
    .replace(/\s+\|\s+AlgoMaster\.io$/i, "")
    .replace(/\s+\|\s+System Design$/i, "")
    .trim();
}

function titleFromSource(source) {
  return (
    basename(source)
      .replace(/[-_]/g, " ")
      .replace(/\.[a-z0-9]+$/i, "") || source
  );
}

function htmlToText(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<\/(h[1-4])>/gi, "\n")
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<h4[^>]*>/gi, "\n#### ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|article|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text);
}

function stripTags(text) {
  return text.replace(/<[^>]+>/g, " ");
}

function extractHydrationText(html) {
  const chunks = [];
  for (const scriptMatch of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = scriptMatch[1];
    if (!script.includes("self.__next_f.push")) continue;

    collectRichTextSentences(script, chunks);

    for (const pushMatch of script.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)/g)) {
      try {
        const payload = JSON.parse(pushMatch[1]);
        collectReadableStrings(payload, chunks);
      } catch {
        collectReadableStrings(pushMatch[1], chunks);
      }
    }
  }

  return chunks.join("\n");
}

function collectRichTextSentences(script, chunks) {
  const unescaped = script.replace(/\\"/g, '"');
  const strongSentenceRe =
    /"children":\["([^"]*)",\["\$","strong","[^"]*",\{[^}]*"children":"([^"]+)"[^}]*\}\],"([^"]*)"\]/g;

  for (const match of unescaped.matchAll(strongSentenceRe)) {
    const sentence = cleanReactText(`${match[1]}${match[2]}${match[3]}`);
    if (looksReadable(sentence)) chunks.push(sentence);
  }
}

function collectReadableStrings(value, chunks) {
  if (Array.isArray(value)) {
    if (value[0] === "$" && value[3] && typeof value[3] === "object" && "children" in value[3]) {
      const combined = cleanReactText(flattenReactText(value[3].children));
      if (looksReadable(combined)) chunks.push(combined);
    }

    for (const item of value) collectReadableStrings(item, chunks);
    return;
  }

  if (value && typeof value === "object") {
    if ("children" in value) {
      const combined = cleanReactText(flattenReactText(value.children));
      if (looksReadable(combined)) chunks.push(combined);
    }

    for (const item of Object.values(value)) collectReadableStrings(item, chunks);
    return;
  }

  if (typeof value !== "string") return;

  collectNumberedReactArrays(value, chunks);

  if (looksReadable(value)) chunks.push(value);

  for (const match of value.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`);
      if (looksReadable(decoded)) chunks.push(decoded);
    } catch {
      // Ignore malformed string fragments inside framework payloads.
    }
  }
}

function collectNumberedReactArrays(value, chunks) {
  for (const line of value.split("\n")) {
    const match = line.match(/^\s*\d+:(\[[\s\S]*\])\s*$/);
    if (!match) continue;

    try {
      const parsed = JSON.parse(match[1]);
      const text = cleanReactText(flattenReactText(parsed));
      if (looksReadable(text)) chunks.push(text);
    } catch {
      // Ignore framework payload fragments that are not standalone JSON arrays.
    }
  }
}

function flattenReactText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value[0] === "$" && value[3] && typeof value[3] === "object" && "children" in value[3]) {
      return flattenReactText(value[3].children);
    }
    return value.map((item) => flattenReactText(item)).join(" ");
  }
  if (value && typeof value === "object" && "children" in value)
    return flattenReactText(value.children);
  return "";
}

function cleanReactText(text) {
  return text
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function looksReadable(value) {
  const text = value.trim();
  if (text.length < 12 || text.length > 500) return false;
  if (!/[a-z]/i.test(text) || !/[\s.!?,:;]/.test(text)) return false;
  if (/^(className|children|static\/chunks|lucide|payload-richtext)$/i.test(text)) return false;
  if (/static\/chunks|\?dpl=|\.js\?|\.css\?|data:image/i.test(text)) return false;
  if (
    /^[/#$]|className|props:|var\(--|\b(flex|grid|rounded|border|foreground|background|lucide|col-span|items-center|text-muted)\b/i.test(
      text,
    )
  )
    return false;
  if (/^(\d+:)?"?\$Sreact\.fragment"?$/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)) return false;
  if (/^[mlhvcsqtaz0-9 .-]+$/i.test(text)) return false;
  if (/^Sorry, we couldn't find|^It might have been moved/i.test(text)) return false;
  if (/^[a-z]/.test(text)) return false;
  if (/^[A-Za-z0-9.,]+$/.test(text)) return false;
  if (/^[a-z0-9_-]{8,}$/i.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  return true;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLessonLines(lines) {
  const lessonLines = [];
  const seen = new Set();

  for (const line of lines) {
    if (!isLessonLine(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lessonLines.push(line);
    if (lessonLines.length >= 240) break;
  }

  return trimToLessonStart(lessonLines);
}

function trimToLessonStart(lines) {
  const startIndex = lines.findIndex((line) => /^Welcome to a course on\b/i.test(line));
  return startIndex >= 0 ? lines.slice(startIndex) : lines;
}

function isLessonLine(line) {
  if (line.length < 20 || line.length > 1000) return false;
  if (/^#{1,4}\s+/.test(line)) return false;
  if (/^(StarComplete|Ask AI|Subscribe|Get Premium|Loading|Aa\b|Toggle theme)/i.test(line))
    return false;
  if (
    /static\/chunks|\?dpl=|\.js\?|\.css\?|data:image|^Learn Practice Newsletter Resources$/i.test(
      line,
    )
  )
    return false;
  if (
    /^[/#$]|className|props:|var\(--|\b(flex|grid|rounded|border|foreground|background|lucide|col-span|items-center|text-muted|mx-auto|max-w|w-full)\b/i.test(
      line,
    )
  )
    return false;
  if (/^(\d+:)?"?\$Sreact\.fragment"?$/i.test(line)) return false;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line)) return false;
  if (/^[mlhvcsqtaz0-9 .-]+$/i.test(line)) return false;
  if (/^Sorry, we couldn't find|^It might have been moved/i.test(line)) return false;
  if (/^[A-Za-z0-9.,]+$/.test(line)) return false;
  if (/^[.,!?;:]/.test(line)) return false;
  if (/^https?:\/\//i.test(line)) return false;
  if (line.endsWith("?") && line.split(/\s+/).length <= 6) return false;
  return /[.!?]$/.test(line) || line.includes(":") || line.includes("—");
}

function extractClaimCandidates(lines) {
  const candidates = [];
  const seen = new Set();

  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line)) continue;
    if (/^(StarComplete|Ask AI|Subscribe|Get Premium|Loading|Aa\b|Toggle theme)/i.test(line))
      continue;
    if (
      /static\/chunks|\?dpl=|\.js\?|\.css\?|data:image|^Learn Practice Newsletter Resources$/i.test(
        line,
      )
    )
      continue;

    const sentenceParts = line
      .replace(/^[-*]\s+/, "")
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const sentence of sentenceParts) {
      if (sentence.length < 35 || sentence.length > 260) continue;
      if (!/[a-z]/i.test(sentence)) continue;
      if (!/[.!?]/.test(sentence)) continue;
      if (
        /static\/chunks|\?dpl=|\.js\?|\.css\?|data:image|^Learn Practice Newsletter Resources$/i.test(
          sentence,
        )
      )
        continue;
      if (
        /^[/#$]|className|props:|var\(--|\b(flex|grid|rounded|border|foreground|background|lucide|col-span|items-center|text-muted)\b/i.test(
          sentence,
        )
      )
        continue;
      if (/^[mlhvcsqtaz0-9 .-]+$/i.test(sentence)) continue;
      if (/^Sorry, we couldn't find|^It might have been moved/i.test(sentence)) continue;
      if (/^[a-z]/.test(sentence)) continue;
      if (/^[A-Za-z0-9.,]+$/.test(sentence)) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(sentence);
      if (candidates.length >= 120) return candidates;
    }
  }

  return candidates;
}

function extractImages(html, source) {
  const images = [];
  const seen = new Set();

  for (const imgMatch of html.matchAll(/<img\b([^>]*)>/gi)) {
    addImage(images, seen, attr(imgMatch[1], "src"), attr(imgMatch[1], "alt"), source);
  }

  for (const srcMatch of html.matchAll(/"src":"(\/api\/media\/file\/[^"]+)"/g)) {
    addImage(images, seen, srcMatch[1], "", source);
  }

  return images;
}

function attr(attributes, name) {
  const match = attributes.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function addImage(images, seen, src, alt, source) {
  if (!src) return;
  const resolved = resolveAssetUrl(src, source);
  if (!resolved || shouldSkipImage(resolved, alt)) return;
  if (seen.has(resolved)) return;
  seen.add(resolved);
  images.push({ src: resolved, alt: alt || "AlgoMaster lesson image" });
}

function resolveAssetUrl(src, source) {
  try {
    if (/^https?:\/\//i.test(src)) return src;
    if (/^data:/i.test(src)) return "";
    if (/^https?:\/\//i.test(source)) return new URL(src, source).href;
    return src;
  } catch {
    return "";
  }
}

function shouldSkipImage(src, alt) {
  const haystack = `${src} ${alt}`.toLowerCase();
  return /favicon|og-image|logo|profile|avatar|ashishps-profile-pic|algomaster\.5d24c26f/.test(
    haystack,
  );
}

function detectAccessWarning(text) {
  const lower = text.toLowerCase();
  if (lower.includes("subscribe to unlock") || lower.includes("get premium")) {
    return "Page may be partially locked. Re-run with authorized access or use a local export if you are entitled to the content.";
  }
  if (lower.includes("sign in") && lower.includes("premium")) {
    return "Page appears to require sign-in for full content.";
  }
  return "";
}

function buildMarkdown(pages) {
  const chunks = [];

  pages.forEach((page, index) => {
    if (index > 0) chunks.push("\n---\n");
    chunks.push(`# ${page.title}`);
    chunks.push("");

    if (page.canonicalMarkdown) {
      chunks.push(page.canonicalMarkdown);
      chunks.push("");
    } else if (page.lessonLines.length === 0) {
      chunks.push(
        "No lesson text extracted. Check whether the page needs authenticated access or a local export.",
      );
      chunks.push("");
    } else {
      for (const line of page.lessonLines) {
        chunks.push(line);
        chunks.push("");
      }
    }

    if (page.images.length > 0) {
      chunks.push("## Images");
      chunks.push("");
      for (const image of page.images) {
        chunks.push(`![${escapeImageAlt(image.alt)}](${image.src})`);
        chunks.push("");
      }
    }
  });

  return `${chunks
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function escapeImageAlt(alt) {
  return alt.replace(/[[\]]/g, "").trim() || "AlgoMaster lesson image";
}

// ---- course mode ----------------------------------------------------------

async function runCourseIntake(args) {
  const courseUrl = parseFetchUrl(args.courseUrl);
  const courseSlug = courseSlugFromUrl(courseUrl);
  if (!courseSlug) throw new Error(`could not derive course slug from ${courseUrl.href}`);

  console.log(`reading sidebar from ${courseUrl.href}`);
  const seedHtml = await fetchRaw(courseUrl, args.browser);
  const structure = extractCourseStructure(seedHtml);
  if (!structure || structure.sections.length === 0) {
    throw new Error(`no sidebar sections found in ${courseUrl.href}`);
  }

  const baseDir = args.courseOutDir
    ? resolvePath(args.courseOutDir)
    : join(defaultOutDir, courseSlug);
  const courseTitle = structure.courseTitle || courseSlug;
  console.log(`course: ${courseTitle} (${courseSlug}) -> ${relative(repoRoot, baseDir)}`);

  const indexLines = [
    `# ${courseTitle}`,
    "",
    `Source: ${courseUrl.origin}/learn/${courseSlug}`,
    "",
  ];
  let written = 0;
  let skipped = 0;
  let processed = 0;

  for (const [sectionIdx, section] of structure.sections.entries()) {
    const sectionDirName = `${pad2(sectionIdx + 1)}-${slugify(section.id || section.title)}`;
    const sectionDir = join(baseDir, sectionDirName);
    indexLines.push(`## ${section.title}`, "");

    const sectionIndexLines = [`# ${section.title}`, ""];
    for (const [chapterIdx, chapter] of section.chapters.entries()) {
      if (!chapter.link) continue;
      if (args.freeOnly && chapter.isPremium) {
        sectionIndexLines.push(`- ${chapter.title} (premium, skipped)`);
        indexLines.push(`- ${chapter.title} (premium, skipped)`);
        skipped += 1;
        continue;
      }
      if (args.limit && processed >= args.limit) break;
      processed += 1;

      const chapterSlug = slugify(basename(chapter.link)) || slugify(chapter.title);
      const fileName = `${pad2(chapterIdx + 1)}-${chapterSlug}.md`;
      const filePath = join(sectionDir, fileName);
      const courseRelPath = `${sectionDirName}/${fileName}`;
      const chapterUrl = new URL(chapter.link, courseUrl);

      if (!args.force && (await fileExists(filePath))) {
        sectionIndexLines.push(`- [${chapter.title}](${fileName})`);
        indexLines.push(`- [${chapter.title}](${courseRelPath})`);
        skipped += 1;
        continue;
      }

      try {
        const page = await fetchPage(chapterUrl.href, args.browser);
        const md = buildMarkdown([{ ...page, title: chapter.title }]);
        await mkdir(sectionDir, { recursive: true });
        await writeFile(filePath, md, "utf8");
        written += 1;
        console.log(`  wrote ${relative(repoRoot, filePath)}`);
        sectionIndexLines.push(`- [${chapter.title}](${fileName})`);
        indexLines.push(`- [${chapter.title}](${courseRelPath})`);
      } catch (err) {
        console.warn(`  failed ${chapterUrl.href}: ${err.message}`);
        sectionIndexLines.push(`- ${chapter.title} (fetch failed)`);
        indexLines.push(`- ${chapter.title} (fetch failed)`);
      }

      if (args.delayMs > 0) await delay(args.delayMs);
    }

    if (sectionIndexLines.length > 2) {
      await mkdir(sectionDir, { recursive: true });
      await writeFile(join(sectionDir, "_index.md"), `${sectionIndexLines.join("\n")}\n`, "utf8");
    }
    indexLines.push("");
  }

  await mkdir(baseDir, { recursive: true });
  await writeFile(join(baseDir, "_index.md"), `${indexLines.join("\n").trim()}\n`, "utf8");
  console.log(
    `course intake complete: ${written} written, ${skipped} skipped, root ${relative(repoRoot, baseDir)}/_index.md`,
  );
}

async function fetchRaw(url, useBrowser = false) {
  if (useBrowser) {
    const pageData = await fetchBrowser(url.href);
    return pageData.raw;
  }

  const hasCredentials = Boolean(
    process.env.ALGOMASTER_COOKIE || process.env.ALGOMASTER_AUTHORIZATION,
  );
  let current = url;
  for (let i = 0; i < 5; i += 1) {
    if (hasCredentials) assertCredentialSafeUrl(current);
    const response = await fetch(current, {
      headers: buildFetchHeaders(current, hasCredentials),
      redirect: "manual",
    });
    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`redirect without Location for ${current.href}`);
      current = new URL(location, current);
      continue;
    }
    return await response.text();
  }
  throw new Error(`too many redirects fetching ${url.href}`);
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function courseSlugFromUrl(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const learnIdx = parts.indexOf("learn");
  if (learnIdx === -1 || !parts[learnIdx + 1]) return "";
  return parts[learnIdx + 1];
}

function extractCourseStructure(html) {
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    let decoded;
    try {
      decoded = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    const sectionsIdx = decoded.indexOf('"sections":[');
    if (sectionsIdx === -1) continue;

    const arrStart = decoded.indexOf("[", sectionsIdx);
    const arrJson = readBalancedArray(decoded, arrStart);
    if (!arrJson) continue;
    let sections;
    try {
      sections = JSON.parse(arrJson);
    } catch {
      continue;
    }
    if (!Array.isArray(sections) || sections.length === 0) continue;

    const before = decoded.slice(Math.max(0, sectionsIdx - 400), sectionsIdx);
    const titleMatch = before.match(/"title":"([^"\\]+)"\s*,\s*$/);
    const courseTitle = titleMatch ? titleMatch[1] : "";

    return {
      courseTitle,
      sections: sections
        .filter((s) => s && Array.isArray(s.chapters))
        .map((s) => ({
          id: typeof s.id === "string" ? s.id : "",
          title: typeof s.title === "string" ? s.title : "",
          chapters: s.chapters
            .filter((c) => c && typeof c === "object")
            .map((c) => ({
              id: typeof c.id === "string" ? c.id : "",
              title: typeof c.title === "string" ? c.title : "",
              link: typeof c.link === "string" ? c.link : "",
              isPremium: Boolean(c.isPremium),
            })),
        })),
    };
  }
  return null;
}

function readBalancedArray(str, start) {
  if (str[start] !== "[") return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

async function closeBrowser() {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
    globalBrowserContext = null;
  }
}

async function getBrowserContext() {
  if (globalBrowserContext) return globalBrowserContext;

  const { chromium } = await import("playwright");
  globalBrowser = await chromium.launch({ headless: true });

  const extraHTTPHeaders = {};
  if (process.env.ALGOMASTER_AUTHORIZATION) {
    extraHTTPHeaders["authorization"] = process.env.ALGOMASTER_AUTHORIZATION;
  }

  globalBrowserContext = await globalBrowser.newContext({
    extraHTTPHeaders,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  if (process.env.ALGOMASTER_COOKIE) {
    const cookies = process.env.ALGOMASTER_COOKIE.split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return null;
        const name = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!name) return null;
        return { name, value, domain: "algomaster.io", path: "/", secure: true };
      })
      .filter(Boolean);

    await globalBrowserContext.addCookies(cookies);
  }

  return globalBrowserContext;
}

async function fetchBrowser(url) {
  const context = await getBrowserContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!response) {
      throw new Error(`no response received for ${url}`);
    }
    const status = response.status();
    const statusText = response.statusText();
    const contentType = response.headers()["content-type"] || "";

    if (status >= 400) {
      console.warn(`warning: browser fetched ${url} with status ${status} ${statusText}`);
    }

    const raw = await response.text();
    return {
      source: url,
      status: `${status} ${statusText}`.trim(),
      contentType,
      raw,
    };
  } finally {
    await page.close();
  }
}
