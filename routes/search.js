const express = require("express");
const router = express.Router();
const { authenticateJWT } = require('../api.js');

router.get('/', authenticateJWT, (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { type, page = 1, query } = req.query;
    const validTypes = ["users", "tweets"];

    if (!validTypes.includes(type)) {
        return res.status(400).send("Type invalid");
    } else if (!query || query == "") {
        return res.json([]).status(200);
    }

    const searchUsersQuery = req.db.prepare(`
        SELECT id, username, profile_picture_url, biography
        FROM users 
        WHERE username LIKE ? 
        LIMIT 10 OFFSET ?
    `);

    const searchTweetsQuery = req.db.prepare(`
        SELECT tweets.*, 
            users.username, 
            users.profile_picture_url,
            CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users ON users.id=tweets.author_id
        LEFT JOIN likes
            ON likes.tweet_id=tweets.id AND likes.liker = ?
        WHERE tweets.content LIKE ? 
        LIMIT 10 OFFSET ?
    `);

    try {
        let results;
        if (type == "users") {
            results = searchUsersQuery.all(`%${query}%`, (page - 1) * 10);
        } else if (type == 'tweets') {
            results = searchTweetsQuery.all(req.user.id,`%${query}%`, (page - 1) * 10);
        }
        console.log(results)
        return res.json(results).status(200);
    } catch (e) {
        const errStr = `Error with SQL query: ${e.message}`;
        console.error(errStr);
        return res.send(errStr).status(500);
    }
});

module.exports = router;
