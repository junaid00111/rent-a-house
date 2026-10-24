# Rent a House

A web-based rental management application that connects people searching for homes with property owners. Users can explore available properties and manage their booking requests, while owners can list properties and review bookings through a role-based dashboard.

## Features

- **User accounts:** Register and log in as a renter or property owner.
- **Role-based dashboard:** Navigation and features are tailored to the selected role.
- **Property browsing:** View property listings and details.
- **Property management:** Owners can add and manage their listings.
- **Booking workflow:** Renters can submit booking requests and view their bookings; owners can review requests for their properties.
- **Profile section:** View account information.
- **Persistent storage:** MongoDB stores users, properties, and bookings.
- **Responsive interface:** HTML, CSS, and JavaScript frontend.
- **Password hashing:** Passwords are hashed using Node.js `crypto` (scrypt) before storage.

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Node.js (built-in HTTP server)
- **Database:** MongoDB
- **Node.js packages:** `mongodb`, `dotenv`
- **Deployment configuration:** Render

## Project Structure

```text
rent-a-house-final/
├── public/
│   ├── images/
│   │   ├── aparts.jpg
│   │   ├── flats.jpg
│   │   └── villas.jpg
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── server.js
├── package.json
├── package-lock.json
├── render.yaml
├── DEPLOY.md
└── .gitignore
```

## Prerequisites

- Node.js and npm installed
- A MongoDB database, such as a MongoDB Atlas cluster
- Git (optional, for version control)

## Run Locally

1. Clone the repository and move into the project directory:

   ```bash
   git clone <YOUR_REPOSITORY_URL>
   cd rent-a-house-final
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root. Add your own MongoDB connection details:

   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
   MONGODB_DB=rentahouse
   PORT=5000
   ```

   Replace the placeholders with your own MongoDB Atlas credentials. Do not commit the `.env` file.

4. Start the server:

   ```bash
   npm start
   ```

5. Open the application in your browser:

   ```text
   http://localhost:5000
   ```

The server connects to MongoDB when it starts. Make sure your database is running and its network access settings permit your connection.

## API Overview

The application includes the following API routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check server/database mode |
| `POST` | `/api/register` | Register a user or property owner |
| `POST` | `/api/login` | Authenticate an account |
| `GET` | `/api/properties` | Retrieve property listings |
| `POST` | `/api/properties` | Create a property listing |
| `GET` | `/api/bookings` | Retrieve bookings, optionally filtered by user or owner |
| `POST` | `/api/bookings` | Create a booking request |

## Database Collections

The application uses these MongoDB collections:

- `users` — account details and password hashes
- `properties` — property listings and owner information
- `bookings` — booking requests and associated property/user details

The application creates indexes for unique email addresses and booking/property relationships.

## Deployment

The repository includes a `render.yaml` configuration and a `DEPLOY.md` guide for deploying the application on Render with MongoDB.

At deployment time, configure `MONGODB_URI` and, if needed, `MONGODB_DB` in the hosting provider's environment-variable settings. Do not place production credentials directly in source code.

## Security Notes

- Keep `.env` out of version control.
- Never publish MongoDB connection strings, passwords, or other secrets.
- Use a strong, unique database password and restrict database network access where possible.
- Review authentication, authorization, input validation, and session/token handling before using the application with real users.
- Use HTTPS in production.

## Future Improvements

- Add property search filters such as location, price range, and property type.
- Add property images upload and validation.
- Add booking status updates and notifications.
- Add automated tests for API endpoints and authentication.
- Improve accessibility and error handling.

## License

No license has been specified yet. Add a license file if you intend to define reuse and distribution terms.
