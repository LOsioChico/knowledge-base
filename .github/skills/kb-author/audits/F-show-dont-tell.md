# Audit F — Show, don't tell (recipes only)

For notes tagged `type/recipe`: every section that describes an observable behavior change
("returns 400", "strips field X", "rejects Y", "the response becomes Z") MUST include the
concrete request payload AND the resulting response payload in fenced blocks (JSON, curl, or a
constructed instance). Prose claims like "returns 400 with both messages" without the actual JSON
are the smell.

Audit procedure:

1. Search the diff for behavior-claim phrasing: `rg -n 'returns|strips|rejects|fails|coerce|becomes'`.
2. For each hit, check whether a request and response block sit next to it.
3. If not, add a `Request:` block (JSON / curl / constructed instance) and a `Response:` block
   (JSON / status code / error shape). Then trim the prose.

Fundamentals (`type/concept`, `type/pattern`) can stay narrative when the snippet alone makes the
behavior obvious.
