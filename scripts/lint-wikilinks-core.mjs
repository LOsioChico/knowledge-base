import { readFile, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import matter from "gray-matter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

export const DEFAULT_INDEXED_FOLDERS = [{ area: "nestjs", folder: "recipes" }]

const SIMILARITY_THRESHOLD = 0.2
const ADVISORY_SIMILARITY_THRESHOLD = 0.16

const VALID_STATUSES = new Set(["seed", "draft", "evergreen", "archived"])
const VALID_TAGS = new Set([
  "type/moc",
  "type/concept",
  "type/recipe",
  "type/pattern",
  "type/gotcha",
  "type/reference",
  "tech/typescript",
  "tech/rxjs",
  "tech/multer",
  "tech/http",
  "tech/kafka",
  "tech/prisma",
  "tech/jwt",
  "tech/class-validator",
  "tech/class-transformer",
  "tech/asynclocalstorage",
  "tech/nestjs-cls",
  "lifecycle",
  "events",
  "cqrs",
  "messaging",
  "streaming",
  "validation",
  "errors",
])

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "man",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "boy",
  "did",
  "its",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "this",
  "that",
  "with",
  "have",
  "from",
  "they",
  "been",
  "were",
  "their",
  "would",
  "there",
  "what",
  "about",
  "which",
  "when",
  "your",
  "will",
  "into",
  "some",
  "than",
  "then",
  "them",
  "these",
  "those",
  "such",
  "also",
  "just",
  "only",
  "other",
  "most",
  "more",
  "much",
  "very",
  "even",
  "each",
  "any",
  "both",
  "either",
  "here",
  "where",
  "while",
  "before",
  "after",
  "between",
  "during",
  "through",
  "above",
  "below",
  "under",
  "over",
  "because",
  "since",
  "until",
  "though",
  "although",
  "however",
  "thus",
  "hence",
  "therefore",
  "indeed",
  "first",
  "second",
  "third",
  "next",
  "last",
  "previous",
  "another",
  "every",
  "many",
  "few",
  "several",
  "still",
  "yet",
  "may",
  "might",
  "must",
  "should",
  "could",
  "would",
  "shall",
  "does",
  "doing",
  "done",
  "being",
  "able",
  "make",
  "made",
  "makes",
  "making",
  "want",
  "need",
  "like",
  "look",
  "find",
  "give",
  "take",
  "know",
  "think",
  "thing",
  "things",
  "case",
  "cases",
  "example",
  "examples",
  "note",
  "notes",
  "section",
  "chapter",
  "page",
  "site",
])

const markdownParser = unified().use(remarkParse).use(remarkGfm)

async function walkFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walkFiles(path)))
    else if (entry.isFile() && path.endsWith(".md")) out.push(path)
  }
  return out
}

async function walkDirs(dir) {
  const out = [dir]
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...(await walkDirs(join(dir, entry.name))))
  }
  return out
}

function countNewlines(text) {
  return (text.match(/\n/g) ?? []).length
}

function findBodyStart(src) {
  if (!src.startsWith("---\n")) return 0
  const end = src.indexOf("\n---\n", 4)
  if (end === -1) return 0
  return end + 5
}

function parseFrontmatter(src) {
  const bodyStart = findBodyStart(src)
  const body = src.slice(bodyStart)
  const bodyStartLine = countNewlines(src.slice(0, bodyStart))
  try {
    const parsed = matter(src)
    return {
      body,
      bodyStartLine,
      data: parsed.data ?? {},
      hasFrontmatter: src.startsWith("---\n") && bodyStart > 0,
      parseError: null,
    }
  } catch (error) {
    return {
      body,
      bodyStartLine,
      data: {},
      hasFrontmatter: src.startsWith("---\n") && bodyStart > 0,
      parseError: error.message,
    }
  }
}

function copyRange(mask, source, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return
  for (let i = Math.max(0, start); i < Math.min(source.length, end); i++) {
    mask[i] = source[i]
  }
}

function buildProseMask(body) {
  const mask = Array(body.length).fill(" ")
  let tree
  try {
    tree = markdownParser.parse(body)
  } catch {
    return mask.join("")
  }

  const walk = (node, ancestors) => {
    const excluded = ancestors.some((ancestor) =>
      new Set(["definition", "image", "imageReference", "link", "linkReference"]).has(
        ancestor.type,
      ),
    )
    if (node.type === "text" && !excluded) {
      copyRange(mask, body, node.position?.start?.offset, node.position?.end?.offset)
    }
    for (const child of node.children ?? []) walk(child, [...ancestors, node])
  }

  walk(tree, [])
  return mask.join("")
}

