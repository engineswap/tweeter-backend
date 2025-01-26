const express = require("express");
const router = express.Router();
const { Buffer } = require('buffer');
const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
});
const s3 = new AWS.S3();
const { authenticateJWT } = require('../api.js');

router.post('/:followedId/follow', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { followedId } = req.params;
    const followerId = req.user.id;

    if (followedId == followerId) {
        return res.status(401).send("You can't follow yourself.");
    }

    try {
        // Check if relationship already exists
        const exists = await req.db.query(`
            SELECT 1 FROM follows WHERE follower = $1 AND followed = $2 LIMIT 1;
        `, [followerId, followedId]);

        if (exists.rows.length > 0) {
            console.log("Exists already");
            return res.sendStatus(200);
        }

        // Add follower
        await req.db.query(`
            INSERT INTO follows (follower, followed)
            VALUES ($1, $2)
        `, [followerId, followedId]);

        console.log(`${followerId} followed ${followedId}`);
        return res.sendStatus(200);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.delete('/:followedId/follow', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { followedId } = req.params;
    const followerId = req.user.id;

    if (followedId == followerId) {
        return res.status(401).send("You can't unfollow yourself.");
    }

    try {
        // Check if relationship exists
        const exists = await req.db.query(`
            SELECT 1 FROM follows WHERE follower = $1 AND followed = $2 LIMIT 1;
        `, [followerId, followedId]);

        if (exists.rows.length === 0) {
            console.log("Already not following");
            return res.sendStatus(200);
        }

        // Remove follower
        await req.db.query(`
            DELETE FROM follows WHERE follower = $1 AND followed = $2;
        `, [followerId, followedId]);

        console.log(`${followerId} unfollowed ${followedId}`);
        return res.sendStatus(200);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.get('/:username', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { username } = req.params;

    try {
        // Basic info
        const info = await req.db.query(`
            SELECT id, username, biography, created_at, profile_picture_url 
            FROM users
            WHERE username = $1
        `, [username]);

        if (info.rows.length === 0) {
            return res.sendStatus(404);
        }

        const userInfo = info.rows[0];

        // Follower count
        const followers = await req.db.query(`
            SELECT COUNT(*) FROM follows WHERE followed = $1
        `, [userInfo.id]);

        const following = await req.db.query(`
            SELECT COUNT(*) FROM follows WHERE follower = $1
        `, [userInfo.id]);

        // Does user follow username?
        const isFollowingRes = await req.db.query(`
            SELECT * FROM follows WHERE followed = $1 AND follower = $2
        `, [userInfo.id, req.user.id]);

        userInfo.JWTUserId = req.user.id;
        userInfo.JWTUserFollows = isFollowingRes.rows.length > 0;

        userInfo.following = following.rows[0].count;
        userInfo.followers = followers.rows[0].count;

        return res.status(200).json(userInfo);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.post('/updateBiography', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { biography } = req.body;

    try {
        await req.db.query(`
            UPDATE users SET biography = $1 WHERE id = $2
        `, [biography, req.user.id]);

        return res.sendStatus(200);
    } catch (e) {
        return res.status(500).send(e.message);
    }
});

const uploadToS3 = async (fileData, bucketName, key, mimeType) => {
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: Buffer.from(fileData, 'base64'),
        ContentType: mimeType
    };

    try {
        const data = await s3.upload(params).promise();
        console.log(`File uploaded successfully at ${data.Location}`);
        return data.Location;
    } catch (err) {
        console.error('Error uploading file:', err);
        return null;
    }
};

router.post('/updateProfilePicture', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    try {
        const { fileName, fileType, fileData } = req.body;
        if (!fileName || !fileType || !fileData) {
            console.error('Invalid data type');
            return res.status(400).send('Invalid file data');
        }

        const allowedFileTypes = ['image/jpeg', 'image/png'];
        if (!allowedFileTypes.includes(fileType)) {
            console.error("Invalid file type: " + fileType);
            return res.status(400).send("Only JPEG and PNG files allowed");
        }

        const fileExtension = fileType === 'image/jpeg' ? '.jpg' : '.png';
        const s3Key = `profile-pictures/${req.user.username}${fileExtension}`;

        const s3Path = await uploadToS3(fileData, "twittercloneresources", s3Key);
        if (s3Path) {
            await req.db.query(`
                UPDATE users SET profile_picture_url = $1 WHERE id = $2
            `, [s3Path, req.user.id]);

            return res.sendStatus(200);
        } else {
            return res.status(500).send("Error occurred uploading your profile to AWS S3");
        }
    } catch (e) {
        const errStr = `Error changing profile picture: ${e.message}`;
        console.error(errStr);
        return res.status(500).send(errStr);
    }
});

module.exports = router;
