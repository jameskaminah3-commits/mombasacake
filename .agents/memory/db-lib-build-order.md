---
name: DB lib build order for typechecks
description: Composite libs (db, api-zod, api-client-react) must be built with tsc --build before leaf packages can typecheck against them.
---

The `lib/*` packages are composite TypeScript projects that emit declaration files to `dist/`. Leaf packages (api-server, cakeshop) import from these libs. If declarations haven't been emitted yet, the leaf package typecheck fails with "Module has no exported member" even though the code is correct.

**Why:** `tsc --noEmit` on leaf packages relies on declaration files from composite libs. A fresh checkout or new lib schema change means no dist/ yet.

**How to apply:** Always run `pnpm run typecheck:libs` (which runs `tsc --build`) before running `pnpm --filter @workspace/<leaf> run typecheck`. The root `pnpm run typecheck` does this automatically.
