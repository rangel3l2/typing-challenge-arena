ALTER TABLE public.programming_progress
  ADD COLUMN IF NOT EXISTS basic_knowledge_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_missions jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.programming_progress AS progress
SET completed_missions = COALESCE((
  SELECT jsonb_agg(scores.arena_level || ':' || scores.challenge_number ORDER BY scores.arena_level, scores.challenge_number)
  FROM public.programming_scores AS scores
  WHERE scores.session_id = progress.session_id
    AND scores.challenge_number BETWEEN 1 AND 10
), '[]'::jsonb)
WHERE progress.completed_missions = '[]'::jsonb;

-- The immediately previous app version encoded this choice as beginner = 10.
-- Preserve those confirmations while keeping players who really completed all
-- ten beginner missions classified as mission completers, not as skippers.
UPDATE public.programming_progress AS progress
SET basic_knowledge_confirmed = true
WHERE progress.basic_knowledge_confirmed = false
  AND CASE
    WHEN jsonb_typeof(progress.unlocked_missions -> 'beginner') = 'number'
      THEN (progress.unlocked_missions ->> 'beginner')::integer
    WHEN COALESCE(progress.unlocked_missions ->> 'beginner', '') ~ '^[0-9]+$'
      THEN (progress.unlocked_missions ->> 'beginner')::integer
    ELSE 0
  END >= 10
  AND (
    SELECT COUNT(DISTINCT scores.challenge_number)
    FROM public.programming_scores AS scores
    WHERE scores.session_id = progress.session_id
      AND scores.arena_level = 'beginner'
      AND scores.challenge_number BETWEEN 1 AND 10
  ) < 10;

ALTER TABLE public.programming_progress
  DROP CONSTRAINT IF EXISTS programming_progress_completed_missions_array_check;

ALTER TABLE public.programming_progress
  ADD CONSTRAINT programming_progress_completed_missions_array_check
  CHECK (jsonb_typeof(completed_missions) = 'array');
