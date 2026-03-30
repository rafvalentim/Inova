-- CreateTable sprint_tasks (many-to-many entre Sprint e Task)
CREATE TABLE "sprint_tasks" (
    "id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_tasks_pkey" PRIMARY KEY ("id")
);

-- Migrar dados existentes de tasks.sprint_id para sprint_tasks
INSERT INTO "sprint_tasks" ("id", "sprint_id", "task_id", "added_at")
SELECT gen_random_uuid()::TEXT, "sprint_id", "id", "created_at"
FROM "tasks"
WHERE "sprint_id" IS NOT NULL;

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX "sprint_tasks_sprint_id_task_id_key" ON "sprint_tasks"("sprint_id", "task_id");

-- Foreign keys com CASCADE
ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_sprint_id_fkey"
    FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sprint_tasks" ADD CONSTRAINT "sprint_tasks_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remover coluna sprint_id da tabela tasks (dados já migrados)
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "sprint_id";
