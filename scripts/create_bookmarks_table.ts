import pool from '@/lib/db';

// Run this to create the bookmarks table
async function createBookmarksTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      content_type ENUM('novel', 'comic') NOT NULL,
      content_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_bookmark (user_id, content_type, content_id),
      INDEX idx_user (user_id),
      INDEX idx_content (content_type, content_id)
    )
  `);
    console.log('Bookmarks table created successfully');
    process.exit(0);
}

createBookmarksTable().catch(console.error);
