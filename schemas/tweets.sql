CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES users (id) 
);
