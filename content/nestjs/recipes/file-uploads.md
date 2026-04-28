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
---

> Accept `multipart/form-data` in a NestJS controller, validate size and mime-type, and reject anything sketchy. Express adapter only. Fastify needs `@nestjs/platform-fastify`'s own multipart plugin.

## Setup

```shell
npm i -D @types/multer
```

`multer` itself is already a transitive dep of `@nestjs/platform-express`. Only the types are missing.

## Single file

```typescript
import { Controller, Post, UseInterceptors, UploadedFile } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"

@Controller("uploads")
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { name: file.originalname, size: file.size, mime: file.mimetype }
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
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"

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
    return file.originalname
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

Returns `422 Unprocessable Entity`:

```json
{
  "statusCode": 422,
  "message": "Validation failed (expected type is /^(image\\/jpeg|image\\/png)$/)",
  "error": "Unprocessable Entity"
}
```

> Magic number validation means a renamed `.exe` to `.jpg` still gets rejected. Do not skip this.

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
import { Module } from "@nestjs/common"
import { MulterModule } from "@nestjs/platform-express"

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
import { ConfigModule, ConfigService } from "@nestjs/config"
import { MulterModule } from "@nestjs/platform-express"

MulterModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    limits: { fileSize: config.get<number>("UPLOAD_MAX_BYTES") },
  }),
})
```

## Where do the bytes go?

By default Multer keeps the file in memory as a `Buffer` on `file.buffer`. That is fine for small files you immediately stream to S3. For anything larger, switch to disk storage:

```typescript
import { MulterModule } from "@nestjs/platform-express"
import { diskStorage } from "multer"

MulterModule.register({
  storage: diskStorage({
    destination: "./uploads",
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
})
```

With disk storage `file.buffer` is `undefined` and `file.path` points at the saved file.

## Gotchas

- **Fastify users**: `FileInterceptor` does not work. Use [`@fastify/multipart`](https://github.com/fastify/fastify-multipart) instead.
- **Swagger**: add `@ApiConsumes('multipart/form-data')` and a body schema with `type: 'string', format: 'binary'`, or the generated docs will not show a file picker.
- **Global `ValidationPipe`**: it does not see the file field. Validate the file with `ParseFilePipe`, validate text fields with a DTO via `@Body()`.
- **Reverse proxy limits**: nginx defaults to `client_max_body_size 1m`. Bump it or your 10 MB limit means nothing.
- **Memory storage + huge files**: a single 1 GB upload pins 1 GB of RAM until the request ends. Use disk or stream to object storage.

## See also

- [[nestjs/fundamentals/interceptors|Interceptors]]: how `FileInterceptor` plugs into the [[nestjs/fundamentals/request-lifecycle|request lifecycle]]
- [[nestjs/fundamentals/pipes|Pipes]]: what `ParseFilePipe` actually is
- Official: [docs.nestjs.com/techniques/file-upload](https://docs.nestjs.com/techniques/file-upload)
