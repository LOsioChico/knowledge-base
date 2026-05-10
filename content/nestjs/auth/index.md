---
title: Auth
aliases: [authentication, authorization]
tags: [type/moc]
area: nestjs
status: evergreen
related:
  - "[[nestjs/index]]"
  - "[[nestjs/fundamentals/guards]]"
source:
---

Map of content for authentication and authorization in NestJS. Auth in Nest is built on top of [[nestjs/fundamentals/guards|guards]], so start there if you haven't read it.

## Recipes

- [[nestjs/auth/jwt-strategy|JWT strategy with Passport]]: login, protected route, and `@Public()` opt-out.

## Planned

- Guards vs [[nestjs/fundamentals/middleware|middleware]]: when to use each.
- Role and permission checks (RBAC: role-based access control, CBAC: claims-based access control).
- Refresh tokens and rotation.
- Session-based auth (when JWT is the wrong tool).
