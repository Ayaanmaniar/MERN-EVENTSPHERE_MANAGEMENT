# FAQ

**Can I register as an organizer?** No. For safety, public registration creates attendee or exhibitor accounts only. Organizer accounts are created by the seed script / directly in the database (or set `ALLOW_ADMIN_SIGNUP=1` in the server `.env` for local testing only).

**I did not receive the password reset email.** Configure `SMTP_*` in `server/.env`. Without SMTP, the link is printed in the server console and shown on the forgot-password page in development.

**Why can't I reserve a booth?** Your application for that expo must be *approved*, you can hold only one booth per expo, and the booth must still be available (someone else may have just taken it).

**Why can't I register for a session?** The session may be full (capacity reached). Bookmarking is always possible.

**How do reminders work?** A background job runs every minute and notifies users 15 minutes before a registered/bookmarked session starts. Notifications appear instantly under the 🔔 icon.

**Can attendees message each other?** No — to prevent spam, attendees can message exhibitors and organizers only.

**What file types can be uploaded?** pdf, doc/docx, png/jpg/webp, zip — max 5 MB per file, 5 files per application.

**How do I delete my data?** *My account → Delete account* (needs your password). You can also download a JSON copy first.

**Which browsers are supported?** Current Chrome, Firefox, Safari and Edge, desktop and mobile.
