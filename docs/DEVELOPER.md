# Developer Documentation

## Architecture
React SPA (Vite) → REST API (Express) → MongoDB (Mongoose). Socket.io carries real-time events.
In development Vite proxies `/api`, `/uploads` and `/socket.io` to the API, so no CORS setup is needed; in production Express serves `client/dist`.

## Roles & authorization
`protect` verifies the JWT and loads `req.user`; `authorize('admin' | 'exhibitor' ...)` guards routes. Rules enforced server-side:
- exhibitors can only apply/reserve/edit for themselves; booths require an **approved** application;
- booth reservation uses an atomic `findOneAndUpdate({status:'available'})` so two users can never get the same booth;
- attendees cannot message other attendees.

## Data model (collections)
`User`, `ExhibitorProfile`, `Expo`, `Booth` (unique `expo+code`), `Application` (unique `expo+exhibitor`), `Session`, `Registration` (`kind`: expo | session | bookmark), `Message`, `Feedback`, `Notification`, `BoothVisit` (traffic analytics).

## REST API (prefix `/api`)
| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me`, `PUT /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password/:token`, `GET /auth/me/export`, `DELETE /auth/me` |
| Expos | `GET /expos`, `GET /expos/:id`, `POST/PUT/DELETE /expos[/:id]` (admin), `POST/DELETE /expos/:id/register`, `GET /expos/:id/attendees` (admin) |
| Booths | `GET /booths/expo/:expoId`, `POST /booths/expo/:expoId/generate` (admin), `PUT/DELETE /booths/:id` (admin), `POST /booths/:id/assign` (admin), `POST /booths/:id/release`, `POST /booths/:id/reserve` (exhibitor), `PUT /booths/:id/details` (exhibitor), `GET /booths/mine/:expoId`, `GET /booths/:id` (records a visit) |
| Applications | `POST /applications` (multipart), `GET /applications/mine`, `GET /applications` (admin), `PUT /applications/:id/status` (admin) |
| Exhibitors | `GET /exhibitors?expo=&search=&category=`, `GET /exhibitors/categories`, `GET/PUT /exhibitors/me/profile`, `GET /exhibitors/:userId` |
| Sessions | `GET /sessions/expo/:expoId`, `GET /sessions/mine`, `POST/PUT/DELETE /sessions[/:id]` (admin), `POST /sessions/:id/register`, `POST /sessions/:id/bookmark` (toggles) |
| Messages | `GET /messages/conversations`, `GET /messages/thread/:userId`, `POST /messages`, `GET /messages/unread-count`, `GET /messages/admins` |
| Feedback | `POST /feedback`, `GET /feedback/mine`, `GET /feedback` (admin), `PUT /feedback/:id` (admin) |
| Notifications | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read` |
| Analytics (admin) | `GET /analytics/overview`, `GET /analytics/expo/:id`, `GET /analytics/expo/:id/export.csv` |

Errors are JSON: `{ "message": "..." }` with a suitable HTTP status.

## Real-time events (Socket.io)
Clients authenticate with `auth: { token }` and join `expo:<id>` rooms (`expo:join`).
Server → client: `schedule:changed`, `booth:updated`, `booths:changed`, `expo:updated`, `expo:created`, `expo:deleted`, `message:new`, `notification:new`. The `useLive(expoId, handlers)` hook wires this up in React.

## Configuration (`server/.env`)
`PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`.

## Testing
`npm test` in `server/` — Jest + Supertest (see `tests/api.test.js`). Set `TEST_MONGO_URI` to use an existing MongoDB, otherwise `mongodb-memory-server` is used.

## Deployment & operations notes
- Serve over HTTPS; set a strong `JWT_SECRET`; restrict `CLIENT_URL`.
- Backups: schedule `mongodump` (or Atlas continuous backups). Uptime: run under PM2/systemd/containers with a health check on `GET /api/health`.
- Logs: `server/logs/access.log` and `app.log`.
- Horizontal scaling: run several API instances behind a load balancer and add `@socket.io/redis-adapter`; move `uploads/` to object storage (S3) for multi-node setups.
- Security testing: run `npm audit` and an OWASP ZAP scan against a staging deployment before go-live.

## Ideas for extension
Online payments for booths, QR-code check-in, email reminders, multi-language UI, Redis cache for analytics.