function lineColFor(src, idx) {
  let line = 1
  let col = 1
  for (let i = 0; i < idx; i++) {
    if (src[i] === "\n") {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function asArray(value) {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function cleanScalar(value) {
  return String(value)
    .trim()
    .replace(/^['"]|['"]$/g, "")
}

function parseWikilink(raw) {
  const inner = raw.replace(/^\[\[|\]\]$/g, "")
  const [targetWithAnchor, alias = ""] = inner.split("|")
  const [target] = targetWithAnchor.split("#")
  return {
    alias: alias.trim(),
    raw,
    target: target.trim().replace(/\\$/, ""),
    planned: /\(planned\)/i.test(alias) || /\(planned\)/i.test(inner),
  }
}

function normalizeTarget(raw) {
  const parsed = parseWikilink(raw.startsWith("[[") ? raw : `[[${raw}]]`)
  let target = parsed.target
    .replace(/^content\//, "")
    .replace(/^\.\/?/, "")
    .replace(/^\.\.\//, "")
    .replace(/\.md$/, "")
    .replace(/\/$/, "")
  return target
}

function resolveTarget(raw, notesBySlug) {
  const normalized = normalizeTarget(raw)
  if (!normalized) return { candidates: [], normalized, target: null }
  if (notesBySlug.has(normalized))
    return { candidates: [normalized], normalized, target: normalized }
  const candidates = [...notesBySlug.keys()].filter(
    (slug) => slug === normalized || slug.endsWith(`/${normalized}`),
  )
  return {
    candidates,
    normalized,
    target: candidates.length === 1 ? candidates[0] : null,
  }
}

function bodyWikilinks(note, notesBySlug) {
  const out = []
  for (const match of note.body.matchAll(/\[\[[^\]]+\]\]/g)) {
    const raw = match[0]
    const start = match.index
    const end = start + raw.length
    if (!note.proseMask.slice(start, end).includes("[[")) continue
    const parsed = parseWikilink(raw)
    const resolution = resolveTarget(raw, notesBySlug)
    const { line, col } = lineColFor(note.body, start)
    out.push({
      ...parsed,
      ...resolution,
      col,
      end,
      line: line + note.bodyStartLine,
      start,
    })
  }
  return out
}

function frontmatterWikilinks(note, key, notesBySlug) {
  return asArray(note.data[key]).map((value) => {
    const raw = cleanScalar(value)
    const parsed = parseWikilink(raw.startsWith("[[") ? raw : `[[${raw}]]`)
    const resolution = resolveTarget(parsed.raw, notesBySlug)
    return { ...parsed, ...resolution, field: key }
  })
}

function isIndexNote(note) {
  return note.baseName === "index"
}

function isRootIndex(note) {
  return note.rel === "index"
}

function addViolation(result, violation) {
  result.violations.push({ severity: "error", ...violation })
}

function addDecision(result, violation) {
  result.violations.push({ severity: "decision", ...violation })
}

function addWarning(result, warning) {
  result.warnings.push({ severity: "warning", ...warning })
}

function validateSchema(result, notes) {
  for (const note of notes) {
    const data = note.data
    if (note.parseError) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: `frontmatter could not be parsed: ${note.parseError}`,
      })
      continue
    }
    if (!note.hasFrontmatter) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "missing YAML frontmatter",
      })
      continue
    }
    if (typeof data.title !== "string" || data.title.trim() === "") {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "missing required string field `title`",
      })
    }
    if (!Array.isArray(data.aliases)) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "`aliases` must be an array",
      })
    }
    if (!Array.isArray(data.tags) || data.tags.length === 0) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "`tags` must be a non-empty array",
      })
    } else {
      for (const tag of data.tags) {
        if (!VALID_TAGS.has(tag)) {
          addViolation(result, {
            check: "frontmatter-schema",
            file: note.file,
            line: 1,
            message: `unknown tag \`${tag}\``,
          })
        }
      }
      if (!data.tags.some((tag) => String(tag).startsWith("type/"))) {
        addViolation(result, {
          check: "frontmatter-schema",
          file: note.file,
          line: 1,
          message: "`tags` must include one `type/*` tag",
        })
      }
    }
    if (!VALID_STATUSES.has(data.status)) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "`status` must be one of seed, draft, evergreen, archived",
      })
    }
    if (!("related" in data)) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "missing required field `related`",
      })
    } else if (data.related !== null && !Array.isArray(data.related)) {
      addViolation(result, {
        check: "frontmatter-schema",
        file: note.file,
        line: 1,
        message: "`related` must be an array or an empty field",
      })
    }
    if (!isRootIndex(note)) {
      const area = note.rel.split("/")[0]
      if (data.area !== area) {
        addViolation(result, {
          check: "frontmatter-schema",
          file: note.file,
          line: 1,
          message: `\`area\` must be \`${area}\` to match the top-level folder`,
        })
      }
    }
  }
}

