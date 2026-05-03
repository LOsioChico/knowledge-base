---
title: File uploads with Multer
aliases: [multipart upload, multer, file upload]
tags: [type/recipe, tech/multer, tech/http, validation]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/interceptors]]"
source:
  - https://docs.nestjs.com/techniques/file-upload
  - https://docs.nestjs.com/openapi/operations#file-upload
  - https://github.com/expressjs/multer
  - https://github.com/nestjs/nest/tree/master/packages/common/pipes/file
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/file/parse-file-pipe.builder.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/file/file-type.validator.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/decorators/http/route-params.decorator.ts
  - https://github.com/nestjs/nest/blob/master/packages/platform-express/multer/interceptors/file.interceptor.ts
  - https://github.com/fastify/fastify-multipart
  - https://docs.nestjs.com/techniques/validation
  - https://github.com/nestjs/nest/blob/master/packages/platform-express/package.json
  - https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size
---

> Accept `multipart/form-data` in a NestJS controller, validate size and mime-type, and reject anything sketchy. Express adapter only; on Fastify use the standalone [`@fastify/multipart`](https://github.com/fastify/fastify-multipart) plugin instead.

## Setup

```shell
npm i -D @types/multer
```

`multer` itself is already a transitive dep of `@nestjs/platform-express`. Only the types are missing.

## Single file

```typescript
import { Controller, Post, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("uploads")
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { name: file.originalname, size: file.size, mime: file.mimetype };
  }
}
```

`FileInterceptor('file')` is a built-in [[nestjs/fundamentals/interceptors|interceptor]] that reads the field named `file` from the form. Change the string to match your form field.

A matching request:

```shell
curl -F file=@logo.png http://localhost:3000/uploads
```

Response:

```json
{ "name": "logo.png", "size": 24580, "mime": "image/png" }
```

## Uploaded file checks: the right way

For body/query DTOs, lean on the [[nestjs/recipes/validation|validation recipe]]. For uploaded files, skip hand-rolled [[nestjs/fundamentals/pipes|pipes]] and use the built-in `ParseFilePipeBuilder`. It composes validators and produces a clean 400 (or whatever you choose) when something fails.

```typescript
import {
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

@Controller("uploads")
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ) {
    return file.originalname;
  }
}
```

| Builder method                       | What it checks                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addFileTypeValidator({ fileType })` | Mime-type via the file's [magic number](<https://en.wikipedia.org/wiki/Magic_number_(programming)#In_files>), not the client-provided header. String or RegExp. |
| `addMaxSizeValidator({ maxSize })`   | Bytes. Multer also enforces a hard cap (see below).                                                                                                             |
| `.build({ fileIsRequired: false })`  | Makes the upload optional. Default is required.                                                                                                                 |

Uploading a 12 MB PDF to that route:

```shell
curl -F file=@huge-report.pdf http://localhost:3000/uploads
```

Returns `422 Unprocessable Entity`. When the upload has a recognized `mimetype` (true for a PDF, JPEG, etc.), [`FileTypeValidator.buildErrorMessage`](https://github.com/nestjs/nest/blob/master/packages/common/pipes/file/file-type.validator.ts) emits both the actual and expected types; `ParseFilePipeBuilder` wraps the response with `HttpStatus.UNPROCESSABLE_ENTITY` ([`parse-file-pipe.builder.ts`](https://github.com/nestjs/nest/blob/master/packages/common/pipes/file/parse-file-pipe.builder.ts)):

```json
{
  "statusCode": 422,
  "message": "Validation failed (current file type is application/pdf, expected type is /^(image\\/jpeg|image\\/png)$/)",
  "error": "Unprocessable Entity"
}
```

The shorter `Validation failed (expected type is <validator>)` form (without the actual type) is only emitted when the validator can't read a `mimetype` at all: typically a missing `@UploadedFile()` argument or a file with no detectable type and no client-provided `Content-Type`.

> [!warning]- Magic-number check is what stops a renamed `.exe`
> `addFileTypeValidator` reads the file's leading bytes (the [magic number](<https://en.wikipedia.org/wiki/Magic_number_(programming)#In_files>)), not the `Content-Type` header the client sent. Trusting the header alone lets a renamed `.exe` reach disk under a `.jpg` filename. Always include this validator on routes that accept user uploads.

## Multiple files

| Decorator                                     | When                                                              |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `FilesInterceptor('files', maxCount?, opts?)` | Same field name, an array of files. Read with `@UploadedFiles()`. |
| `FileFieldsInterceptor([{ name, maxCount }])` | Different field names per slot (e.g. `avatar` and `cover`).       |
| `AnyFilesInterceptor()`                       | Accept anything. Use sparingly.                                   |
| `NoFilesInterceptor()`                        | Accept `multipart/form-data` for text fields, reject any file.    |

## Sensible defaults via MulterModule

Set caps once at module level so every route inherits them.

```typescript
import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 5,
      },
    }),
  ],
})
export class AppModule {}
```

For env-driven config use `registerAsync`:

```typescript
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";

MulterModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    limits: { fileSize: config.get<number>("UPLOAD_MAX_BYTES") },
  }),
});
```

## Where do the bytes go?

By default Multer keeps the file in memory as a `Buffer` on `file.buffer` ([Multer README → MemoryStorage](https://github.com/expressjs/multer#memorystorage)). That is fine for small files you immediately stream to S3. For anything larger, switch to disk storage:

```typescript
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";

MulterModule.register({
  storage: diskStorage({
    destination: "./uploads",
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
});
```

With disk storage `file.buffer` is `undefined` and `file.path` points at the saved file ([Multer README → DiskStorage](https://github.com/expressjs/multer#diskstorage)).

## Gotchas

> [!warning]- Global `ValidationPipe` does not see the file field
> A globally-bound `ValidationPipe` validates DTOs from `@Body()`, `@Query()`, and `@Param()`; it doesn't process the `Express.Multer.File` argument behind `@UploadedFile()` because the file is attached to `req.file` by Multer's request handler and injected via the [`@UploadedFile()` parameter decorator](https://github.com/nestjs/nest/blob/master/packages/common/decorators/http/route-params.decorator.ts) rather than being part of the body DTO. Validate the file with `ParseFilePipe`/`ParseFilePipeBuilder`; validate text fields in the same form via a DTO on `@Body()`. Forgetting this is the most common reason "my file validators don't run".

> [!warning]- Reverse-proxy body limit silently caps your upload
> nginx defaults to `client_max_body_size 1m` ([nginx docs](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size)); the request is rejected at the proxy with `413 Request Entity Too Large` and never reaches Nest. Your 10 MB Multer limit is irrelevant until the proxy is bumped to match. Managed load balancers (AWS ALB, Cloud Run, Cloudflare, etc.) impose their own request-size caps; check the provider's docs before assuming Multer's limit is the binding one.

> [!warning]- Memory storage pins one buffer per concurrent upload
> Default Multer storage holds the whole file in `file.buffer`. A single 1 GB upload pins 1 GB of RAM until the request ends; ten concurrent uploads pin ten. Switch to `diskStorage` or stream straight to object storage for anything large.

> [!warning]- Fastify needs a different package entirely
> `FileInterceptor` is part of `@nestjs/platform-express` and does not work under `@nestjs/platform-fastify`. Use [`@fastify/multipart`](https://github.com/fastify/fastify-multipart) and Fastify's own request-level API; this whole recipe does not apply.

> [!info]- Swagger needs `@ApiConsumes` to render the file picker
> Without `@ApiConsumes('multipart/form-data')` and a body schema declaring `type: 'string', format: 'binary'`, the generated OpenAPI doc has no `requestBody` content type that Swagger UI recognizes as a file input ([@nestjs/swagger → File upload](https://docs.nestjs.com/openapi/operations#file-upload)). The "Try it out" form falls back to plain text and is unusable for binary uploads.

## See also

- [[nestjs/fundamentals/interceptors|Interceptors]]: how `FileInterceptor` plugs into the [[nestjs/fundamentals/request-lifecycle|request pipeline]]
- [[nestjs/fundamentals/pipes|Pipes]]: what `ParseFilePipe` actually is
- Official: [docs.nestjs.com/techniques/file-upload](https://docs.nestjs.com/techniques/file-upload)
