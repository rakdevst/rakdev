-- ==============================================================================
-- MIGRATION: TUTORIALS & STORAGE SETUP UNTUK RAKDEV STUDIO
-- Jalankan skrip ini langsung di Supabase SQL Editor
-- ==============================================================================

-- 1. Buat / Lengkapi Tabel public.tutorials
CREATE TABLE IF NOT EXISTS public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  youtube_url TEXT,
  platform TEXT NOT NULL DEFAULT 'YouTube' CHECK (platform IN ('YouTube', 'TikTok', 'Instagram')),
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Tambahkan kolom jika tabel tutorials sudah ada tapi belum memiliki kolom-kolom baru
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'YouTube';
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.tutorials ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Sinkronkan youtube_url <-> video_url jika ada data lama
UPDATE public.tutorials SET video_url = youtube_url WHERE video_url IS NULL AND youtube_url IS NOT NULL;
UPDATE public.tutorials SET youtube_url = video_url WHERE youtube_url IS NULL AND video_url IS NOT NULL;

-- 2. Indexes untuk performa pencarian dan pengurutan
CREATE INDEX IF NOT EXISTS idx_tutorials_category ON public.tutorials(category);
CREATE INDEX IF NOT EXISTS idx_tutorials_platform ON public.tutorials(platform);
CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON public.tutorials(created_at DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutorials select" ON public.tutorials;
CREATE POLICY "Tutorials select" ON public.tutorials
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Tutorials admin insert" ON public.tutorials;
CREATE POLICY "Tutorials admin insert" ON public.tutorials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Tutorials admin update" ON public.tutorials;
CREATE POLICY "Tutorials admin update" ON public.tutorials
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Tutorials admin delete" ON public.tutorials;
CREATE POLICY "Tutorials admin delete" ON public.tutorials
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. Aktifkan Realtime Replication untuk tabel tutorials
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tutorials;
EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- 5. Buat Storage Bucket: tutorial-thumbnails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tutorial-thumbnails',
  'tutorial-thumbnails',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies: tutorial-thumbnails (public read, admin insert/update/delete)
DROP POLICY IF EXISTS "Tutorial thumbnails select" ON storage.objects;
CREATE POLICY "Tutorial thumbnails select" ON storage.objects
  FOR SELECT USING (bucket_id = 'tutorial-thumbnails');

DROP POLICY IF EXISTS "Tutorial thumbnails admin insert" ON storage.objects;
CREATE POLICY "Tutorial thumbnails admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tutorial-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Tutorial thumbnails admin update" ON storage.objects;
CREATE POLICY "Tutorial thumbnails admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tutorial-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Tutorial thumbnails admin delete" ON storage.objects;
CREATE POLICY "Tutorial thumbnails admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tutorial-thumbnails' AND public.is_admin());