function validateLinkResolution(result, notes) {
  for (const note of notes) {
    const refs = [...note.bodyLinks, ...note.relatedRefs, ...note.unrelatedRefs]
    for (const ref of refs) {
      if (ref.planned) continue
      if (ref.candidates.length === 0) {
        addViolation(result, {
          check: "wikilink-targets",
          col: ref.col,
          file: note.file,
          line: ref.line ?? 1,
          message: `${ref.field ?? "body"} wikilink ${ref.raw} does not resolve to any note`,
        })
      } else if (ref.candidates.length > 1) {
        addViolation(result, {
          candidates: ref.candidates,
          check: "wikilink-targets",
          col: ref.col,
          file: note.file,
          line: ref.line ?? 1,
          message: `${ref.field ?? "body"} wikilink ${ref.raw} is ambiguous: ${ref.candidates.join(", ")}`,
        })
      }
    }
    for (const ref of note.relatedRefs) {
      if (ref.target === note.slug) {
        addViolation(result, {
          check: "wikilink-targets",
          file: note.file,
          line: 1,
          message: "`related` must not link to the note itself",
        })
      }
    }
  }
}

function buildConcepts(notes) {
  return notes
    .filter((note) => !isIndexNote(note))
    .map((note) => {
      const terms = []
      const seen = new Set()
      const add = (term) => {
        const normalized = String(term ?? "").trim()
        const key = normalized.toLowerCase()
        if (normalized.length < 3 || seen.has(key)) return
        seen.add(key)
        terms.push(normalized)
      }
      add(note.title)
      for (const alias of note.aliases) add(alias)
      add(note.baseName.replace(/-/g, " "))
      terms.sort((a, b) => b.length - a.length)
      return { slug: note.slug, terms }
    })
}

function matchTerm(mask, term) {
  const re = new RegExp(`\\b${escapeRe(term)}\\b`, "i")
  const match = mask.match(re)
  if (!match) return null
  return { index: match.index, term: match[0] }
}

function linkContainsTargetAt(note, index, targetSlug) {
  return note.bodyLinks.some(
    (link) => link.start <= index && index < link.end && link.target === targetSlug,
  )
}

function validateFirstMentions(result, notes) {
  const concepts = buildConcepts(notes)
  for (const source of notes) {
    for (const concept of concepts) {
      if (source.slug === concept.slug) continue
      const matches = concept.terms.map((term) => matchTerm(source.proseMask, term)).filter(Boolean)
      if (matches.length === 0) continue
      matches.sort((a, b) => a.index - b.index)
      const first = matches[0]
      if (linkContainsTargetAt(source, first.index, concept.slug)) continue
      const { line, col } = lineColFor(source.body, first.index)
      addViolation(result, {
        check: "first-mention",
        col,
        file: source.file,
        line: line + source.bodyStartLine,
        message: `\"${first.term}\" should link to [[${concept.slug}|${first.term}]]`,
        target: concept.slug,
        term: first.term,
      })
    }
  }
}

function validateFolderIndexes(result, contentRoot, dirs, fileSet, repoRoot) {
  for (const dir of dirs) {
    const indexPath = join(dir, "index.md")
    if (!fileSet.has(indexPath)) {
      addViolation(result, {
        check: "folder-indexes",
        file: relative(repoRoot, dir).split(sep).join("/"),
        line: 1,
        message: "folder under content/ is missing index.md",
      })
    }
  }
}

