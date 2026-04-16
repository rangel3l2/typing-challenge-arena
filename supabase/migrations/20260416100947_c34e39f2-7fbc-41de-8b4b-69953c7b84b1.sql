
-- Create room_messages table for chat
CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_color TEXT NOT NULL DEFAULT '#888888',
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read room messages"
ON public.room_messages FOR SELECT
USING (true);

CREATE POLICY "Anyone can send messages"
ON public.room_messages FOR INSERT
WITH CHECK (true);

-- Index for fast room-based queries
CREATE INDEX idx_room_messages_room_id ON public.room_messages(room_id, created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

-- Audio storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-audio', 'chat-audio', true);

CREATE POLICY "Anyone can upload chat audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-audio');

CREATE POLICY "Anyone can read chat audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-audio');
