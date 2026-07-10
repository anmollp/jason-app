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

The frontend expects the backend API to be reachable at
`NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://localhost:3000`.

## Useful scripts

- `pnpm run dev`: start the development server.
- `pnpm run build`: create a production build.
- `pnpm run start`: serve the production build.
- `pnpm run lint`: run ESLint.

## Deployment note

The frontend can be deployed separately from the API. Set
`NEXT_PUBLIC_API_BASE_URL` to the production backend URL so playground requests
do not point at localhost.