async function validateListingCompleteness(result, notes, repoRoot, indexedFolders) {
  const llmsTxtPath = join(repoRoot, "quartz", "static", "llms.txt")
  let llmsTxt = null
  try {
    llmsTxt = await readFile(llmsTxtPath, "utf8")
  } catch {
    addViolation(result, {
      check: "listing-completeness",
      file: "quartz/static/llms.txt",
      line: 1,
      message: "missing llms.txt",
    })
  }

  for (const { area, folder } of indexedFolders) {
    const areaIndex = notes.find((note) => note.rel === `${area}/index`)
    const folderIndex = `${area}/${folder}/index`
    const folderNotes = notes.filter(
      (note) => note.rel.startsWith(`${area}/${folder}/`) && note.rel !== folderIndex,
    )
    for (const folderNote of folderNotes) {
      const areaTargets = new Set(areaIndex?.bodyLinks.map((link) => link.target).filter(Boolean))
      if (areaIndex && !areaTargets.has(folderNote.slug)) {
        addViolation(result, {
          check: "listing-completeness",
          file: areaIndex.file,
          line: 1,
          message: `missing entry for [[${folderNote.rel}]] (new ${folder.replace(/s$/, "")} not listed in area index)`,
        })
      }
      if (llmsTxt !== null && !llmsTxt.includes(folderNote.rel)) {
        addViolation(result, {
          check: "listing-completeness",
          file: "quartz/static/llms.txt",
          line: 1,
          message: `missing entry for ${folderNote.rel}`,
        })
      }
    }
  }
}

function validateRelatedSymmetry(result, notesBySlug, notes) {
  for (const note of notes) {
    if (isIndexNote(note)) continue
    for (const targetSlug of note.relatedSlugs) {
      const target = notesBySlug.get(targetSlug)
      if (!target || isIndexNote(target)) continue
      if (!target.relatedSlugs.includes(note.slug)) {
        addViolation(result, {
          check: "related-symmetry",
          file: target.file,
          line: 1,
          message: `missing back-reference: \`related:\` should include \"[[${note.slug}]]\" (because [[${note.slug}]] lists [[${targetSlug}]])`,
        })
      }
    }
  }
}

function validateRelationshipConsistency(result, notesBySlug, notes) {
  for (const note of notes) {
    if (isIndexNote(note)) continue
    const related = new Set(note.relatedSlugs)
    for (const link of note.bodyLinks) {
      if (!link.target) continue
      const target = notesBySlug.get(link.target)
      if (!target || isIndexNote(target)) continue
      if (!related.has(link.target)) {
        addViolation(result, {
          check: "relationship-consistency",
          col: link.col,
          file: note.file,
          line: link.line,
          message: `body wikilink [[${link.target}]] should also be listed in related:`,
        })
      }
    }
  }
}

function validateOrphans(result, notes) {
  const inbound = new Map(notes.map((note) => [note.slug, 0]))
  for (const note of notes) {
    for (const link of note.bodyLinks) {
      if (link.target && link.target !== note.slug)
        inbound.set(link.target, (inbound.get(link.target) ?? 0) + 1)
    }
    for (const target of note.relatedSlugs) {
      if (target !== note.slug) inbound.set(target, (inbound.get(target) ?? 0) + 1)
    }
  }
  for (const note of notes) {
    if (isIndexNote(note)) continue
    if ((inbound.get(note.slug) ?? 0) === 0) {
      addViolation(result, {
        check: "orphans",
        file: note.file,
        line: 1,
        message: "note has no inbound body wikilink, related link, or MOC listing",
      })
    }
  }
}

function tokenize(text) {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
  const ngrams = []
  for (let i = 0; i < words.length - 1; i++) ngrams.push(`${words[i]} ${words[i + 1]}`)
  for (let i = 0; i < words.length - 2; i++)
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  return [...words, ...ngrams]
}

function buildTfIdf(notes) {
  const indexableNotes = notes.filter((note) => !isIndexNote(note))
  const tfMaps = new Map()
  const docFreq = new Map()
  for (const note of indexableNotes) {
    const tf = new Map()
    const add = (text, weight) => {
      for (const token of tokenize(text)) tf.set(token, (tf.get(token) ?? 0) + weight)
    }
    add(note.title ?? "", 3)
    for (const alias of note.aliases) add(alias, 2)
    add(note.proseMask, 1)
    tfMaps.set(note.slug, tf)
    for (const token of tf.keys()) docFreq.set(token, (docFreq.get(token) ?? 0) + 1)
  }
  const idf = new Map()
  for (const [token, df] of docFreq)
    idf.set(token, Math.log((indexableNotes.length + 1) / (df + 1)) + 1)
  const vecs = new Map()
  const norms = new Map()
  for (const [slug, tf] of tfMaps) {
    const vec = new Map()
    let normSq = 0
    for (const [token, freq] of tf) {
      const weight = freq * idf.get(token)
      vec.set(token, weight)
      normSq += weight * weight
    }
    vecs.set(slug, vec)
    norms.set(slug, Math.sqrt(normSq))
  }
  return { indexableNotes, vecs, norms }
}

