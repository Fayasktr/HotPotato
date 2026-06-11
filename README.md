<div align="center">
  <h1>🥔 Hot Potato Management System</h1>
  <p>A modern, mobile-first web application for managing student batches, coordinators, and the interactive "Hot Potato" task-passing game.</p>
</div>

---

## 🌟 Features

- **Mobile-First Dashboard:** Clean, responsive UI for managing users and batches on any device.
- **Role-Based Access Control:** Distinct privileges for Admins, Coordinators, and Students.
- **Batch Management:** Easily organize students into specific batches with assigned coordinators.
- **"Hot Potato" Mechanic:** A unique task-passing system where users pass a "potato" to track responsibilities or active turns.
- **Automated Emails:** Integrated mailing system for password resets and notifications.

---

## 🛠️ Tech Stack

- **Backend:** Node.js & Express.js
- **Database:** MongoDB & Mongoose
- **Frontend:** HTML, CSS (Vanilla Mobile-First), EJS Templating
- **Authentication:** express-session, bcryptjs

---

## 🚀 How to Self-Host (Deploy Your Own)

If you want to pull this project and host your own version of Hot Potato, follow these simple steps to gain full Ownership.

### 1. Prerequisites
- **Node.js** installed on your machine
- A **MongoDB** database (either local `127.0.0.1:27017` or a cloud MongoDB Atlas cluster)

### 2. Clone and Install
Open your terminal and run:
```bash
git clone <repository-url>
cd hot-potato
npm install
```

### 3. Environment Variables (.env)
Create a `.env` file in the root directory of the project. You **must** provide the following variables:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `PORT` | The port the server runs on. | `3000` |
| `MONGO_URI` | Your MongoDB connection string. | `mongodb://127.0.0.1:27017/hotpotato` |
| `SESSION_SECRET` | Secret key for encrypting browser sessions. | `my_super_secret_key` |
| `MAIL_USER` | Gmail address used for sending automated emails. | `your-email@gmail.com` |
| `MAIL_PASS` | Gmail App Password (not your normal password). | `abcd efgh ijkl mnop` |
| `BASE_URL` | The live URL of your application. | `http://localhost:3000` |
| `OWNER_EMAIL` | The email you want to use for the Admin account. | `admin@yourdomain.com` |
| `OWNER_PASS` | The password you want for the Admin account. | `securepassword123` |

### 4. Seed the Owner Account
Since the database starts completely empty, you need to manually create your "Owner" Admin account. 
Make sure your `.env` is fully set up, then run:

```bash
node seed.js
```

*(This reads your `OWNER_EMAIL` and `OWNER_PASS` from the `.env` file and securely creates your un-deletable Admin account. It also wipes any old test data to give you a clean slate.)*

### 5. Start the Server
Start the application by running:
```bash
npm start
```
*(Or use `npm run dev` to start with nodemon for local development).*

You can now visit `http://localhost:3000`, log in with your new Owner Email and Password, and start creating Batches and Students!

---

<div align="center">
  <p>Built with ❤️ for seamless batch coordination.</p>
</div>
