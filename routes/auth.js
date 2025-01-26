const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/register', async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { username, email, password } = req.body;

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save user to db
    const addUser = `
        INSERT INTO users (email, username, password)
        VALUES ($1,$2,$3)
    `;

    try {
        const info = await req.db.query(addUser, [email, username, hashedPassword]);
        return res.sendStatus(200);
    } catch (error) {
        console.log(error.message)
        res.status(500).send(error.message);
    }
})

router.post('/login', async (req, res) => {
    console.log(`${req.method} ${req.originalUrl}`);
    const { username, password } = req.body;

    // Try to find user
    const userRes = await req.db.query('SELECT * FROM users WHERE username = $1 LIMIT 1;', [username]) 
    if (!userRes.rows.length>0) {
        return res.status(500).send("User not found!");
    }
    const user = userRes.rows[0];

    // Check passwords match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).send("Incorrect password!");
    }

    let token;
    try {
        token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '1d' }
        )
    } catch (error) {
        console.error(`Error signing JWT token: ${error.message}`);
        return res.status(500).send("Error signed JWT token.");
    }

    return res.status(200).json({ token });
})

module.exports = router;