function cosine(aSlug, bSlug, vecs, norms) {
  const a = vecs.get(aSlug)
  const b = vecs.get(bSlug)
  const nA = norms.get(aSlug)
  const nB = norms.get(bSlug)
  if (!a || !b || !nA || !nB) return 0
  const [small, large] = a.size < b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [token, weight] of small) {
    const other = large.get(token)
    if (other) dot += weight * other
  }
  return dot / (nA * nB)
}

function sharedTerms(aSlug, bSlug, vecs) {
  const a = vecs.get(aSlug)
  const b = vecs.get(bSlug)
  if (!a || !b) return []
  const terms = []
  for (const [token, weight] of a) {
    const other = b.get(token)
    if (other) terms.push({ score: weight * other, token })
  }
  return terms
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((term) => term.token)
}

function validateDiscoverability(result, notes) {
  const { indexableNotes, vecs, norms } = buildTfIdf(notes)
  const refsCache = new Map()
  const unrelatedCache = new Map()
  const scores = []
  for (const note of indexableNotes) {
    refsCache.set(note.slug, new Set([...note.relatedSlugs, ...note.bodyLinkSlugs]))
    unrelatedCache.set(note.slug, new Set(note.unrelatedSlugs))
  }
  const slugs = indexableNotes.map((note) => note.slug)
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i]
      const b = slugs[j]
      const score = cosine(a, b, vecs, norms)
      scores.push(score)
      if (refsCache.get(a).has(b) || refsCache.get(b).has(a)) continue
      if (unrelatedCache.get(a).has(b) || unrelatedCache.get(b).has(a)) continue
      const terms = sharedTerms(a, b, vecs)
      if (score >= SIMILARITY_THRESHOLD) {
        addDecision(result, {
          a,
          b,
          check: "discoverability",
          message: `[[${a}]] and [[${b}]] are unadjudicated semantic neighbors`,
          score,
          sharedTerms: terms,
          suggestedActions: ["related-both-ways", "body-wikilink", "unrelated-opt-out"],
          threshold: SIMILARITY_THRESHOLD,
        })
      } else if (score >= ADVISORY_SIMILARITY_THRESHOLD) {
        addWarning(result, {
          a,
          b,
          check: "discoverability-advisory",
          message: `[[${a}]] and [[${b}]] are near the discoverability threshold`,
          score,
          sharedTerms: terms,
          threshold: ADVISORY_SIMILARITY_THRESHOLD,
        })
      }
    }
  }
  const buckets = {
    "0.00-0.05": 0,
    "0.05-0.10": 0,
    "0.10-0.16": 0,
    "0.16-0.20": 0,
    "0.20+": 0,
  }
  for (const score of scores) {
    if (score >= SIMILARITY_THRESHOLD) buckets["0.20+"]++
    else if (score >= ADVISORY_SIMILARITY_THRESHOLD) buckets["0.16-0.20"]++
    else if (score >= 0.1) buckets["0.10-0.16"]++
    else if (score >= 0.05) buckets["0.05-0.10"]++
    else buckets["0.00-0.05"]++
  }
  result.stats.discoverability = {
    advisoryThreshold: ADVISORY_SIMILARITY_THRESHOLD,
    blockingThreshold: SIMILARITY_THRESHOLD,
    maxScore: scores.length > 0 ? Math.max(...scores) : 0,
    pairCount: scores.length,
    scoreBuckets: buckets,
  }
}

async function validateAgentsMirror(result, repoRoot) {
  try {
    const [agentsSrc, copilotSrc] = await Promise.all([
      readFile(join(repoRoot, "AGENTS.md"), "utf8"),
      readFile(join(repoRoot, ".github", "copilot-instructions.md"), "utf8"),
    ])
    if (agentsSrc !== copilotSrc) {
      addViolation(result, {
        check: "agents-mirror",
        file: ".github/copilot-instructions.md",
        line: 1,
        message: ".github/copilot-instructions.md is out of sync with AGENTS.md (content drift)",
      })
    }
  } catch (error) {
    addViolation(result, {
      check: "agents-mirror",
      file: ".github/copilot-instructions.md",
      line: 1,
      message: `cannot read both AGENTS.md and .github/copilot-instructions.md (${error.code ?? error.message})`,
    })
  }
}

