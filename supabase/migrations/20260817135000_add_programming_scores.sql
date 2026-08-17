CREATE TABLE public.programming_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  player_name text NOT NULL,
  player_code text NOT NULL,
  arena_level text NOT NULL CHECK (arena_level IN ('easy', 'medium', 'hard')),
  challenge_number integer NOT NULL CHECK (challenge_number BETWEEN 1 AND 10),
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  tile_points integer NOT NULL DEFAULT 0 CHECK (tile_points >= 0),
  challenge_points integer NOT NULL DEFAULT 0 CHECK (challenge_points >= 0),
  elapsed_seconds double precision NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT programming_scores_player_challenge_key UNIQUE (session_id, arena_level, challenge_number)
);

GRANT SELECT, INSERT, UPDATE ON public.programming_scores TO anon;
GRANT SELECT, INSERT, UPDATE ON public.programming_scores TO authenticated;
GRANT ALL ON public.programming_scores TO service_role;

CREATE INDEX idx_programming_scores_ranking
  ON public.programming_scores(score DESC, completed_at ASC);

CREATE INDEX idx_programming_scores_player
  ON public.programming_scores(player_code, arena_level, challenge_number);

ALTER TABLE public.programming_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read programming scores"
  ON public.programming_scores FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create programming scores"
  ON public.programming_scores FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update programming scores"
  ON public.programming_scores FOR UPDATE TO public USING (true) WITH CHECK (true);
