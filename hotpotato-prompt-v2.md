# Hot Potato — Master Build Prompt (v2)
### For use in Antigravity with Gemini 2.5 Pro
### Read the full prompt before starting. Build phase by phase strictly.

---

## IMPORTANT INSTRUCTION FOR AI

Build this project **phase by phase**. After each phase, STOP and wait for
confirmation before proceeding. Do NOT jump ahead. Do NOT generate UI styling
or deployment config unless that phase explicitly asks for it.
Placeholder comments marked `// TODO: [label]` are intentional — leave them
exactly as written.

---

## PROJECT OVERVIEW

A web app called **"Hot Potato"** — a fun English-zone enforcement game for
college batches. One person at a time "holds the potato" (caught speaking
Malayalam). They or the coordinator can pass it to the next person with a
valid reason. Everyone in the batch sees who currently holds it, with full
history and a leaderboard chart.

---

## TECH STACK

- **Runtime:** Node.js
- **Framework:** Express.js
- **Template Engine:** EJS
- **Database:** MongoDB with Mongoose
- **Auth:** express-session + bcryptjs
- **Password Reset:** Nodemailer with Gmail App Password (reset link via email)
- **Charts:** Chart.js (CDN)
- **Real-time:** Polling every 8 seconds — NO Socket.io (Render free tier safe)
- **Other packages:** method-override, connect-flash, dotenv, crypto (built-in)

---

## FOLDER STRUCTURE

```
hot-potato/
├── models/
│   ├── User.js
│   ├── Batch.js
│   ├── Potato.js
│   ├── History.js
│   └── PasswordReset.js
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   ├── batchRoutes.js
│   └── potatoRoutes.js
├── middleware/
│   └── authMiddleware.js
├── utils/
│   └── mailer.js
├── views/
│   ├── partials/
│   │   ├── header.ejs
│   │   └── flash.ejs
│   ├── auth/
│   │   ├── login.ejs
│   │   ├── register.ejs
│   │   ├── forgot-password.ejs
│   │   └── reset-password.ejs
│   ├── admin/
│   │   ├── dashboard.ejs
│   │   ├── users.ejs
│   │   └── batches.ejs
│   ├── batch/
│   │   ├── view.ejs
│   │   └── members.ejs
│   ├── profile/
│   │   └── index.ejs
│   └── index.ejs
├── public/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── poll.js
├── app.js
├── .env
└── package.json
```

---

## DATABASE MODELS

### User
```js
{
  name:        String (required),
  email:       String (required, unique, lowercase),
  password:    String (hashed with bcryptjs),
  role:        String (enum: ['admin', 'coordinator', 'student'], default: 'student'),
  batchId:     ObjectId (ref: 'Batch', nullable — admins have no batch),
  createdAt:   Date (default: Date.now)
}
```

### Batch
```js
{
  name:          String (required, unique, e.g. 'BCE312'),
  createdBy:     ObjectId (ref: 'User'),   // admin who created it
  coordinatorId: ObjectId (ref: 'User'),   // can be changed by admin
  createdAt:     Date
}
```

### Potato (ONE document per batch — current state only)
```js
{
  batchId:   ObjectId (ref: 'Batch', unique),
  holderId:  ObjectId (ref: 'User', nullable),  // null = no one holds it yet
  reason:    String,
  taggedBy:  ObjectId (ref: 'User'),
  timestamp: Date
}
```

### History (every pass ever made)
```js
{
  batchId:   ObjectId (ref: 'Batch'),
  fromId:    ObjectId (ref: 'User'),   // who passed it
  toId:      ObjectId (ref: 'User'),   // who received it
  reason:    String,
  timestamp: Date (default: Date.now)
}
```

### PasswordReset
```js
{
  userId:    ObjectId (ref: 'User'),
  token:     String (random hex, 32 bytes),
  expiresAt: Date (1 hour from creation),
  used:      Boolean (default: false)
}
```