function groupByCheck(items, check) {
  return items.filter((item) => item.check === check)
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm
}

function formatLocation(item) {
  if (!item.file) return ""
  if (item.line && item.col) return `${item.file}:${item.line}:${item.col}`
  if (item.line) return `${item.file}:${item.line}`
  return item.file
}

function printGeneric(stderr, title, items) {
  if (items.length === 0) return
  stderr.push(`\n${title}\n`)
  for (const item of items) {
    const location = formatLocation(item)
    stderr.push(`  ${location}`)
    stderr.push(`    ${item.message}`)
  }
}

export function formatHuman(result) {
  const stdout = []
  const stderr = []
  const errors = result.violations.filter((violation) => violation.severity !== "decision")
  const decisions = result.violations.filter((violation) => violation.severity === "decision")

  const schema = groupByCheck(errors, "frontmatter-schema")
  if (schema.length === 0) stdout.push("✓ frontmatter schema: all notes match required metadata")
  else
    printGeneric(
      stderr,
      `✗ frontmatter schema: ${schema.length} ${plural(schema.length, "violation")}`,
      schema,
    )

  const targetErrors = groupByCheck(errors, "wikilink-targets")
  if (targetErrors.length === 0)
    stdout.push("✓ wikilink targets: all wikilinks resolve unambiguously")
  else
    printGeneric(
      stderr,
      `✗ wikilink targets: ${targetErrors.length} ${plural(targetErrors.length, "violation")}`,
      targetErrors,
    )

  const firstMentions = groupByCheck(errors, "first-mention")
  if (firstMentions.length === 0) {
    stdout.push("✓ wikilink linter: all first mentions are linked")
  } else {
    stderr.push(`✗ wikilink linter: ${firstMentions.length} first-mention violation(s)\n`)
    const byFile = new Map()
    for (const item of firstMentions) {
      if (!byFile.has(item.file)) byFile.set(item.file, [])
      byFile.get(item.file).push(item)
    }
    for (const [file, items] of byFile) {
      stderr.push(`  ${file}`)
      for (const item of items) stderr.push(`    L${item.line}: ${item.message}`)
    }
    stderr.push("\nFix by wrapping the first prose mention in a wikilink.")
  }

  const folderIndexes = groupByCheck(errors, "folder-indexes")
  if (folderIndexes.length === 0) stdout.push("✓ folder-indexes: every content folder has index.md")
  else
    printGeneric(
      stderr,
      `✗ folder-indexes: ${folderIndexes.length} missing index ${plural(folderIndexes.length, "file")}`,
      folderIndexes,
    )

  const listing = groupByCheck(errors, "listing-completeness")
  if (listing.length === 0) {
    stdout.push("✓ listing-completeness: all recipes surfaced in area index and llms.txt")
  } else {
    printGeneric(
      stderr,
      `✗ listing-completeness: ${listing.length} missing ${plural(listing.length, "entry", "entries")}`,
      listing,
    )
  }

  const symmetry = groupByCheck(errors, "related-symmetry")
  if (symmetry.length === 0)
    stdout.push("✓ related: symmetry: all related: links are bidirectional")
  else
    printGeneric(
      stderr,
      `✗ related: symmetry: ${symmetry.length} asymmetric ${plural(symmetry.length, "link")}`,
      symmetry,
    )

  const consistency = groupByCheck(errors, "relationship-consistency")
  if (consistency.length === 0)
    stdout.push("✓ relationship-consistency: body wikilinks are represented in related:")
  else
    printGeneric(
      stderr,
      `✗ relationship-consistency: ${consistency.length} missing related ${plural(consistency.length, "entry", "entries")}`,
      consistency,
    )

  const orphans = groupByCheck(errors, "orphans")
  if (orphans.length === 0) stdout.push("✓ orphans: all non-index notes have inbound references")
  else
    printGeneric(
      stderr,
      `✗ orphans: ${orphans.length} orphan ${plural(orphans.length, "note")}`,
      orphans,
    )

  const discovery = groupByCheck(decisions, "discoverability")
  if (discovery.length === 0) {
    stdout.push(
      `✓ discoverability: no unlinked semantic neighbors above ${SIMILARITY_THRESHOLD.toFixed(2)} similarity`,
    )
  } else {
    stderr.push(
      `\n✗ discoverability: ${discovery.length} unlinked semantic neighbor ${plural(discovery.length, "pair")} above ${SIMILARITY_THRESHOLD.toFixed(2)}\n`,
    )
    for (const item of discovery.sort((a, b) => b.score - a.score)) {
      stderr.push(`  ${item.score.toFixed(3)}  [[${item.a}]]  <->  [[${item.b}]]`)
      stderr.push(`    shared terms: ${item.sharedTerms.join(", ") || "none"}`)
    }
    stderr.push("\nFor each pair, do ONE of the following:")
    stderr.push("  • add [[other]] to `related:` on both sides")
    stderr.push("  • wikilink one to the other in body prose")
    stderr.push("  • add [[other]] under `unrelated:` in EITHER frontmatter")
  }

  const mirror = groupByCheck(errors, "agents-mirror")
  if (mirror.length === 0)
    stdout.push("✓ agents-mirror: .github/copilot-instructions.md matches AGENTS.md")
  else {
    printGeneric(
      stderr,
      "✗ agents-mirror: .github/copilot-instructions.md is out of sync with AGENTS.md",
      mirror,
    )
  }

  if (result.warnings.length > 0) {
    stdout.push(
      `i warnings: ${result.warnings.length} advisory ${plural(result.warnings.length, "item")}`,
    )
  }

  return {
    stderr: stderr.length > 0 ? `${stderr.join("\n")}\n` : "",
    stdout: stdout.length > 0 ? `${stdout.join("\n")}\n` : "",
  }
}

