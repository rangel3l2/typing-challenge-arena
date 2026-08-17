CREATE TABLE public.programming_progress (
  session_id text PRIMARY KEY,
  program_xml text NOT NULL DEFAULT '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
  python_code text NOT NULL DEFAULT '',
  hardware_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  arena_level text NOT NULL DEFAULT 'easy' CHECK (arena_level IN ('easy', 'medium', 'hard')),
  program_mode text NOT NULL DEFAULT 'blocks' CHECK (program_mode IN ('blocks', 'code')),
  tile_points integer NOT NULL DEFAULT 0 CHECK (tile_points >= 0),
  challenge_points integer NOT NULL DEFAULT 0 CHECK (challenge_points >= 0),
  total_points integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_programming_progress_updated_at
  ON public.programming_progress(updated_at DESC);

ALTER TABLE public.programming_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read programming progress"
  ON public.programming_progress FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can create programming progress"
  ON public.programming_progress FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update programming progress"
  ON public.programming_progress FOR UPDATE TO public USING (true) WITH CHECK (true);
