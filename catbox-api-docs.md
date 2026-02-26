# Requirements

- \>= Node.js 22

# Installation

```sh
npm i node-catbox
yarn add node-catbox
bun add node-catbox
```

# Usage

### Uploading to Catbox

```ts
import { Catbox } from 'node-catbox';

const catbox = new Catbox();

try {
 const response = await catbox.uploadFile({
  path: '/path/to/my/file.ext',
  // NEW in v4.2.0 (optional)
  // default: 200 * 1024 * 1024 (200 MB)
  maxFileBytes: 200 * 1024 * 1024
 });
 // or to upload from direct file URL
 const response = await catbox.uploadURL({
  url: 'https://i.imgur.com/8rR6IZn.png'
 });

 console.log(response); // -> https://files.catbox.moe/XXXXX.ext
} catch (err) {
 console.error(err); // -> error message from server
}

// ---

// NEW in v3.4.0

const stream = createReadStream('/path/to/my/file.ext');
await catbox.uploadFileStream({
 stream,
 filename: 'file.ext',
 // NEW in v4.2.0 (optional)
 // default: 200 * 1024 * 1024 (200 MB)
 maxStreamBytes: 200 * 1024 * 1024
});
```

### User Hash

Some operations require your account's user hash which can be set on instantiation with

```ts
const catbox = new Catbox('098f6bcd4621d373cade4e832');
```

... or later with

```ts
const catbox = new Catbox();

catbox.setUserHash('098f6bcd4621d373cade4e832');
```

### Deleting Files

```ts
import { Catbox } from 'node-catbox';

// user hash required
const catbox = new Catbox('098f6bcd4621d373cade4e832');

await catbox.deleteFiles({
 files: ['XXXXX.ext']
});
```

### Creating an album

```ts
import { Catbox } from 'node-catbox';

// user hash only required if you plan to edit or delete the album later
const catbox = new Catbox('098f6bcd4621d373cade4e832');

const albumURL = await catbox.createAlbum({
 title: 'album title',
 description: 'album description',
 files: ['XXXXX.ext'] // optional
});
```

### Editing an album

```ts
import { Catbox } from 'node-catbox';

// user hash required
const catbox = new Catbox('098f6bcd4621d373cade4e832');

await catbox.editAlbum({
 id: 'YYYYY',
 title: 'new title',
 description: 'new description',
 files:  ['WWWWW.ext', 'VVVVV.ext'] // optional
});
```

> **Warning**
> This is a potentially destructive method where values are applied to the album directly. Consider using the method below if you are only adding/removing files from an album.

### Adding and removing files from an album

```ts
import { Catbox } from 'node-catbox';

// user hash required
const catbox = new Catbox('098f6bcd4621d373cade4e832');

await catbox.addFilesToAlbum({
 id: 'YYYYY',
 files: ['ZZZZZ.ext']
});
await catbox.removeFilesFromAlbum({
 id: 'YYYYY',
 files: ['ZZZZZ.ext']
});
```

### Deleting an album

```ts
import { Catbox } from 'node-catbox';

// user hash required
const catbox = new Catbox('098f6bcd4621d373cade4e832');

await catbox.removeAlbum({
 id: 'YYYYY'
});
```

### Uploading to Litterbox

```ts
import { Litterbox } from 'node-catbox';

const litterbox = new Litterbox();

await litterbox.uploadFile({
 path: '/path/to/my/file.ext',
 duration: '12h', // or omit to default to 1h
 // NEW in v4.1.0 (optional)
 // FileNameLength.Six | FileNameLength.Sixteen
 fileNameLength: 16,
 // NEW in v4.2.0 (optional)
 // default: 1024 * 1024 * 1024 (1 GB)
 maxFileBytes: 1024 * 1024 * 1024
});

// ---

import { FileLifetime } from 'node-catbox';

// Using an enum for duration
await litterbox.uploadFile({
 path: '/path/to/my/file.ext',
 duration: FileLifetime.TwelveHours
});

// ---

// NEW in v3.4.0

const stream = createReadStream('/path/to/my/file.ext');
await litterbox.uploadFileStream({
 stream,
 filename: 'file.ext'
});

// ---

// NEW in v4.1.0

import { FileNameLength } from 'node-catbox';

// Using an enum for file name length
await litterbox.uploadFile({
 path: '/path/to/my/file.ext',
 fileNameLength: FileNameLength.Sixteen
});
```

# Events

As of `v4.0.0`, both `Catbox` and `Litterbox` emit a `request` and `response` event as well as events specific to each class:

```ts
import { Catbox, Litterbox } from 'node-catbox';

const catbox    = new Catbox();
const litterbox = new Litterbox();

// `request` is a sanitized read-only snapshot (no raw body)
catbox.on('request', request => console.log(request.method, request.hasBody));
// `response` is a read-only snapshot
catbox.on('response', response => console.log(`${response.status} - ${response.statusText}`));

litterbox.on('uploadingFile', (filepath, duration) => console.log('Uploading file', filepath, 'with a duration of', duration));
```

As of `v4.2.0`, `request` snapshots are explicitly sanitized and do not expose raw request body data (including any `userhash` values).

Catbox-specific events:

- `uploadingURL`
- `uploadingFile`
- `uploadingStream`
- `deletingFiles`
- `creatingAlbum`
- `editingAlbum`
- `addingFilesToAlbum`
- `removingFilesFromAlbum`
- `removingAlbum`

Litterbox-specific events:

- `uploadingFile`
- `uploadingStream`
