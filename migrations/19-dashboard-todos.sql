-- =====================================================
-- 19. DASHBOARD_TODOS
-- Per-user dashboard TODO items
-- =====================================================

CREATE TABLE IF NOT EXISTS dashboard_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_todos_user ON dashboard_todos(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_todos_position ON dashboard_todos(user_id, position);

DROP TRIGGER IF EXISTS update_dashboard_todos_updated_at ON dashboard_todos;
CREATE TRIGGER update_dashboard_todos_updated_at BEFORE UPDATE ON dashboard_todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE dashboard_todos IS 'Per-user dashboard TODO items';


