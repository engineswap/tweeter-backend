const express = require("express");
const router = express.Router();
const { authenticateJWT } = require('../api.js');

router.get('/', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { type, page = 1, query } = req.query;
    const validTypes = ["users", "tweets"];

    if (!validTypes.includes(type)) {
        return res.status(400).send("Type invalid");
    } else if (!query || query.trim() === "") {
        return res.status(200).json([]);
    }

    const searchUsersQuery = `
        SELECT id, username, profile_picture_url, biography
        FROM users 
        WHERE username ILIKE $1 
        LIMIT 10 OFFSET $2
    `;

    const searchTweetsQuery = `
        SELECT tweets.*, 
               users.username, 
               users.profile_picture_url,
               CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users ON users.id = tweets.author_id
        LEFT JOIN likes ON likes.tweet_id = tweets.id AND likes.liker = $1
        WHERE tweets.content ILIKE $2 
        LIMIT 10 OFFSET $3
    `;

    try {
        let results;
        const offset = (page - 1) * 10;

        if (type === "users") {
            results = await req.db.query(searchUsersQuery, [`%${query}%`, offset]);
        } else if (type === "tweets") {
            results = await req.db.query(searchTweetsQuery, [req.user.id, `%${query}%`, offset]);
        }

        return res.status(200).json(results.rows);
    } catch (e) {
        const errStr = `Error with SQL query: ${e.message}`;
        console.error(errStr);
        return res.status(500).send(errStr);
    }
});

module.exports = router;
