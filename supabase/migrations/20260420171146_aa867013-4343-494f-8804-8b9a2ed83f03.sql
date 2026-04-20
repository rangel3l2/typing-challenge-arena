-- Global chat table for the home/lobby
CREATE TABLE public.global_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_code TEXT NOT NULL DEFAULT '',
  player_color TEXT NOT NULL DEFAULT '#888888',
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  room_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global messages"
  ON public.global_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can send global messages"
  ON public.global_messages FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_global_messages_created_at ON public.global_messages(created_at DESC);
CREATE INDEX idx_global_messages_session ON public.global_messages(session_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.global_messages;