---

## ROLES & PERMISSIONS TABLE

| Action                          | Admin | Coordinator | Student |
|---------------------------------|-------|-------------|---------|
| Create / delete batch           | ✅    | ❌          | ❌      |
| Assign / change coordinator     | ✅    | ❌          | ❌      |
| Add members to any batch        | ✅    | ❌          | ❌      |
| Add members to own batch        | ✅    | ✅          | ❌      |
| Assign first potato holder      | ✅    | ✅ (own batch only) | ❌ |
| Pass potato (if current holder) | ✅    | ✅          | ✅      |
| Pass potato (if NOT holder)     | ✅    | ✅ (own batch) | ❌   |
| View batch page                 | ✅    | ✅          | ✅      |
| View all users (admin panel)    | ✅    | ❌          | ❌      |
| Change any user's role          | ✅    | ❌          | ❌      |
| Reset potato for a batch        | ✅    | ❌          | ❌      |

Important rules:
- Admin = teachers. Multiple admins can exist. Full control over everything.
- Coordinator = student leader. Can pass potato regardless of who holds it
  (within their own batch). Can add members to their own batch.
- Student = can only pass if they are the current holder.
- Reason must be minimum 5 words — enforce on BOTH frontend and backend.
- Potato collection must have at most ONE document per batch (use upsert).

---

## AUTHENTICATION FLOW

- Users log in with **email + password** (no roll numbers)
- Sessions managed with express-session
- Session shape after login:
  ```js
  req.session.user = { _id, name, email, role, batchId }
  ```
- Password reset flow:
  1. User clicks "Forgot Password" on login page
  2. Enters their email → app creates PasswordReset document with random token
  3. Nodemailer sends reset link: `https://yourdomain.com/reset-password/:token`
  4. User clicks link → form to enter new password
  5. On submit: validate token not expired, not used → hash new password → mark token used
- Nodemailer config uses Gmail + App Password from .env

---

## NAVBAR / PROFILE

Every logged-in page shows a header with:
- App name "🥔 Hot Potato" on the left
- Batch badge if user has a batch
- On the right: user's name with a profile icon (avatar circle with initials)
- Clicking profile icon opens a small dropdown with:
  - "Change Password" → goes to profile page
  - "Logout" → destroys session

Profile page (`/profile`):
- Shows user name, email, role, batch name
- Change password form: current password + new password + confirm new password
- On submit: verify current password → hash new → save

---

## HISTORY & LEADERBOARD

Batch view page must include:

1. **Pass History** — last 30 entries, newest first
   - Shows: [taggedBy name] → [holder name] · reason · time

2. **Leaderboard section** — who got the potato the most times
   - Query: count History.toId grouped by toId for this batch
   - Display as a **Chart.js horizontal bar chart**
   - Also show a ranked text list below the chart (1st, 2nd, 3rd...)
   - Chart.js loaded from CDN, rendered client-side with data passed via EJS

---

## MAILER UTILITY

Generate `utils/mailer.js`:
```js
// Uses nodemailer with Gmail App Password
// transporter configured from .env:
//   MAIL_USER = your Gmail address
//   MAIL_PASS = your Gmail App Password (not regular password)
//
// Export a single function: sendResetEmail(toEmail, resetLink)
// Email subject: "Hot Potato — Password Reset"
// Email body: plain HTML with the reset link and 1-hour expiry notice
```

---

