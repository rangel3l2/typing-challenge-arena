
CREATE TABLE public.acertar_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  player_name text NOT NULL,
  player_code text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  phase_reached integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.acertar_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read acertar scores" ON public.acertar_scores FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert acertar scores" ON public.acertar_scores FOR INSERT TO public WITH CHECK (true);
