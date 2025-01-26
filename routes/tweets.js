const express = require("express");
const router = express.Router();
const { authenticateJWT } = require('../api.js');

router.post('/', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    let { content, isReply, parentTweetId } = req.body;
    const userId = req.user.id;

    if (parentTweetId == undefined) parentTweetId = null;
    if (isReply == undefined) isReply = null;
    isReply = isReply ? 1 : 0

    const addTweet = `
        INSERT INTO tweets (content, author_id, is_reply, parent_tweet_id)
        VALUES ($1,$2,$3,$4)
    `;

    try {
        const info = await req.db.query(addTweet,
            [content,
                userId,
                isReply,
                parentTweetId]);
        console.log("Added tweet to db.");
        return res.sendStatus(200);
    } catch (error) {
        const errStr = `Error occured creating tweet: ${error.message}`
        console.error(errStr);
        return res.status(500).send(errStr);
    }
});

router.get('/timeline', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const userId = req.user.id;

    // Get all users our guy follows
    const getFollowedQuery = `
        SELECT followed FROM follows WHERE follower = $1 
    `;

    let followedRes = await req.db.query(getFollowedQuery, [userId]);

    let followed = followedRes.rows;

    followed = followed.map(row => row.followed);
    followed.push(userId);

    // Get timeline + join on user metadata
    const placeholders = followed.map((_, i) => '$' + (i + 2)).join(', ');
    const timelineQuery = `
       SELECT tweets.*, 
            users.username, 
            users.profile_picture_url,
            CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users
            ON tweets.author_id=users.id
        LEFT JOIN likes
            ON likes.tweet_id=tweets.id AND likes.liker = $1 
        WHERE author_id IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT 15 
    `;

    try {
        followed.unshift(userId);
        const result = await req.db.query(timelineQuery, followed);

        if (result.rows.length == 0) {
            return res.status(200).json([]);
        }

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error(`Error fetching timeline: ${error.message}`);
        return res.status(500).send(error.message);
    }
});

router.get('/:username/', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { username } = req.params;

    // Get timeline + join on user metadata
    const timelineQuery = `
       SELECT tweets.*, 
            users.username, 
            users.profile_picture_url,
            CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users
            ON tweets.author_id=users.id
        LEFT JOIN likes
            ON likes.tweet_id=tweets.id AND likes.liker = $1 
        WHERE username = $2 
        ORDER BY created_at DESC
        LIMIT 15
    `;

    try {
        const result = await req.db.query(timelineQuery, [req.user.id, username]);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error(`Error fetching timeline: ${error.message}`);
        return res.status(500).send(error.message);
    }
});


router.post('/:tweetId/like', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { tweetId } = req.params;
    const liker = req.user.id;

    try {
        // Check if like already exists
        const existsResponse = await req.db.query(`
            SELECT 1 FROM likes WHERE liker = $1 AND tweet_id = $2 
        `, [liker, tweetId]);

        if (existsResponse.rows.length > 0) {
            console.log("Already liked.");
            return res.sendStatus(200);
        }

        // Check if tweet exists
        const tweetExistsResponse = await req.db.query(`
            SELECT 1 FROM tweets WHERE id=$1
        `, [tweetId]);

        if (tweetExistsResponse.rows == 0) {
            console.log("Tweet doesnt exist");
            return res.status(404).send("Tweet doesnt exists.");
        }

        const addLikeResponse = await req.db.query(`
            INSERT INTO likes (liker, tweet_id)
            VALUES ($1,$2)
        `, [liker, tweetId]);

        // Increment like count on tweet
        const incrementLikeCount = req.db.query(`
            UPDATE tweets
            SET likes_count = likes_count + 1
            WHERE id = $1 
        `, [tweetId]);

        return res.sendStatus(200);
    } catch (error) {
        console.error(`Error processing like: ${error.message}`);
        res.status(500).send(`Error processing like: ${error.message}`);
    }
});

router.delete('/:tweetId/like', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { tweetId } = req.params;
    const liker = req.user.id;

    try {
        // Check if the like already exists
        const existsQuery = `
            SELECT 1 FROM likes WHERE liker = $1 AND tweet_id = $2
        `;
        const existsResponse = await req.db.query(existsQuery, [liker, tweetId]);

        if (existsResponse.rowCount === 0) {
            console.log("Already not liked.");
            return res.sendStatus(200);
        }

        // Check if the tweet exists
        const tweetExistsQuery = `
            SELECT 1 FROM tweets WHERE id = $1
        `;
        const tweetExistsResponse = await req.db.query(tweetExistsQuery, [tweetId]);

        if (tweetExistsResponse.rowCount === 0) {
            console.log("Tweet doesn't exist.");
            return res.status(404).send("Tweet doesn't exist.");
        }

        // Delete the like
        const removeLikeQuery = `
            DELETE FROM likes WHERE liker = $1 AND tweet_id = $2
        `;
        await req.db.query(removeLikeQuery, [liker, tweetId]);

        // Decrement the like count on the tweet
        const decrementLikeCountQuery = `
            UPDATE tweets
            SET likes_count = likes_count - 1
            WHERE id = $1
        `;
        await req.db.query(decrementLikeCountQuery, [tweetId]);

        return res.sendStatus(200);
    } catch (error) {
        console.error(`Error processing like: ${error.message}`);
        res.status(500).send(`Error processing like: ${error.message}`);
    }
});
module.exports = router;
