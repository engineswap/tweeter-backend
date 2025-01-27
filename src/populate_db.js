const { Client } = require('pg');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
require('dotenv').config();

const db = new Client({
    connectionString: process.env.DB_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false // Required for Render's PostgreSQL
    }
});

// Load schema files
const createUsersTable = fs.readFileSync('./schemas/users.sql', 'utf8');
const createTweetsTable = fs.readFileSync('./schemas/tweets.sql', 'utf8');
const createFollowTable = fs.readFileSync('./schemas/follows.sql', 'utf8');
const createLikesTable = fs.readFileSync('./schemas/likes.sql', 'utf8');

async function dropTables() {
    console.log('Dropping existing tables...');
    await db.query('DROP TABLE IF EXISTS likes CASCADE');
    await db.query('DROP TABLE IF EXISTS follows CASCADE');
    await db.query('DROP TABLE IF EXISTS tweets CASCADE');
    await db.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('Dropped all tables.');
}

async function createTables() {
    console.log('Creating tables...');
    await db.query(createUsersTable);
    await db.query(createTweetsTable);
    await db.query(createFollowTable);
    await db.query(createLikesTable);
    console.log('Created all tables.');
}

async function main() {
    console.log('Connecting to the database...');
    await db.connect();
    console.log('Connected to the database.');

    // Drop existing tables and recreate them
    await dropTables();
    await createTables();

    // Create 100 users
    console.log('Creating 100 users...');
    for (let i = 0; i < 100; i++) {
        const email = faker.internet.email();
        const username = faker.internet.username();
        const password = '$2b$10$7wxUT8nYfqJvz.jd/g6ymOpxk9YujWiLiYeP58Ic8HoG62rgkTvM6'; // Hashed "password"
        const bio = faker.lorem.sentence();
        const profilePic = `https://picsum.photos/200/300?random=${i + 1}`;

        await db.query(
            'INSERT INTO users (email, username, password, biography, profile_picture_url) VALUES ($1, $2, $3, $4, $5)',
            [email, username, password, bio, profilePic]
        );
        console.log(`Created user ${i + 1}: ${username}`);
    }
    console.log('Finished creating users.');

    // Get all user IDs
    console.log('Fetching user IDs...');
    const userIds = (await db.query('SELECT id FROM users')).rows.map(row => row.id);
    console.log(`Fetched ${userIds.length} user IDs.`);

    // Create follows relationships
    console.log('Creating follow relationships...');
    for (const followerId of userIds) {
        const candidates = userIds.filter(id => id !== followerId);
        const followedIds = faker.helpers.shuffle(candidates).slice(0, 15);

        for (const followedId of followedIds) {
            await db.query(
                'INSERT INTO follows (follower, followed) VALUES ($1, $2)',
                [followerId, followedId]
            );
            console.log(`User ${followerId} is now following user ${followedId}.`);
        }
    }
    console.log('Finished creating follow relationships.');

    // Create tweets with random timestamps from past week
    console.log('Creating tweets...');
    for (const authorId of userIds) {
        for (let i = 0; i < 10; i++) {
            const content = faker.lorem.sentence();
            const randomDaysAgo = faker.number.int({ min: 1, max: 7 });
            const randomHours = faker.number.int({ min: 0, max: 23 });
            const randomMinutes = faker.number.int({ min: 0, max: 59 });
            const createdAt = new Date(Date.now() -
                (randomDaysAgo * 24 * 60 * 60 * 1000) -
                (randomHours * 60 * 60 * 1000) -
                (randomMinutes * 60 * 1000));

            await db.query(
                'INSERT INTO tweets (content, author_id, created_at) VALUES ($1, $2, $3)',
                [content, authorId, createdAt]
            );
            console.log(`Created tweet by user ${authorId}: "${content}"`);
        }
    }
    console.log('Finished creating tweets.');

    // Get all tweet IDs
    console.log('Fetching tweet IDs...');
    const tweetIds = (await db.query('SELECT id FROM tweets')).rows.map(row => row.id);
    console.log(`Fetched ${tweetIds.length} tweet IDs.`);

    // Create likes
    console.log('Creating likes...');
    for (const likerId of userIds) {
        const shuffledTweets = faker.helpers.shuffle(tweetIds);
        const likedTweets = shuffledTweets.slice(0, 10);

        for (const tweetId of likedTweets) {
            await db.query(
                'INSERT INTO likes (liker, tweet_id) VALUES ($1, $2)',
                [likerId, tweetId]
            );

            // Update likes count
            await db.query(
                'UPDATE tweets SET likes_count = likes_count + 1 WHERE id = $1',
                [tweetId]
            );
            console.log(`User ${likerId} liked tweet ${tweetId}.`);
        }
    }
    console.log('Finished creating likes.');

    console.log('Database seeding completed!');
    await db.end();
    console.log('Database connection closed.');
}

main().catch(err => {
    console.error('Error during seeding:', err);
    process.exit(1);
});
