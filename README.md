# ToDo-App

Full-stack Next.js todo application with WebAuthn authentication, SQLite persistence, tags, templates, recurring tasks, reminders, export/import, and calendar view.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create env file from template:

```bash
copy .env.example .env.local
```

3. Start development server:

```bash
npm run dev
```

4. Seed Singapore holidays:

```bash
npm run seed:holidays
```

## Environment Variables

Required variables:

- `JWT_SECRET`
- `RP_ID`
- `RP_NAME`
- `RP_ORIGIN`

Optional for Railway persistent storage:

- `RAILWAY_VOLUME_MOUNT_PATH` (for example `/app/data`)

## Validation Commands

```bash
npm run lint
npm run build
npm run test:e2e
```

## Railway Deployment

1. Login and link/init:

```bash
railway login
railway init --name todo-app
```

2. Set variables:

```bash
railway variable set JWT_SECRET=your-secret --service todo-app
railway variable set RP_ID=your-app.up.railway.app --service todo-app
railway variable set RP_NAME="Todo App" --service todo-app
railway variable set RP_ORIGIN=https://your-app.up.railway.app --service todo-app
```

3. Deploy:

```bash
railway up
```

## Notes

- WebAuthn must use the correct production domain (`RP_ID` and `RP_ORIGIN`).
- SQLite path is volume-aware and uses `RAILWAY_VOLUME_MOUNT_PATH` when provided.