export async function lintVault({
  contentRoot,
  indexedFolders = DEFAULT_INDEXED_FOLDERS,
  repoRoot,
}) {
  const result = {
    ok: true,
    stats: {},
    violations: [],
    warnings: [],
  }

  const files = await walkFiles(contentRoot)
  const dirs = await walkDirs(contentRoot)
  const fileSet = new Set(files)
  const notes = []

  for (const path of files) {
    const src = await readFile(path, "utf8")
    const parsed = parseFrontmatter(src)
    const rel = relative(contentRoot, path).split(sep).join("/").replace(/\.md$/, "")
    const baseName = rel.split("/").pop()
    const data = parsed.data
    notes.push({
      aliases: asArray(data.aliases).map(String),
      baseName,
      body: parsed.body,
      bodyStartLine: parsed.bodyStartLine,
      data,
      file: relative(repoRoot, path).split(sep).join("/"),
      hasFrontmatter: parsed.hasFrontmatter,
      parseError: parsed.parseError,
      path,
      proseMask: buildProseMask(parsed.body),
      rel,
      slug: rel,
      title: typeof data.title === "string" ? data.title : null,
    })
  }

  const notesBySlug = new Map(notes.map((note) => [note.slug, note]))
  for (const note of notes) {
    note.bodyLinks = bodyWikilinks(note, notesBySlug)
    note.relatedRefs = frontmatterWikilinks(note, "related", notesBySlug)
    note.unrelatedRefs = frontmatterWikilinks(note, "unrelated", notesBySlug)
    note.bodyLinkSlugs = note.bodyLinks.map((link) => link.target).filter(Boolean)
    note.relatedSlugs = note.relatedRefs.map((link) => link.target).filter(Boolean)
    note.unrelatedSlugs = note.unrelatedRefs.map((link) => link.target).filter(Boolean)
  }

  result.stats.noteCount = notes.length
  result.stats.nonIndexNoteCount = notes.filter((note) => !isIndexNote(note)).length

  validateSchema(result, notes)
  validateLinkResolution(result, notes)
  validateFirstMentions(result, notes)
  validateFolderIndexes(result, contentRoot, dirs, fileSet, repoRoot)
  await validateListingCompleteness(result, notes, repoRoot, indexedFolders)
  validateRelatedSymmetry(result, notesBySlug, notes)
  validateRelationshipConsistency(result, notesBySlug, notes)
  validateOrphans(result, notes)
  validateDiscoverability(result, notes)
  await validateAgentsMirror(result, repoRoot)

  result.ok = result.violations.length === 0
  return result
}
