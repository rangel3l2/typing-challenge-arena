ALTER TABLE public.programming_progress
  DROP CONSTRAINT IF EXISTS programming_progress_arena_level_check;

ALTER TABLE public.programming_progress
  ADD CONSTRAINT programming_progress_arena_level_check
  CHECK (arena_level IN ('beginner', 'easy', 'medium', 'hard'));

ALTER TABLE public.programming_scores
  DROP CONSTRAINT IF EXISTS programming_scores_arena_level_check;

ALTER TABLE public.programming_scores
  ADD CONSTRAINT programming_scores_arena_level_check
  CHECK (arena_level IN ('beginner', 'easy', 'medium', 'hard'));
