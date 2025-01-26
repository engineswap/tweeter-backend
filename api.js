const db = require('better-sqlite3')('./database.db');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// Create tables if they dont exist
const createUsersTable = fs.readFileSync('./schemas/users.sql', 'utf8');
const createTweetsTable = fs.readFileSync('./schemas/tweets.sql', 'utf8');
const createFollowTable = fs.readFileSync('./schemas/follows.sql', 'utf8');
const createLikesTable = fs.readFileSync('./schemas/likes.sql', 'utf8');

db.exec(createUsersTable);
db.exec(createTweetsTable);
db.exec(createFollowTable);
db.exec(createLikesTable);

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

//import routes
const authRoutes = require('./routes/auth.js');
const tweetRoutes = require('./routes/tweets.js');
const userRoutes = require('./routes/users.js');
const searchRoutes = require('./routes/search.js');

app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);

app.listen(process.env.PORT, ()=>{
    console.log(`API listening on port ${process.env.PORT}`)
})
