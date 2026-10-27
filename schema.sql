-- schema.sql

CREATE DATABASE IF NOT EXISTS loveread_db;
USE loveread_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255), -- For credentials provider
    image VARCHAR(255),
    role ENUM('VISITOR', 'READER', 'AUTHOR', 'ADMIN', 'BANNED') DEFAULT 'READER',
    coins INT NOT NULL DEFAULT 0, -- reader coin balance (1 coin = 1 baht)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    slug VARCHAR(255) UNIQUE
);

-- Novels Table
CREATE TABLE IF NOT EXISTS novels (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(255),
    status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'BANNED') DEFAULT 'DRAFT',
    author_id VARCHAR(36),
    category_id VARCHAR(36),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Chapters Table
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT,
    chapter_order INT,
    novel_id VARCHAR(36),
    views INT DEFAULT 0,
    price INT NOT NULL DEFAULT 0, -- coins; 0 = free
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
);

-- Comics Table
CREATE TABLE IF NOT EXISTS comics (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(255),
    status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'BANNED') DEFAULT 'DRAFT',
    author_id VARCHAR(36),
    category_id VARCHAR(36),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Comic Episodes Table
CREATE TABLE IF NOT EXISTS comic_episodes (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    episode_order INT,
    comic_id VARCHAR(36),
    views INT DEFAULT 0,
    price INT NOT NULL DEFAULT 0, -- coins; 0 = free
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
);

-- Comic Pages Table
CREATE TABLE IF NOT EXISTS comic_pages (
    id VARCHAR(36) PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    page_order INT,
    episode_id VARCHAR(36),
    FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE CASCADE
);

-- Bookmarks Table
CREATE TABLE IF NOT EXISTS bookmarks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    novel_id VARCHAR(36),
    comic_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
);
-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(36) PRIMARY KEY,
    reporter_id VARCHAR(36),
    target_id VARCHAR(36), -- novel_id, comic_id, or user_id
    target_type ENUM('NOVEL', 'COMIC', 'USER', 'COMMENT') NOT NULL,
    reason TEXT,
    status ENUM('PENDING', 'RESOLVED', 'IGNORED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id)
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(36) PRIMARY KEY,
    site_name VARCHAR(255) DEFAULT 'LoveRead',
    site_description TEXT,
    contact_email VARCHAR(255),
    maintenance_mode BOOLEAN DEFAULT FALSE,
    author_share_percent INT NOT NULL DEFAULT 70,
    payment_info TEXT, -- bank / PromptPay details shown on the coin top-up page
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT IGNORE INTO system_settings (id, site_name) VALUES ('1', 'LoveRead');

-- Writer Profiles Table
CREATE TABLE IF NOT EXISTS writer_profiles (
    user_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    id_card_number VARCHAR(20),
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    sub_district VARCHAR(100),
    postal_code VARCHAR(20),
    phone_number VARCHAR(20),
    bank_name VARCHAR(100),
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    id_card_image VARCHAR(255),
    bank_book_image VARCHAR(255),
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    amount DECIMAL(10, 2) NOT NULL,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(255),
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    slip_image VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Coin Top-ups Table (bank transfer slip, approved by admin)
CREATE TABLE IF NOT EXISTS coin_topups (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    amount INT NOT NULL,
    slip_image VARCHAR(255) NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Purchases Table (one row per unlocked chapter/episode; also the author earnings ledger)
CREATE TABLE IF NOT EXISTS purchases (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    chapter_id VARCHAR(36),
    episode_id VARCHAR(36),
    item_title VARCHAR(255),
    author_id VARCHAR(36) NOT NULL,
    price INT NOT NULL,
    author_earning DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_chapter (user_id, chapter_id),
    UNIQUE KEY uniq_user_episode (user_id, episode_id),
    INDEX idx_author (author_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Failed login attempts (rate limiting, see lib/loginThrottle.ts). Rows older than a day are pruned automatically.
CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_time (email, created_at),
    INDEX idx_ip_time (ip, created_at),
    INDEX idx_time (created_at)
);

-- Sign-up attempts per client IP, for rate-limiting /api/register (lib/registerThrottle.ts)
CREATE TABLE IF NOT EXISTS register_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_time (ip, created_at),
    INDEX idx_time (created_at)
);

-- Comments on a novel or comic (exactly one of novel_id / comic_id is set, like bookmarks)
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    novel_id VARCHAR(36),
    comic_id VARCHAR(36),
    parent_id VARCHAR(36), -- set on replies; replies are one level deep (the parent is always a top-level comment)
    body TEXT NOT NULL, -- plain text, rendered with whitespace-pre-line
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3), -- ms precision so newest-first ordering is stable
    INDEX idx_novel_time (novel_id, created_at),
    INDEX idx_comic_time (comic_id, created_at),
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_parent_time (parent_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Star ratings (1-5), one per user per novel/comic
CREATE TABLE IF NOT EXISTS ratings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    novel_id VARCHAR(36),
    comic_id VARCHAR(36),
    score TINYINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_novel (user_id, novel_id),
    UNIQUE KEY uniq_user_comic (user_id, comic_id),
    INDEX idx_novel (novel_id),
    INDEX idx_comic (comic_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
);

-- Last chapter/episode each user read, one row per user per novel/comic (lib/readingHistory.ts)
CREATE TABLE IF NOT EXISTS reading_history (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    novel_id VARCHAR(36),
    comic_id VARCHAR(36),
    chapter_id VARCHAR(36),
    episode_id VARCHAR(36),
    read_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uniq_user_novel (user_id, novel_id),
    UNIQUE KEY uniq_user_comic (user_id, comic_id),
    INDEX idx_user_time (user_id, read_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL
);

-- Every chapter/episode each user has opened (lib/readingHistory.ts), for marking read items in the episode picker
CREATE TABLE IF NOT EXISTS item_reads (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    chapter_id VARCHAR(36),
    episode_id VARCHAR(36),
    read_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uniq_user_chapter (user_id, chapter_id),
    UNIQUE KEY uniq_user_episode (user_id, episode_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE CASCADE
);

-- In-app notifications (lib/notifications.ts). message/link are written by the server; type is whitelisted in code
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    actor_id VARCHAR(36), -- who caused it; deleting that user removes the notifications they caused
    type VARCHAR(32) NOT NULL,
    message VARCHAR(500) NOT NULL,
    link VARCHAR(500) NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_user_unread (user_id, is_read),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories of each novel/comic (lib/categories.ts), up to 5 per story in the order the author picked them.
-- novels.category_id / comics.category_id are kept in sync with the first one for older code and backups; read these tables.
CREATE TABLE IF NOT EXISTS novel_categories (
    novel_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    sort_order TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (novel_id, category_id),
    INDEX idx_category (category_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comic_categories (
    comic_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    sort_order TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (comic_id, category_id),
    INDEX idx_category (category_id),
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