## ENV TEMPLATE

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/hotpotato
SESSION_SECRET=your_secret_key_here
MAIL_USER=yourgmail@gmail.com
MAIL_PASS=your_gmail_app_password
BASE_URL=http://localhost:3000
```

---

## PHASE 1 — Install & Project Setup

Do the following steps:

1. Generate `package.json` with all dependencies:
   - express, ejs, mongoose, express-session, bcryptjs, connect-flash,
     method-override, nodemailer, dotenv
   - devDependencies: nodemon

2. Generate `app.js`:
   - Load dotenv
   - Connect to MongoDB (log success/failure)
   - Setup express with EJS, static files, urlencoded body parser
   - Setup session middleware (secret from .env, resave false, saveUninitialized false)
   - Setup connect-flash
   - Setup method-override
   - Mount all 4 route files (auth, admin, batch, potato)
   - Mount profile route
   - Global middleware: pass `req.session.user` and flash messages to all EJS views
     via `res.locals`
   - 404 handler at the bottom
   - Listen on PORT from .env

3. Generate `.env` template as shown above

4. Generate all 5 Mongoose models exactly as defined above

5. Generate `middleware/authMiddleware.js` with these functions:
   ```js
   isLoggedIn      // redirect to /login if no session
   isAdmin         // redirect with flash error if role !== 'admin'
   isCoordinator   // redirect if role !== 'coordinator' AND role !== 'admin'
   isInBatch       // redirect if user has no batchId
   ```

6. Generate `utils/mailer.js` as described above

7. Write a `seed.js` file in root:
   - Creates 1 admin: name 'Admin', email 'admin@test.com', password 'admin123'
   - Creates batch 'BCE312'
   - Creates coordinator: name 'Fayas', email 'fayas@test.com', password 'pass123',
     role 'coordinator', batchId = BCE312
   - Creates 3 students in BCE312
   - Creates Potato doc for BCE312 with holderId: null
   - Run with: `node seed.js`

STOP after Phase 1. Do not generate any routes or views.

---

## PHASE 2 — Auth Routes & Views

Generate `routes/authRoutes.js` with:

```
GET  /login                    → render auth/login.ejs
POST /login                    → find user by email, bcrypt compare,
                                 set session, redirect by role:
                                 admin → /admin
                                 coordinator/student → /batch/:batchId

GET  /register                 → render auth/register.ejs
POST /register                 → create student account (role: student),
                                 batchId required (pass as query or form field),
                                 hash password, save, set session,
                                 redirect to /batch/:batchId

