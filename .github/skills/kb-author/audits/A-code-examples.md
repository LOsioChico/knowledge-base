# Audit A — Code examples (imports + wrappers + defined refs)

For every fenced ` ```ts ` / ` ```typescript ` block in the diff, verify:

1. **All imports are present.** Every symbol used (decorators, classes, RxJS operators,
   third-party packages, Node built-ins) has a matching `import` line at the top of the snippet.
2. **Class methods are wrapped in their container.** A `@Get()` / `@Post()` / `@Use()` method
   lives inside `@Controller(...) export class FooController { ... }`. A `@Module({...})` snippet
   has `export class FooModule {}`. No bare decorated methods floating outside a class.
3. **Class fields and constructors are declared.** If the body uses `this.store`, the field
   declaration must be visible. If `this.config` is accessed, the constructor must inject it.
4. **No undefined references.** Every symbol must be (a) imported, (b) defined earlier in the
   same snippet, or (c) explicitly commented as defined elsewhere.
5. **Single-line illustrative fragments are OK** only if surrounding prose makes context
   unambiguous. When in doubt, write the full snippet.

Heuristic grep to spot floating decorators (run from repo root):

```bash
# Decorated methods that aren't preceded by a class line within ~6 lines
rg -n -B6 '^\s*>?\s*@(Get|Post|Put|Patch|Delete|Use\w+|Inject\w*)\(' content | rg -B6 '@(Get|Post|Put|Patch|Delete|Use\w+|Inject\w*)\(' | head -80
```

When auditing a single file, just read every fenced block end-to-end.

Pairs with [Audit I](I-headline-vs-code.md): A checks code is *complete*, I checks it is *honest*.
