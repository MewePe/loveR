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
    role ENUM('VISITOR', 'READER', 'AUTHOR', 'ADMIN') DEFAULT 'READER',
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