GET  /forgot-password          → render auth/forgot-password.ejs
POST /forgot-password          → find user by email, create PasswordReset doc,
                                 send reset email via mailer.js,
                                 flash success (don't reveal if email exists or not)

GET  /reset-password/:token    → validate token (exists, not expired, not used)
                                 render auth/reset-password.ejs or flash error
POST /reset-password/:token    → validate token again, hash new password,
                                 update user, mark token used, redirect to /login

GET  /logout                   → destroy session, redirect to /login
```

Generate views:
- `views/auth/login.ejs` — email + password + "Forgot password?" link
- `views/auth/register.ejs` — name + email + password + hidden batchId field
- `views/auth/forgot-password.ejs` — email input form
- `views/auth/reset-password.ejs` — new password + confirm password form
- `views/partials/header.ejs` — app name left, profile dropdown right (initials avatar)
  Profile dropdown: "Change Password" link + "Logout" POST button
  Show batch badge if user has batchId
- `views/partials/flash.ejs` — success (green) and error (red) flash message display

// TODO: AUTH UI STYLING — functional HTML only for now

STOP after Phase 2.

---

## PHASE 3 — Profile Route & View

Generate profile route inside a new `routes/profileRoutes.js`:

```
GET  /profile       → render profile/index.ejs with user data + batch name if exists
POST /profile/password → verify current password (bcrypt),
                         validate new === confirm,
                         hash new password, save,
                         flash success, redirect to /profile
```

Apply `isLoggedIn` middleware to both routes.

Generate `views/profile/index.ejs`:
- Show: name, email, role badge, batch name (if any)
- Change password form: current password + new password + confirm
- On validation error, flash message shown via flash.ejs partial

// TODO: PROFILE UI STYLING

STOP after Phase 3.

---

## PHASE 4 — Admin Routes & Views

Generate `routes/adminRoutes.js`. Apply `isLoggedIn` + `isAdmin` to ALL routes.

```
GET  /admin                        → render admin/dashboard.ejs
                                     data: all batches with coordinator name + member count

GET  /admin/batches                → render admin/batches.ejs
                                     list all batches, form to create new batch

POST /admin/batches                → create Batch document,
                                     create Potato doc for it (holderId: null),
                                     flash success, redirect to /admin/batches

DELETE /admin/batches/:id          → delete batch + all its users? NO.
                                     just delete batch doc and potato doc.
                                     flash warning. redirect.

GET  /admin/users                  → render admin/users.ejs
                                     list ALL users (all roles, all batches)
                                     group by batch, show admins separately

POST /admin/users/:id/role         → change user role (admin/coordinator/student)
                                     if setting as coordinator: update Batch.coordinatorId too
                                     if removing coordinator: set Batch.coordinatorId to null
                                     flash success

POST /admin/users/:id/batch        → reassign user to a different batch
                                     flash success

DELETE /admin/users/:id            → delete user, flash success

POST /admin/potato/:batchId/reset  → set Potato.holderId = null, reason = '', taggedBy = null
                                     flash success, redirect to /batch/:batchId
```

Generate views:
- `views/admin/dashboard.ejs` — overview cards: total batches, total users, active potato holders
- `views/admin/batches.ejs` — batch list table + create batch form
- `views/admin/users.ejs` — full user list grouped by batch,
  each row has: name, email, role dropdown (POST on change), batch selector, delete button

// TODO: ADMIN UI STYLING

STOP after Phase 4.

---

## PHASE 5 — Batch View Route & Members

Generate `routes/batchRoutes.js`. Apply `isLoggedIn` + `isInBatch`.

```
GET /batch/:batchId        → render batch/view.ejs with:
                             - batch info + coordinator name
                             - current potato (holderId populated)
                             - all batch members (sorted by name)
                             - history last 30 entries (fromId + toId populated)
                             - leaderboard: aggregate History.toId count for this batch
                               sorted desc, top 10, with user names
                             - req.session.user for conditional rendering

GET /api/potato/:batchId   → return JSON:
                             { holderId, holderName, reason, taggedBy, timestamp }
                             used by poll.js for polling

GET /batch/:batchId/members          → render batch/members.ejs
                                       show all members, add member form
                                       only accessible by coordinator of THIS batch or admin

POST /batch/:batchId/members/add     → create new student account for this batch
                                       fields: name, email, temp password
                                       if email already exists flash error
                                       flash success with temp password reminder
```

Generate `views/batch/view.ejs` with these sections IN ORDER:

1. **Potato Hero** — large display:
   - If holderId is null: "No one holds the potato yet 🥔"
   - If someone holds it: their name (large), reason, tagged by, time ago

2. **Assign First Holder form** — shown ONLY IF:
   `potato.holderId === null` AND `(user.role === 'coordinator' || user.role === 'admin')`
   Fields: dropdown of all members, reason textarea

3. **Pass Potato form** — shown ONLY IF:
   `potato.holderId !== null` AND
   `(user._id === potato.holderId OR user.role === 'coordinator' OR user.role === 'admin')`
   Fields: dropdown of all members (exclude self), reason textarea
   Live word count below textarea — disable submit button if under 5 words

4. **Members list** — grid of all batch members
   Highlight current holder with 🥔 badge

5. **Leaderboard chart** — Chart.js horizontal bar chart
   Data passed from server as JSON via EJS into a `<script>` block
   Labels = user names, data = potato count
   Below chart: ranked text list (1. Name — X times)

6. **History log** — scrollable list, newest first
   Format: [fromName] caught [toName] · "reason" · timestamp

Generate `views/batch/members.ejs`:
- Current members list with remove option (for coordinator/admin)
- Add member form: name, email, temporary password

// TODO: BATCH UI STYLING

STOP after Phase 5.

---

## PHASE 6 — Potato Logic Routes

Generate `routes/potatoRoutes.js`. Apply `isLoggedIn`.

```
POST /potato/assign    → assign first holder (no one holds it yet)
                         Validate:
                         - user is coordinator or admin
                         - potato.holderId is currently null (re-fetch from DB)
                         - toId is a valid member of this batch
                         - reason is at least 5 words (trim + split check)
                         Action:
                         - update Potato doc (holderId, reason, taggedBy, timestamp)
                         - create History entry (fromId = req.session.user._id)
                         - redirect to /batch/:batchId with flash success

POST /potato/pass      → pass potato to someone else
                         Validate:
                         - re-fetch potato from DB (never trust client)
                         - check permission:
                           if student: user._id must === potato.holderId
                           if coordinator: must be coordinator of this batch
                           if admin: always allowed
                         - toId !== fromId
                         - toId is valid member of this batch
                         - reason is at least 5 words
                         Action:
                         - update Potato doc (holderId = toId, reason, taggedBy, timestamp)
                         - create History entry
                         - redirect to /batch/:batchId with flash success
```

STOP after Phase 6.

---

## PHASE 7 — Polling

Generate `public/js/poll.js`:
- Store current holderId and timestamp from page load
  (pass them from EJS into the script as data attributes on a div)
- Every 8 seconds, fetch `/api/potato/:batchId`
- If returned holderId or timestamp differs from stored values → reload page
- If `document.visibilityState === 'hidden'` → skip that poll cycle
- Clear interval on page unload

Include `<script src="/js/poll.js">` in `batch/view.ejs` only.
Pass batchId, current holderId, and current timestamp to the page via
a `<div id="poll-data" data-batch-id="..." data-holder-id="..." data-timestamp="...">`.

STOP after Phase 7.

---

## PHASE 8 — Index / Landing Page

Generate `routes/index.js` and mount it in app.js:

```
GET /   → if logged in:
            admin → redirect /admin
            coordinator/student → redirect /batch/:batchId
          if not logged in → render index.ejs (landing page)
```

Generate `views/index.ejs`:
- Simple landing page with app name, tagline, Login button
- List of batches (public, fetched from DB) as join links

// TODO: LANDING UI STYLING

STOP after Phase 8.

---

## WHAT IS INTENTIONALLY LEFT OUT

Build these in separate focused sessions after all phases work and are tested:

- [ ] Full CSS design system (dark theme, mobile-first layout, animations)
- [ ] Render.com deployment config (render.yaml, env vars setup guide)
- [ ] Email templates (styled HTML email for password reset)
- [ ] Admin ability to export history as CSV
- [ ] Pagination for history beyond 30 entries
- [ ] Rate limiting on login and password reset routes

---

## SEED FILE (seed.js in root)

```
Admin:       name: 'Admin',  email: 'admin@test.com',  password: 'admin123', role: 'admin'
Batch:       BCE312, BCE317
Coordinator: name: 'Fayas',  email: 'fayas@test.com',  password: 'pass123',
             role: 'coordinator', batch: BCE312
Students:    3 sample students in BCE312, 2 in BCE317
Potato docs: one per batch, holderId: null
```

Run with: `node seed.js`

---

## FINAL RULES FOR AI

- Use `async/await` everywhere — no callbacks
- All DB operations wrapped in try/catch — flash error on failure
- Never trust client-side role — always verify from DB or session on protected routes
- Potato collection: ONE document per batch — always use `findOneAndUpdate` with upsert
- Word count validation on BOTH frontend (disable button) and backend (return 400)
- All redirects after POST use flash messages (PRG pattern)
- Keep all views plain functional HTML — styling phase comes later
- Add a comment above every route explaining what it does and who can access it
- method-override must be set up so DELETE and PUT work from HTML forms
```
