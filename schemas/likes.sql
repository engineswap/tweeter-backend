CREATE TABLE IF NOT EXISTS likes (
    liker INTEGER NOT NULL,
    tweet_id INTEGER NOT NULL,
    FOREIGN KEY (liker) REFERENCES users (id),
    FOREIGN KEY (tweet_id) REFERENCES tweets (id)
);
