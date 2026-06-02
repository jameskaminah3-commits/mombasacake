---
name: Orval nullable syntax
description: Orval v8.9.1 rejects OpenAPI 3.1 array-syntax nullables — must use OpenAPI 3.0 nullable:true style.
---

Orval v8.9.1 fails with "Failed to resolve input" if OpenAPI uses `type: ["string","null"]` (OpenAPI 3.1 array syntax).

**Why:** Orval's parser does not support OpenAPI 3.1 array-type syntax as of v8.9.1.

**How to apply:** Always write nullable fields as:
```yaml
myField:
  type: string
  nullable: true
```
Never as `type: ["string","null"]`.
