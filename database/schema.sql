-- GazaServe Database Schema
-- MySQL Database for GazaServe Telegram Bot

CREATE DATABASE IF NOT EXISTS gazaserve_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gazaserve_db;

-- ============================================================
-- 1. Users Table (Clients)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id      BIGINT       NOT NULL PRIMARY KEY COMMENT 'Telegram Chat ID',
    full_name    VARCHAR(150) NOT NULL COMMENT 'Full name of the client',
    phone_number VARCHAR(20)  NOT NULL COMMENT 'Contact phone number',
    location     VARCHAR(100) NOT NULL COMMENT 'Residential area in Gaza',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Technicians Table
-- ============================================================
CREATE TABLE IF NOT EXISTS technicians (
    tech_id      BIGINT       NOT NULL PRIMARY KEY COMMENT 'Telegram Chat ID',
    full_name    VARCHAR(150) NOT NULL COMMENT 'Technician full name',
    phone_number VARCHAR(20)  NOT NULL COMMENT 'Contact phone number',
    category     VARCHAR(100) NOT NULL COMMENT 'Trade specialty (plumbing, electrical, etc.)',
    location     VARCHAR(100) NOT NULL COMMENT 'Geographical work area in Gaza',
    is_available BOOLEAN      NOT NULL DEFAULT TRUE COMMENT 'Current availability status',
    rating_avg   DECIMAL(3,2) NOT NULL DEFAULT 0.00 COMMENT 'Average rating (0.00 - 5.00)',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Service Requests Table
-- ============================================================
CREATE TABLE IF NOT EXISTS service_requests (
    request_id          INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id           BIGINT         NOT NULL COMMENT 'FK to users.user_id',
    tech_id             BIGINT         NULL     COMMENT 'FK to technicians.tech_id (assigned)',
    extracted_category  VARCHAR(100)   NOT NULL COMMENT 'AI-extracted service category',
    problem_description TEXT           NOT NULL COMMENT 'Problem description (text or transcribed)',
    status              ENUM('pending', 'accepted', 'completed', 'canceled')
                                       NOT NULL DEFAULT 'pending',
    confirmation_code   VARCHAR(4)     NULL     COMMENT '4-digit verification code',
    voice_note_url      VARCHAR(500)   NULL     COMMENT 'Optional voice note file URL',
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_request_client
        FOREIGN KEY (client_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_request_technician
        FOREIGN KEY (tech_id) REFERENCES technicians(tech_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Ratings Table
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    rating_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id  INT          NOT NULL COMMENT 'FK to service_requests.request_id',
    stars       INT          NOT NULL COMMENT 'Rating 1-5',
    comment     TEXT         NULL     COMMENT 'Optional client comment',
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rating_request
        FOREIGN KEY (request_id) REFERENCES service_requests(request_id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT chk_stars_range CHECK (stars >= 1 AND stars <= 5),

    CONSTRAINT uq_request_rating UNIQUE (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
