const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_SIZE = 8 * 1024 * 1024;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'rentahouse';

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI environment variable.');
}

const client = new MongoClient(MONGODB_URI);

let db;
let usersCollection;
let propertiesCollection;
let bookingsCollection;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('Photo is too large. Please choose a smaller image.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  return types[extension] || 'application/octet-stream';
}

function serveStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { message: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { message: 'File not found' });
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    res.end(content);
  });
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, savedHash] = storedHash.split(':');
  const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(savedHash, 'hex'), Buffer.from(computedHash, 'hex'));
}

async function isValidLogin(user, password) {
  if (!user) {
    return false;
  }

  if (user.passwordHash && verifyPassword(password, user.passwordHash)) {
    return true;
  }

  // Support older accounts created before password hashing was added,
  // then upgrade them the first time they log in successfully.
  if (user.password && user.password === password) {
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: createPasswordHash(password) },
        $unset: { password: '' },
      }
    );
    return true;
  }

  return false;
}

function createId() {
  return crypto.randomUUID();
}

async function initializeDatabase() {
  await client.connect();
  db = client.db(MONGODB_DB);
  usersCollection = db.collection('users');
  propertiesCollection = db.collection('properties');
  bookingsCollection = db.collection('bookings');

  await Promise.all([
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    propertiesCollection.createIndex({ ownerId: 1, createdAt: -1 }),
    bookingsCollection.createIndex({ userId: 1, 'property.id': 1 }, { unique: true }),
  ]);
}

function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}

