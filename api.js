const { Client } = require('pg');
const listEndpoints = require('express-list-endpoints');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// Configure your PostgreSQL connection
const db = new Client({
    connectionString: process.env.DB_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false // Required for Render's PostgreSQL
    }
});

// Create tables if they dont exist
const createUsersTable = fs.readFileSync('./schemas/users.sql', 'utf8');
const createTweetsTable = fs.readFileSync('./schemas/tweets.sql', 'utf8');
const createFollowTable = fs.readFileSync('./schemas/follows.sql', 'utf8');
const createLikesTable = fs.readFileSync('./schemas/likes.sql', 'utf8');

async function createTables() {
    await db.connect();
    await db.query(createUsersTable);
    await db.query(createTweetsTable);
    await db.query(createFollowTable);
    await db.query(createLikesTable);
}
createTables();

// Connect to redis 
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379', // Use environment variable or default URL
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

async function connectToRedis() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
}

connectToRedis();

//Middleware to increase payload size limit
app.use(express.json({ limit: '5mb', extended: true }));
app.use(express.urlencoded({ limit: '5mb', extended: true, }));
app.use(express.text({ limit: '5mb' }));

// Middleware to inject DB & cache 
app.use((req, res, next) => {
    req.db = db;
    req.cache = redisClient;
    next();
});

// Middleware to authenticate JWT
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send("Unauthorized, please log in");
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Save id and username to req
        next(); } catch (error) {
        console.error(`Token verification failed: ${error.message}`)
        return res.status(403).send("Invalid or expired token.");
    }
}
module.exports = { authenticateJWT };

// Allow requests from localhost:3000
app.use(cors({ origin: 'https://tweeter-frontend.onrender.com' }));

//import routes
const authRoutes = require('./routes/auth.js');
const tweetRoutes = require('./routes/tweets.js');
const userRoutes = require('./routes/users.js');
const searchRoutes = require('./routes/search.js');

app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);

fs.writeFileSync('./routes.json', JSON.stringify(listEndpoints(app)));

app.listen(process.env.PORT, () => {
    console.log(`API listening on port ${process.env.PORT}`)
})
