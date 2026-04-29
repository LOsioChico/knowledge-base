# Audit I — Headline matches code

Every section heading, callout title (`> [!example]- ...`), and prose sentence that immediately
precedes a fenced code block must accurately describe what the code does. A title that promises
a technique the snippet doesn't actually demonstrate is a high-severity bug — readers copy code
believing it does what the title says.

Real example caught in the wild: a callout titled "Module-bound logger that injects a service"
with code that did `private readonly logger = new Logger("HTTP")` — a hand-rolled `new`, no DI,
no injected service. The class was `@Injectable` (so it COULD inject later), but the snippet
didn't. Title promised injection; code showed instantiation.

Common promise-vs-reality mismatches:

| Title promises | Code must show |
| --- | --- |
| "...that injects X" / "Using DI to..." | A constructor parameter that resolves X from the container |
| "Async X" / "With await" | At least one `await` or returned `Promise` |
| "Custom X with config" | A non-default options object passed in |
| "Validated X" | A validation decorator, pipe, or explicit check |
| "Scoped" / "Per-request" / "Singleton" | The matching `Scope.X` enum value |
| "Guarded" / "Protected" | `@UseGuards` or guard registration |
| "Streaming" | A stream API, not buffering into memory |
| "Cached" | An actual cache call |

Audit procedure:

1. For every `##` / `###` heading, callout title, and one-line prose intro before a fenced block
   in the diff, extract the **specific behavioral claim** (not the topic — the verb).
2. Read the code that follows. Does it do that thing?
   - **Yes** → keep.
   - **No** → either rewrite the code to match the title (preferred when the title's promise is
     the actual lesson) or rename the title/intro to honestly describe what the snippet shows
     (preferred when the snippet is intentionally a stepping-stone).
3. Be conservative: "here's how X works" is a soft promise; "X that does Y" is a hard one.
   Flag only hard promises.

This audit pairs with [Audit A](A-code-examples.md): A checks the code is *complete*, I checks it
is *honest*.
