-- Migration: Add `code` field to Task model (TASK-001 sequential identifier)
-- Generated: 2026-03-09
-- HOW TO RUN: psql -U postgres -d inova -f migration.sql
--             OR via Prisma: npx prisma db execute --file migration.sql

-- Step 1: Add column as nullable first (existing rows need a value)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Step 2: Backfill existing tasks with sequential codes
DO $$
DECLARE
    r RECORD;
    counter INTEGER := 1;
BEGIN
    FOR r IN
        SELECT id FROM tasks
        WHERE code IS NULL
        ORDER BY created_at ASC
    LOOP
        UPDATE tasks
        SET code = 'TASK-' || LPAD(counter::TEXT, 3, '0')
        WHERE id = r.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Step 3: Make column NOT NULL and UNIQUE now that all rows have a value
ALTER TABLE "tasks" ALTER COLUMN "code" SET NOT NULL;

-- Step 4: Add unique constraint (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tasks_code_key'
    ) THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_code_key" UNIQUE ("code");
    END IF;
END $$;

-- Step 5: Add index for fast lookup by code
CREATE INDEX IF NOT EXISTS "tasks_code_idx" ON "tasks"("code");
