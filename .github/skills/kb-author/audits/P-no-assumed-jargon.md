# Audit P — No assumed-knowledge jargon

A reader landing on a note for the first time should not need a second tab open to decode it.
Every domain term, acronym, or named feature must be either defined inline at first use,
wikilinked to the note that defines it, or replaced with the plain-English behavior it names.

This audit is the reading-pass complement to Audit A (code-examples) and Audit O
(behavior-in-snippet): those make the *code* stand alone; this makes the *prose* stand alone.

## Trigger phrases (smell, not always wrong)

When you see one of these, stop and check whether the surrounding sentence defines it for a
first-time reader:

- An acronym that hasn't been spelled out yet (`WORM`, `BPA`, `MOC`, `DI`, `SCP`, `STS`).
- A vendor-named feature whose name doesn't describe what it does (`S3 Object Lock`,
  `Nest Pipes`, `CloudFront OAC`, `IAM Permission Boundary`).
- A compressed multi-noun phrase (`last-writer-wins by S3-side timestamp`,
  `concurrent-writer arbitration`, `WORM retention feature for delete/overwrite protection`).
- A term-of-art that has a different meaning in adjacent fields (`pipe`, `guard`, `validator`,
  `lock`, `consumer`, `provider`).

## The three rewrites

### 1. Lead with the observable behavior

Forbidden:

> Two PUTs to the same key resolve last-writer-wins by S3-side timestamp.

Required:

> If two clients PUT to the same key at the same time, both succeed and S3 keeps the one
> with the later internal timestamp.

The reader learns *what happens*, then (optionally) the AWS name for the rule.

### 2. Define acronyms on first use

Forbidden (first mention of WORM in the note):

> S3 Object Lock is a WORM retention feature.

Required:

> S3 Object Lock is a write-once-read-many (WORM) retention feature.

After the first parenthetical definition, bare `WORM` is fine for the rest of the note.

### 3. Promote name-collision traps to sub-bullets

When a feature's name implies the wrong mental model, the correction deserves its own visual
slot, not a tail clause:

Forbidden:

> S3 has no built-in lock for concurrent writers; S3 Object Lock is a WORM retention feature
> for delete/overwrite protection, not concurrent-writer arbitration.

Required:

> S3 has no built-in lock for concurrent writers.
>
> - Don't reach for **S3 Object Lock** here: despite the name, it's a write-once-read-many
>   (WORM) retention feature that prevents delete or overwrite for a fixed period, not a
>   concurrency primitive.

## Audit procedure

1. Re-read each section of the note as if you'd never seen the technology.
2. For each domain term, ask: would a competent engineer who hasn't worked with this exact
   service know what this means?
3. If no, apply one of:
   - Wikilink to the note that defines it (`[[aws/iam|IAM]]` on first mention).
   - Inline definition in 3-10 words (`write-once-read-many (WORM)`).
   - Rewrite around the observable behavior, dropping the named feature entirely if it
     doesn't add information.
4. Trim afterward. Plain-English versions are usually shorter than jargon-stacks once you
   stop chaining qualifiers.

## Boundaries

- This is a **reading-pass** audit, not a structural one. It produces prose edits, not new
  sections.
- Wikilinks discharge the rule: if the term has its own note, the first-mention wikilink IS
  the definition.
- Single domain terms whose name DOES describe what they do (`bucket`, `region`, `endpoint`)
  don't need defining — only the misleading-name and acronym cases do.
- Inside `> [!warning]` / `> [!info]` callouts, terseness wins over completeness; a callout
  can use vocabulary the surrounding section already defined.

## Forbidden / Required examples

The canonical example lives in `AGENTS.md` ("No assumed-knowledge jargon" section): the
S3 concurrent-writers bullet, before and after.
