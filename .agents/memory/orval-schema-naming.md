---
name: Orval schema naming collision
description: Request body schema component names must not match <OperationIdPascal>Body — Orval generates that name internally and collides.
---

Orval auto-generates a type named `<OperationIdPascal>Body` for request bodies. If a schema component in `#/components/schemas` uses the same name, TypeScript reports TS2308 (duplicate identifier).

**Why:** Orval's codegen emits its own wrapper type with that name; a same-named schema causes a conflict.

**How to apply:** Name request body schemas after the entity/action rather than the operation, e.g. `CakeInput` not `CreateCakeBody`, `MpesaCallbackInput` not `MpesaCallbackBody`. Also avoid `WebhookAck` colliding with any callback response — rename as needed.
