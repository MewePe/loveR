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
    username VARCHAR(30) UNIQUE, -- public profile URL /profile/<username>: lowercase a-z 0-9 _ (lib/authors.ts)
    bio TEXT, -- public profile intro, plain text
    cover_image VARCHAR(255), -- public profile banner, /uploads/... only
    social_links TEXT, -- JSON { facebook, x, instagram, tiktok, youtube, website }, http(s) URLs only
    ban_reason TEXT, -- why an admin banned the user (role = 'BANNED')
    banned_at TIMESTAMP NULL,
    role_before_ban ENUM('VISITOR', 'READER', 'AUTHOR', 'ADMIN'), -- restored on unban
    reader_settings TEXT, -- JSON novel reader display settings (lib/readerSettings.ts)
    birth_date DATE NULL, -- saved when the user passes the 18+ age check (lib/ageGate.ts), never shown
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
    is_completed TINYINT(1) NOT NULL DEFAULT 0, -- author marked the story as finished ("จบแล้ว")
    is_mature TINYINT(1) NOT NULL DEFAULT 0, -- 18+ content: badge, and the cover is blurred on cards
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
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- APPROVED | PENDING | BLOCKED | REJECTED (lib/moderation.ts), only APPROVED is public
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
    is_completed TINYINT(1) NOT NULL DEFAULT 0, -- author marked the story as finished ("จบแล้ว")
    is_mature TINYINT(1) NOT NULL DEFAULT 0, -- 18+ content: badge, and the cover is blurred on cards
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
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- APPROVED | PENDING | BLOCKED | REJECTED (lib/moderation.ts), only APPROVED is public
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

-- Views per story per day (lib/views.ts), for the daily/weekly/monthly periods on /ranking
CREATE TABLE IF NOT EXISTS story_views_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    view_date DATE NOT NULL,
    novel_id VARCHAR(36),
    comic_id VARCHAR(36),
    views INT NOT NULL DEFAULT 0,
    UNIQUE KEY uniq_novel_date (novel_id, view_date),
    UNIQUE KEY uniq_comic_date (comic_id, view_date),
    INDEX idx_view_date (view_date),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
    FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
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

-- Readers following authors (public profile /profile/<username>). Followers hear about new stories and chapters.
CREATE TABLE IF NOT EXISTS follows (
    follower_id VARCHAR(36) NOT NULL,
    author_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, author_id),
    INDEX idx_author (author_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Coins a reader sent to an author ("สนับสนุน"). Part of the author earnings ledger like purchases
-- (author_earning = amount x author_share_percent at the time), so rows are not cascaded away.
CREATE TABLE IF NOT EXISTS supports (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    author_id VARCHAR(36) NOT NULL,
    amount INT NOT NULL,
    author_earning DECIMAL(10, 2) NOT NULL,
    message VARCHAR(200), -- plain text from the supporter
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_author_time (author_id, created_at),
    INDEX idx_user_time (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Coins an admin added to or removed from a user's balance (amount is negative for a deduction)
CREATE TABLE IF NOT EXISTS coin_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36),
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_time (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Every admin action (lib/adminLog.ts). admin_name is a snapshot so the log still reads after the admin is deleted.
CREATE TABLE IF NOT EXISTS admin_logs (
    id VARCHAR(36) PRIMARY KEY,
    admin_id VARCHAR(36),
    admin_name VARCHAR(255),
    action VARCHAR(40) NOT NULL, -- ADMIN_ACTIONS in lib/adminActions.ts
    target_type VARCHAR(20), -- USER, NOVEL, COMIC, COMMENT, REPORT, TOPUP, WITHDRAWAL, CATEGORY, SETTINGS
    target_id VARCHAR(36),
    target_label VARCHAR(255), -- name/title at the time, plain text
    detail VARCHAR(500), -- plain text written by the server
    reason TEXT, -- reason the admin typed, plain text
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_time (created_at),
    INDEX idx_action_time (action, created_at),
    INDEX idx_target (target_id),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Content checks of chapters/episodes by the Gemini API (lib/moderation.ts). One row per check; the admin queue
-- ("คิวตรวจเนื้อหา") is status = 'PENDING'. chapter_id/episode_id become NULL when the item is deleted, so the
-- author's history (the "10 clean chapters" trust rule) survives.
CREATE TABLE IF NOT EXISTS moderation_checks (
    id VARCHAR(36) PRIMARY KEY,
    item_type VARCHAR(10) NOT NULL, -- chapter | episode
    chapter_id VARCHAR(36) NULL,
    episode_id VARCHAR(36) NULL,
    story_id VARCHAR(36) NOT NULL, -- novel/comic id at the time
    author_id VARCHAR(36) NOT NULL,
    reporter_id VARCHAR(36) NULL, -- reader who reported a wrong label (source READER_REPORT)
    source VARCHAR(20) NOT NULL, -- SUBMIT | EDIT | READER_REPORT
    declared_mature TINYINT(1) NOT NULL DEFAULT 0, -- the story's 18+ label when checked
    verdict VARCHAR(20) NULL, -- SAFE | MATURE | EXPLICIT | ILLEGAL | MINOR | REFUSED | ERROR (NULL while checking)
    analysis TEXT, -- JSON { summary, issues: [{ page, category, reason }] }, Thai text from the API
    model VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'CHECKING', -- CHECKING | CLEARED | PENDING | APPROVED | REJECTED | SUPERSEDED
    reviewer_id VARCHAR(36) NULL,
    review_note TEXT, -- admin's reason, plain text
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_status_time (status, created_at),
    INDEX idx_author (author_id, status),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);
