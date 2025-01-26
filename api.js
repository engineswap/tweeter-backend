const db = require('better-sqlite3')('./database.db');
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express();
const port = 8080;
const cors = require('cors');
require('dotenv').config();

// Create tables if they dont exist
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    biography TEXT,
    profile_picture_url TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createTweetsTable = `
CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    is_reply BOOLEAN DEFAULT FALSE,
    parent_tweet_id INTEGER DEFAULT NULL,
    FOREIGN KEY (author_id) REFERENCES users (id) 
);
`;

const createFollowTable = `
CREATE TABLE IF NOT EXISTS follows (
    follower INTEGER NOT NULL,
    followed INTEGER NOT NULL,
    FOREIGN KEY (follower) REFERENCES users (id) ,
    FOREIGN KEY (followed) REFERENCES users (id) 
);
`;

const createLikesTable = `
CREATE TABLE IF NOT EXISTS likes (
    liker INTEGER NOT NULL,
    tweet_id INTEGER NOT NULL,
    FOREIGN KEY (liker) REFERENCES users (id),
    FOREIGN KEY (tweet_id) REFERENCES tweets (id)
);
`;

db.exec(createUsersTable);
db.exec(createTweetsTable);
db.exec(createFollowTable);
db.exec(createLikesTable);

// Middleware to parse json bodies
// app.use(express.json());

// Middleware to parse URL-encoded bodies
// app.use(express.urlencoded({ extended: true }));

//Middleware to increase payload size limit
app.use(express.json({limit:'5mb', extended:true}));
app.use(express.urlencoded({ limit: '5mb', extended: true, }));
app.use(express.text({ limit: '5mb' }));

// Middleware to inject DB
app.use((req,res,next)=>{
    req.db = db;
    next();
});

// Middleware to authenticate JWT
function authenticateJWT(req, res, next){
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).send("Unauthorized, please log in");
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Save id and username to req
        next();
    } catch (error) {
        console.error(`Token verification failed: ${error.message}`) 
        return res.status(403).send("Invalid or expired token.");
    }
}
module.exports = {authenticateJWT};

// Allow requests from localhost:3000
app.use(cors({ origin: 'http://localhost:3000' }));

// For APIs that need credentials like cookies or tokens
// app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

//import routes
const authRoutes = require('./routes/auth.js');
const tweetRoutes = require('./routes/tweets.js');
const userRoutes = require('./routes/users.js');
const searchRoutes = require('./routes/search.js');

// add base route

app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);

app.listen(port, ()=>{
    console.log(`API listening on port ${port}`)
})
