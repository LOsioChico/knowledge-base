# Audit H — Conceptual sections lead with a mental model

Any section that compares two similar concepts ("X vs Y"), explains a counterintuitive rule
(reversed resolution order, opposite-direction lifecycle), or introduces an abstract layer
should open with a one-sentence concrete analogy or framing **before** the technical details.

Examples that earned their hook:

- "Correlation ID = sticker, trace ID = sticker + GPS tracker" + a `Question → What you need` table.
- "Interceptors are the **sandwich**: bread (pre-phase) → filling (the handler) → bread (post-phase)."
- "Filters are the **last-chance handler**; the most specific filter wins, the global is the safety net."
- "`useGlobal*` is the **shortcut**; `APP_*` is the **DI-aware** version."

The smell: a section heading that's a comparison ("Why X, not Y"), an order/lifecycle rule, or a
"vs" table whose first paragraph dives into jargon (`ExecutionContext`, `useFactory`, `Reflector`,
`Scope.TRANSIENT`) without naming what the reader should picture first.

Audit procedure:

1. Skim every `##` / `###` heading in the diff. Flag any that compares concepts, contrasts a rule
   with the rest of the lifecycle, or names two similar things side-by-side.
2. For each flagged section, read the first paragraph. If it opens with technical detail, prepend
   a one-sentence analogy or "role" framing. Keep it concrete (sticker, sandwich, checkpoint,
   safety net, gatekeeper, GPS tracker) — abstract framings ("a unified abstraction over…")
   defeat the purpose.
3. If the comparison is a table, consider adding a `Question you want to answer | What you need`
   row pair above or below it — readers reach for the table when they have a real question.
4. Skip: procedural step-by-step recipes, reference tables of built-ins, code-only sections, and
   sections that already lead with a clear analogy.

The **rule-of-thumb table** is the highest-leverage shape this audit produces. Use it whenever
two lifecycle layers, two APIs, or two patterns serve different purposes that readers routinely
confuse:

```markdown
> Rule of thumb:
>
> | Question | Where it belongs |
> | --- | --- |
> | "What did the **HTTP layer** do?" | Middleware (access log) |
> | "What did **my code** do?" | Interceptor (application log) |
```

Why this shape works: the left column is the user's actual mental query ("what am I trying to
log?"), not a feature name. The right column maps it to the concrete tool. Readers don't have
to know the API to find the answer; they just have to know what they want.

The rule is "every comparison earns one analogy", not "sprinkle metaphors everywhere". One sharp
sentence beats a paragraph of cleverness.
