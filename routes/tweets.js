const express = require("express");
const router = express.Router();
const {authenticateJWT} = require('../api.js');

router.post('/', authenticateJWT, (req,res)=>{
    console.log(`${req.method} ${req.originalUrl}`);
    let {content,isReply,parentTweetId} = req.body;
    const userId = req.user.id;

    if (parentTweetId == undefined) parentTweetId = null;
    if (isReply == undefined) isReply = null;
    isReply = isReply ? 1 : 0 

    const addTweet = req.db.prepare(`
        INSERT INTO tweets (content, author_id, is_reply, parent_tweet_id)
        VALUES (?,?,?,?)
    `); 

    console.log(content, 
            userId, 
            isReply, 
            parentTweetId)
    
    try {
        const info = addTweet.run(
            content, 
            userId, 
            isReply, 
            parentTweetId); 
        console.log("Added tweet to db.");
        return res.sendStatus(200);
    } catch (error) {
        const errStr = `Error occured creating tweet: ${error.message}`
        console.error(errStr);
        return res.status(500).send(errStr); 
    }
});

router.get('/timeline', authenticateJWT, (req,res)=>{
    console.log(`${req.method} ${req.originalUrl}`);
    
    const userId = req.user.id;
    
    // Get all users our guy follows
    const getFollowedQuery = req.db.prepare(`
        SELECT followed FROM follows WHERE follower = ?
    `)
    let followed = getFollowedQuery.all(userId);
    followed = followed.map(row => row.followed); 
    followed.push(userId);

    if (followed.length==0){
        return res.status(200).json([]);
    }

    // Get timeline + join on user metadata
    const questionMarkArray = followed.map(()=>'?').join(', ');
    const timelineQuery = req.db.prepare(`
       SELECT tweets.*, 
            users.username, 
            users.profile_picture_url,
            CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users
            ON tweets.author_id=users.id
        LEFT JOIN likes
            ON likes.tweet_id=tweets.id AND likes.liker = ?
        WHERE author_id IN (${questionMarkArray})
        ORDER BY created_at DESC
        LIMIT 5
    `);

    try {
        followed.unshift(userId);
        const timeline = timelineQuery.all(...followed); 
        console.log(timeline);
        return res.status(200).json(timeline);
    } catch (error) {
        console.error(`Error fetching timeline: ${error.message}`);
        return res.status(500).send(error.message);
    }
});

router.get('/:username/', authenticateJWT, (req,res)=>{
    console.log(`${req.method} ${req.originalUrl}`);
    
    const {username} = req.params;

    // Get timeline + join on user metadata
    const timelineQuery = req.db.prepare(`
       SELECT tweets.*, 
            users.username, 
            users.profile_picture_url,
            CASE WHEN likes.liker IS NOT NULL THEN 1 ELSE 0 END AS liked
        FROM tweets 
        LEFT JOIN users
            ON tweets.author_id=users.id
        LEFT JOIN likes
            ON likes.tweet_id=tweets.id AND likes.liker = ?
        WHERE username = ? 
        ORDER BY created_at DESC
        LIMIT 5
    `);

    try {
        const timeline = timelineQuery.all(req.user.id, username); 
        console.log(timeline);
        return res.status(200).json(timeline);
    } catch (error) {
        console.error(`Error fetching timeline: ${error.message}`);
        return res.status(500).send(error.message);
    }
});


router.post('/:tweetId/like', authenticateJWT, (req, res)=>{
    console.log(`${req.method} ${req.originalUrl}`);

    const {tweetId} = req.params;
    const liker = req.user.id;
    
    try{
        // Check if like already exists
        const existsResponse = req.db.prepare(`
            SELECT 1 FROM likes WHERE liker = ? AND tweet_id = ?
        `).get(liker, tweetId);

        if (existsResponse){
            console.log("Already liked.");
            return res.sendStatus(200);
        }

        // Check if tweet exists
        const tweetExistsResponse = req.db.prepare(`
            SELECT 1 FROM tweets WHERE id=?
        `).run(tweetId);

        if (!tweetExistsResponse){
            console.log("Tweet doesnt exist");
            return res.status(404).send("Tweet doesnt exists.");
        }

        const addLikeResponse = req.db.prepare(`
            INSERT INTO likes (liker, tweet_id)
            VALUES (?,?)
        `).run(liker, tweetId);

        // Increment like count on tweet
        const incrementLikeCount = req.db.prepare(`
            UPDATE tweets
            SET likes_count = likes_count + 1
            WHERE id = ?
        `).run(tweetId);

        return res.sendStatus(200);
    }catch(error){
        console.error(`Error processing like: ${error.message}`);
        res.status(500).send(`Error processing like: ${error.message}`);
    }
});

router.delete('/:tweetId/like', authenticateJWT, (req, res)=>{
    console.log(`${req.method} ${req.originalUrl}`);

    const {tweetId} = req.params;
    const liker = req.user.id;
    
    try{
        // Check if like already exists
        const existsResponse = req.db.prepare(`
            SELECT 1 FROM likes WHERE liker = ? AND tweet_id = ?
        `).get(liker, tweetId);

        if (!existsResponse){
            console.log("Already not liked.");
            return res.sendStatus(200);
        }

        // Check if tweet exists
        const tweetExistsResponse = req.db.prepare(`
            SELECT 1 FROM tweets WHERE id=?
        `).run(tweetId);

        if (!tweetExistsResponse){
            console.log("Tweet doesnt exist");
            return res.status(404).send("Tweet doesnt exists.");
        }

        const RemoveLikeResponse = req.db.prepare(`
            DELETE FROM likes WHERE liker=? AND tweet_id=?
        `).run(liker, tweetId);

        // Decrement like count on tweet
        const incrementLikeCount = req.db.prepare(`
            UPDATE tweets
            SET likes_count = likes_count - 1
            WHERE id = ?
        `).run(tweetId);

        return res.sendStatus(200);
    }catch(error){
        console.error(`Error processing like: ${error.message}`);
        res.status(500).send(`Error processing like: ${error.message}`);
    }
});

module.exports = router;