async function handleApi(req, res) {
  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true, mode: 'mongodb', database: MONGODB_DB });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/properties') {
    const properties = await propertiesCollection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    sendJson(res, 200, { properties });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/bookings')) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const userId = requestUrl.searchParams.get('userId');
    const ownerId = requestUrl.searchParams.get('ownerId');
    let query = {};

    if (userId) {
      query = { userId };
    } else if (ownerId) {
      query = { 'property.ownerId': ownerId };
    }

    const bookings = await bookingsCollection
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    sendJson(res, 200, { bookings });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/register') {
    const { name, email, password, role = 'user' } = await getRequestBody(req);

    if (!name || !email || !password) {
      sendJson(res, 400, { message: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      sendJson(res, 400, { message: 'Password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = role === 'owner' ? 'owner' : 'user';
    const user = {
      id: createId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: createPasswordHash(password),
      role: normalizedRole,
      createdAt: new Date(),
    };

    try {
      await usersCollection.insertOne(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        sendJson(res, 409, { message: 'An account with this email already exists' });
        return;
      }

      throw error;
    }

    sendJson(res, 201, { message: 'Account created successfully', user: publicUser(user) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/login') {
    const { email, password } = await getRequestBody(req);

    if (!email || !password) {
      sendJson(res, 400, { message: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await usersCollection.findOne({ email: normalizedEmail });

    if (!(await isValidLogin(user, password))) {
      sendJson(res, 401, { message: 'Invalid email or password' });
      return;
    }

    sendJson(res, 200, { message: 'Login successful', user: publicUser(user) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/properties') {
    const { title, location, price, type, image, ownerId, ownerName, contactNumber } =
      await getRequestBody(req);

    if (!title || !location || !price || !type || !ownerId || !ownerName || !contactNumber) {
      sendJson(res, 400, { message: 'All property fields are required' });
      return;
    }

    const owner = await usersCollection.findOne({ id: ownerId, role: 'owner' });

    if (!owner) {
      sendJson(res, 403, { message: 'Only owners can add properties' });
      return;
    }

    const property = {
      id: createId(),
      title: title.trim(),
      location: location.trim(),
      price: Number(price),
      type,
      image,
      ownerId,
      ownerName: ownerName.trim(),
      contactNumber: contactNumber.trim(),
      createdAt: new Date(),
    };

    await propertiesCollection.insertOne(property);
    sendJson(res, 201, { message: 'Property added successfully', property: { ...property, createdAt: undefined } });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/properties/')) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const propertyId = decodeURIComponent(requestUrl.pathname.replace('/api/properties/', ''));
    const ownerId = requestUrl.searchParams.get('ownerId');

    if (!propertyId || !ownerId) {
      sendJson(res, 400, { message: 'Property and owner are required' });
      return;
    }

    const property = await propertiesCollection.findOne({ id: propertyId }, { projection: { _id: 0 } });

    if (!property) {
      sendJson(res, 404, { message: 'Property not found' });
      return;
    }

    if (property.ownerId !== ownerId) {
      sendJson(res, 403, { message: 'You can only delete your own properties' });
      return;
    }

    await propertiesCollection.deleteOne({ id: propertyId });
    await bookingsCollection.deleteMany({ 'property.id': propertyId });

    sendJson(res, 200, { message: 'Property deleted successfully' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/bookings') {
    const { userId, tenantName, tenantEmail, property } = await getRequestBody(req);

    if (!userId || !tenantName || !tenantEmail || !property || !property.id) {
      sendJson(res, 400, { message: 'User and property are required' });
      return;
    }

    const user = await usersCollection.findOne({ id: userId, role: 'user' });

    if (!user) {
      sendJson(res, 403, { message: 'Only users can book properties' });
      return;
    }

    const booking = {
      id: createId(),
      userId,
      tenantName: tenantName.trim(),
      tenantEmail: tenantEmail.trim().toLowerCase(),
      property,
      status: 'Pending',
      bookedAt: new Date().toLocaleDateString('en-IN'),
      createdAt: new Date(),
    };

    try {
      await bookingsCollection.insertOne(booking);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        sendJson(res, 409, { message: 'You have already booked this property' });
        return;
      }

      throw error;
    }

    sendJson(res, 201, { message: 'Booking saved successfully', booking });
    return;
  }

  if (req.method === 'PATCH' && req.url.startsWith('/api/bookings/')) {
    const bookingId = decodeURIComponent(req.url.split('?')[0].replace('/api/bookings/', ''));
    const { ownerId, status } = await getRequestBody(req);

    if (!bookingId || !ownerId || !status) {
      sendJson(res, 400, { message: 'Booking, owner, and status are required' });
      return;
    }

    if (!['Accepted', 'Rejected'].includes(status)) {
      sendJson(res, 400, { message: 'Invalid booking status' });
      return;
    }

    const booking = await bookingsCollection.findOne({ id: bookingId });

    if (!booking) {
      sendJson(res, 404, { message: 'Booking not found' });
      return;
    }

    if (booking.property.ownerId !== ownerId) {
      sendJson(res, 403, { message: 'You can only update bookings for your own properties' });
      return;
    }

    await bookingsCollection.updateOne({ id: bookingId }, { $set: { status } });

    sendJson(res, 200, { message: `Booking ${status.toLowerCase()} successfully` });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/api/bookings/')) {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const bookingId = decodeURIComponent(requestUrl.pathname.replace('/api/bookings/', ''));
    const userId = requestUrl.searchParams.get('userId');

    if (!bookingId || !userId) {
      sendJson(res, 400, { message: 'Booking and user are required' });
      return;
    }

    const booking = await bookingsCollection.findOne({ id: bookingId });

    if (!booking) {
      sendJson(res, 404, { message: 'Booking not found' });
      return;
    }

    if (booking.userId !== userId) {
      sendJson(res, 403, { message: 'You can only delete your own bookings' });
      return;
    }

    if (!['Accepted', 'Rejected'].includes(booking.status)) {
      sendJson(res, 400, { message: 'Only accepted or rejected bookings can be deleted' });
      return;
    }

    await bookingsCollection.deleteOne({ id: bookingId });

    sendJson(res, 200, { message: 'Booking deleted successfully' });
    return;
  }

  sendJson(res, 404, { message: 'API route not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      await handleApi(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server error' });
  }
});

async function startServer() {
  await initializeDatabase();

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Connected to MongoDB database "${MONGODB_DB}"`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
