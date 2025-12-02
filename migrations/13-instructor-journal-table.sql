CREATE TABLE IF NOT EXISTS instructor_journal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    interactions TEXT,
    team_concerns TEXT,
    class_wide_issues TEXT,
    overall_course TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_instructor_journal_logs_user_id ON instructor_journal_logs(user_id);
