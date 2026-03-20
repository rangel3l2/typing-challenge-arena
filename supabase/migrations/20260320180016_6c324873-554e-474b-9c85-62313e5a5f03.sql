
CREATE TABLE public.player_identities (
  session_id text PRIMARY KEY,
  player_code text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.player_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read identities" ON public.player_identities FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create identities" ON public.player_identities FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update identities" ON public.player_identities FOR UPDATE TO public USING (true);
