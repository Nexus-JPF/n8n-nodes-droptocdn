# n8n-nodes-droptocdn

[n8n](https://n8n.io) community node for [Drop to CDN](https://droptocdn.com) — upload files and get instant public CDN URLs.

## Install

**Self-hosted n8n:** Settings → Community nodes → Install → `n8n-nodes-droptocdn`

**n8n Cloud:** install verified community nodes from the workflow node picker (after n8n verification).

## Credentials

1. Create an API key at [Drop to CDN → Settings → API keys](https://droptocdn.com/dashboard/settings) (`dtc_...`).
2. In n8n: **Credentials** → **Drop to CDN API** → paste your key.

## Operations

| Operation | Description |
|-----------|-------------|
| **Upload** | Upload a binary file; returns CDN URL and metadata |
| **Get** | Get file metadata by ID |
| **Delete** | Delete a file by ID |

Auth: `Authorization: Bearer dtc_...` (validated via `GET /v1/profile`).

## HTTP Request fallback

You can also call the API with n8n’s generic **HTTP Request** node:

- Base URL: `https://api.droptocdn.com/v1`
- Auth header: `Authorization: Bearer dtc_...`
- Upload: `POST /files` (multipart, field `file`)
- Get: `GET /files/:id`
- Delete: `DELETE /files/:id`

More examples: [droptocdn.com](https://droptocdn.com) documentation.

## Development

```bash
npm install
npm run build
npm run lint
```

## Source

Developed by [Drop to CDN](https://droptocdn.com). This public repo is synced from the private monorepo for npm provenance publishing.

## License

MIT
