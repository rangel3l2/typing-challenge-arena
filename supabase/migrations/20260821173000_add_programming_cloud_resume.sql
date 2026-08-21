ALTER TABLE public.programming_progress
  ADD COLUMN IF NOT EXISTS current_challenge integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unlocked_missions jsonb NOT NULL DEFAULT '{"beginner":0,"easy":0,"medium":0,"hard":0}'::jsonb;

ALTER TABLE public.programming_progress
  DROP CONSTRAINT IF EXISTS programming_progress_current_challenge_check;

ALTER TABLE public.programming_progress
  ADD CONSTRAINT programming_progress_current_challenge_check
  CHECK (current_challenge BETWEEN 1 AND 10);
