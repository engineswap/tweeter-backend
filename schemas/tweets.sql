CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    is_reply BOOLEAN DEFAULT FALSE,
    parent_tweet_id INTEGER DEFAULT NULL,
    FOREIGN KEY (author_id) REFERENCES users (id) 
);
