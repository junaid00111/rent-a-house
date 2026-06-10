# Render + MongoDB Deployment

## Run locally first

1. Create a `.env` file in the project root.
2. Add:

```text
MONGODB_URI=your-mongodb-atlas-connection-string
MONGODB_DB=rentahouse
PORT=5000
```

3. Install dependencies:

```text
npm install
```

4. Start the app:

```text
npm start
```

Then open `http://localhost:5000`.

## 1. Create the MongoDB database

Use MongoDB Atlas:

1. Create a free cluster.
2. Create a database user with a username and password.
3. In `Network Access`, allow Render to connect.
   For a quick setup, you can allow `0.0.0.0/0`, then tighten it later.
4. Copy the connection string and replace `<username>`, `<password>`, and database name.

Example:

```text
mongodb+srv://username:password@cluster-url/rentahouse?retryWrites=true&w=majority
```

## 2. Push this project to GitHub

Render deploys from a Git repository, so push the project to GitHub first.

## 3. Create the Render web service

1. Open Render.
2. Click `New +` -> `Web Service`.
3. Connect your GitHub repo.
4. Render should detect `render.yaml` automatically.

If you configure it manually, use:

- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

## 4. Add environment variables in Render

Set these in the Render dashboard:

- `MONGODB_URI`: your Atlas connection string
- `MONGODB_DB`: `rentahouse`

Render will provide `PORT` automatically.

## 5. Deploy

Start the deploy. After Render finishes, open:

```text
/api/health
```

It should return JSON showing `mode: "mongodb"`.

## Notes

- User accounts, properties, and bookings now persist in MongoDB.
- Passwords are stored as hashed values, not plain text.
- The default homepage sample properties still come from the frontend and will always show unless you remove them from `public/script.js`.
