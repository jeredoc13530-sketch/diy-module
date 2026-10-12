-- ============================================================================
--  SCHEMA POSTGRES (équivalent pur SQL du schema.prisma)
--  À utiliser si tu ne veux pas passer par Prisma (migrations manuelles)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types énumérés
CREATE TYPE user_role AS ENUM ('USER', 'EDITOR', 'ADMIN');

CREATE TYPE tip_category AS ENUM (
  'HOUSEHOLD', 'FOOD', 'HYGIENE', 'TOBACCO', 'ALCOHOL', 'COSMETICS', 'OTHER'
);

CREATE TYPE difficulty AS ENUM ('EASY', 'MEDIUM', 'EXPERT');

CREATE TYPE safety_category AS ENUM ('HEALTH', 'CHEMICAL', 'FOOD', 'LEGAL', 'MATERIAL');

CREATE TYPE severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE moderation_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE log_status AS ENUM ('WANT_TO_TRY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TYPE finding_category AS ENUM (
  'UPCYCLING', 'TROC', 'LOCAL', 'BRICOLAGE', 'RECUPERATION', 'TIP'
);

CREATE TYPE challenge_status AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

CREATE TYPE notification_type AS ENUM ('CHALLENGE_REMINDER', 'TIPS_APPROVED', 'NEW_FINDING');

-- Core users
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  name       VARCHAR(255),
  born_at    TIMESTAMPTZ,
  role       user_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

-- DIY tips
CREATE TABLE diy_tips (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref                VARCHAR(255) UNIQUE NOT NULL,
  source_url                  VARCHAR(512) NOT NULL,
  source_credit               VARCHAR(128) NOT NULL,
  source_license              VARCHAR(64),
  slug                        VARCHAR(128) UNIQUE NOT NULL,
  title                       VARCHAR(255) NOT NULL,
  description                 TEXT NOT NULL,
  category                    tip_category NOT NULL,
  difficulty                  difficulty NOT NULL,
  estimated_monthly_saving    FLOAT NOT NULL DEFAULT 0,
  learning_time_hours         FLOAT NOT NULL DEFAULT 0,
  equipment_cost              FLOAT NOT NULL DEFAULT 0,
  roi_months                  FLOAT NOT NULL DEFAULT 0,
  tags                        TEXT[] NOT NULL DEFAULT '{}',
  is_verified                 BOOLEAN NOT NULL DEFAULT false,
  moderation_status           moderation_status NOT NULL DEFAULT 'PENDING',
  reviewed_by                 uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at                 TIMESTAMPTZ,
  views                       INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diy_tips_category_difficulty ON diy_tips(category, difficulty);
CREATE INDEX idx_diy_tips_moderation_status ON diy_tips(moderation_status);
CREATE INDEX idx_diy_tips_estimated_monthly_saving ON diy_tips(estimated_monthly_saving DESC);
CREATE INDEX idx_diy_tips_slug ON diy_tips(slug);
CREATE INDEX idx_diy_tips_created_at ON diy_tips(created_at DESC);

-- DIY tip safety warnings
CREATE TABLE diy_tip_safety_warnings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id     uuid NOT NULL REFERENCES diy_tips(id) ON DELETE CASCADE,
  category   safety_category NOT NULL,
  text       TEXT NOT NULL,
  severity   severity NOT NULL DEFAULT 'MEDIUM',
  UNIQUE (tip_id, category)
);
CREATE INDEX idx_diy_tip_safety_warnings_tip_id ON diy_tip_safety_warnings(tip_id);

-- User tip logs (journal des essais + ROI)
CREATE TABLE user_tip_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tip_id                uuid NOT NULL REFERENCES diy_tips(id) ON DELETE RESTRICT,
  status                log_status NOT NULL,
  actual_monthly_saving FLOAT,
  equipment_bought      BOOLEAN NOT NULL DEFAULT false,
  equipment_cost        FLOAT,
  rating                INT CHECK (rating >= 1 AND rating <= 5),
  notes                 TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  UNIQUE (user_id, tip_id)
);
CREATE INDEX idx_user_tip_logs_user_status ON user_tip_logs(user_id, status);
CREATE INDEX idx_user_tip_logs_tip_status ON user_tip_logs(tip_id, status);

-- Community findings
CREATE TABLE community_findings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name    VARCHAR(128),
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL,
  category       finding_category NOT NULL,
  location       VARCHAR(128),
  is_verified    BOOLEAN NOT NULL DEFAULT false,
  status         moderation_status NOT NULL DEFAULT 'PENDING',
  upvotes        INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly challenges
CREATE TABLE weekly_challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  category        tip_category NOT NULL,
  target_percent  FLOAT NOT NULL,
  active_start_date TIMESTAMPTZ NOT NULL,
  active_end_date   TIMESTAMPTZ NOT NULL,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id    uuid NOT NULL REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress        FLOAT NOT NULL DEFAULT 0,
  status          challenge_status NOT NULL DEFAULT 'ACTIVE',
  week_number     INT NOT NULL,
  year            INT NOT NULL,
  UNIQUE (user_id, challenge_id)
);
CREATE INDEX idx_user_challenges_challenge_week ON user_challenges(challenge_id, week_number, year);

-- Notifications
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  link       VARCHAR(512),
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at sur mise à jour
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_diy_tips
  BEFORE UPDATE ON diy_tips FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_community_findings
  BEFORE UPDATE ON community_findings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_weekly_challenges
  BEFORE UPDATE ON weekly_challenges FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
