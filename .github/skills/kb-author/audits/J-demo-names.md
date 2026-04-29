# Audit J — Demo names match the note's domain

Placeholder names train the reader's eye through repetition. A note that disclaims domain X
in its "When not to" section must not use X as the example name in CLI commands, class names,
file paths, or imagined-scaffolding stubs. The disclaimer in prose loses the fight against the
example in code every time.

Real example caught in the wild: `nestjs/fundamentals/middleware.md` had `nest g mi auth/jwt`
in CLI examples, while the same note's "When not to" section says "Authorization: use a guard."
Reader copies `auth/jwt` as the obvious nested-path demo and walks away with the wrong
association — even though the prose said the opposite.

Audit procedure:

1. Find each note's "When not to / When to reach for it / Why X, not Y" section. List the
   anti-domains (concrete words, not abstractions: "authorization", "validation", "caching",
   "logging", "exception handling").
2. Grep the rest of the note for those words appearing as **placeholder names**: CLI demo paths
   (`nest g mi auth/jwt`), class names (`AuthMiddleware`, `LoggingGuard`), file comments
   (`// auth.middleware.ts`), constructor stubs (`constructor(private auth: AuthService)`).
3. Skip occurrences that are: (a) the disclaimer prose itself, (b) a contrast/comparison table
   row, (c) an explicit "what NOT to do" callout, (d) a wikilink to the correct layer's note.
4. Replace flagged demo names with names from a domain the note **does** endorse. For middleware,
   that's HTTP plumbing (`http/request-id`, `LoggerMiddleware`, `compression`). For guards,
   it's authz (`RolesGuard`, `JwtAuthGuard`). Match the demo to the lesson.

This audit is cheap, catches a high-cost bug (silent miseducation by repetition), and rarely
fires once the vault is consistent. Run it on any note where you're naming things from scratch.
