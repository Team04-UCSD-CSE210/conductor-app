-- TA Journal Logs Table
CREATE TABLE IF NOT EXISTS ta_journal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    interactions TEXT,
    groups_with_concerns TEXT,
    students_to_reach TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ta_journal_logs_user_id ON ta_journal_logs(user_id);

-- Tutor Journal Logs Table
CREATE TABLE IF NOT EXISTS tutor_journal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    students_helped TEXT,
    students_needing_attention TEXT,
    preparation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tutor_journal_logs_user_id ON tutor_journal_logs(user_id);
