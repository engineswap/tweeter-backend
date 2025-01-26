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

router.post('/:followedId/follow', authenticateJWT, (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { followedId } = req.params;
    const followerId = req.user.id;

    if (followedId == followerId) {
        return res.status(401).send("You cant follow yourself.");
    }

    // Check if relationship already exists
    const checkExists = req.db.prepare(`
        SELECT 1 FROM follows WHERE follower = ? AND followed = ? LIMIT 1;
    `);
    const exists = checkExists.get(followerId, followedId);

    if (exists) {
        console.log("Exists already")
        return res.sendStatus(200);
    }

    const addFollower = req.db.prepare(`
        INSERT INTO follows (follower, followed)
        VALUES (?,?)
    `);

    try {
        const info = addFollower.run(followerId, followedId);
        console.log(`${followerId} followed ${followedId}`);
        return res.sendStatus(200);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

// TODO: Add a limit to delete when not using sqlite3
router.delete('/:followedId/follow', authenticateJWT, (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { followedId } = req.params;
    const followerId = req.user.id;

    if (followedId == followerId) {
        return res.status(401).send("You cant unfollow yourself.");
    }

    // Check if relationship already exists
    const checkExists = req.db.prepare(`
        SELECT 1 FROM follows WHERE follower = ? AND followed = ? LIMIT 1;
    `);
    const exists = checkExists.get(followerId, followedId);

    if (!exists) {
        console.log("Already not following")
        return res.sendStatus(200);
    }

    const removeFollower = req.db.prepare(`
        DELETE FROM follows WHERE follower=? AND followed=?;
    `);

    try {
        const info = removeFollower.run(followerId, followedId);
        console.log(`${followerId} unfollowed ${followedId}`);
        return res.sendStatus(200);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.get('/:username', authenticateJWT, (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { username } = req.params;
    try {
        // Basic info
        const info = req.db.prepare(
            `SELECT id, username, biography, created_at, profile_picture_url 
            FROM users
            WHERE username=?
        `).get(username);
        console.log(info);
        // Follower count
        const followers = req.db.prepare(`SELECT COUNT(*) FROM follows WHERE followed=?`).all(info.id);
        const following = req.db.prepare(`SELECT COUNT(*) FROM follows WHERE follower=?`).all(info.id);

        // Does user follow username?
        const isFollowingRes = req.db.prepare(`SELECT * FROM follows WHERE followed=? AND follower=?`).get(info.id, req.user.id);
        info.JWTUserId = req.user.id;
        info.JWTUserFollows = (isFollowingRes) ? true : false

        info.following = following[0][`COUNT(*)`];
        info.followers = followers[0][`COUNT(*)`];
        if (!info) {
            return res.sendStatus(404);
        }
        return res.status(200).json(info);
    } catch (error) {
        return res.status(500).send(error.message);
    }
});

router.post('/updateBiography', authenticateJWT, (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    const { biography } = req.body;

    try {
        const updateBioRes = req.db.prepare(`
            UPDATE users SET biography = ? WHERE id = ? 
        `).run(biography, req.user.id);
        return res.sendStatus(200)
    } catch (e) {
        return res.status(500).send(e.message);
    }
});

const uploadToS3 = async (fileData, bucketName, key, mimeType) => {
    const params = {
        Bucket: bucketName,
        Key: key, // The file name in S3
        Body: Buffer.from(fileData, 'base64'),
        ContentType: mimeType
        // ACL: 'public-read' // Allow public access (if needed)
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

// If an old one exists we must overwrite it - s3 does this by default
router.post('/updateProfilePicture', authenticateJWT, async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);

    try {
        const { fileName, fileType, fileData } = req.body;
        if (!fileName || !fileType || !fileData) {
            console.error('Invalid data type');
            return res.status(400).send('Invalid file data');
        }
        // Ensure file type is correct
        const allowedFileTypes = ['image/jpeg', 'image/png'];
        if (!allowedFileTypes.includes(fileType)) {
            console.error("Invalid file type: " + fileType);
            return res.status(400).send("Only JPEG and PNG files allowed");
        }

        const fileExtension = fileType == 'image/jpeg' ? '.jpg' : '.png';
        const s3Key = `profile-pictures/${req.user.username}${fileExtension}`;

        const s3Path = await uploadToS3(fileData, "twittercloneresources", s3Key);
        console.log(s3Path);
        if (s3Path) {
            // Update the path in db
            const dbUpdateRes = req.db.prepare(`
                UPDATE users SET profile_picture_url = ? WHERE id = ?
            `).run(s3Path, req.user.id);

            return res.sendStatus(200);
        } else {
            return res.status(500).send("Error occured uploading your profile to AWS s3");
        }
    } catch (e) {
        const errStr = `Error changing profile picture ${e.message}`
        console.error(errStr);
        return res.status(500).send(errStr);
    }
});



module.exports = router;
