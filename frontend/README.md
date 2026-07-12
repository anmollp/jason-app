# Jason Frontend

The frontend contains the public Jason product site and the interactive JSON
playground. It is built with Next.js, React, TypeScript, Tailwind CSS, and
CodeMirror.

## Main routes

- `/`: landing page for the product story.
- `/playground`: interactive Formatter, Diff, Patch, and Pointer workspace.

## Local development

```bash
cp .env.example .env.local
pnpm install
pnpm run dev -- -p 3001
```

Open `http://localhost:3001`.

The frontend server proxy expects the backend API to be reachable at
`JASON_API_BASE_URL`, which defaults to `http://localhost:3000`.

## Useful scripts

- `pnpm run dev`: start the development server.
- `pnpm run build`: create a production build.
- `pnpm run start`: serve the production build.
- `pnpm run lint`: run ESLint.

## Deployment note

The frontend can be deployed separately from the API. Set `JASON_API_BASE_URL`
to the backend service URL so playground requests go through the frontend
server proxy instead of calling the backend directly from the browser.

## Container image

The frontend Docker image builds a standalone Next.js server that can run on
Cloud Run or any Node-compatible container host.

```bash
docker build -t jason-frontend ./frontend
```

The runtime image listens on `PORT`, which defaults to `3000` and is compatible
with Cloud Run's injected `PORT` environment variable.
