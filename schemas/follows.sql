CREATE TABLE IF NOT EXISTS follows (
    follower INTEGER NOT NULL,
    followed INTEGER NOT NULL,
    FOREIGN KEY (follower) REFERENCES users (id) ,
    FOREIGN KEY (followed) REFERENCES users (id) 
);
