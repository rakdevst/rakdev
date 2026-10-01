-- ==============================================================================
-- SCHEMA & DATABASE SETUP UNTUK RAKDEV STUDIO (TANPA SISTEM NOTIFIKASI)
-- Cocok untuk semua fitur: Auth/Profile, Dashboard, Endorser, Resources, Chat, dan Admin
-- Jalankan skrip ini langsung di Supabase SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop tabel & trigger notifikasi jika sebelumnya sudah sempat dibuat
DROP TRIGGER IF EXISTS on_chat_message_created ON public.messages;
DROP FUNCTION IF EXISTS public.handle_new_chat_message() CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

-- ==============================================================================
-- 2. TABEL: PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_profiles_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Trigger auto sync user baru dari auth.users ke profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, email)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. TABEL: ADMIN_USERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Helper function cek admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF check_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = check_user_id
  );
END;
$$;

-- ==============================================================================
-- 4. TABEL: ENDORSER_SLOTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.endorser_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  time_slot TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'approved', 'rejected', 'cancelled', 'in_production', 'completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_phase TEXT,
  server_name TEXT,
  category TEXT DEFAULT 'Minecraft Server',
  content_type TEXT DEFAULT 'Video Endorse',
  description TEXT,
  production_phases JSONB DEFAULT '["Planning", "Recording", "Editing", "Review", "Revision", "Finalization", "Published"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_endorser_slots_date ON public.endorser_slots(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_endorser_slots_status ON public.endorser_slots(status);

-- ==============================================================================
-- 5. TABEL: ENDORSER_BOOKINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.endorser_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.endorser_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL,
  ip TEXT NOT NULL,
  port TEXT NOT NULL,
  features TEXT,
  social_media TEXT,
  logo_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'in_production', 'completed')),
  username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_endorser_bookings_slot ON public.endorser_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_endorser_bookings_user ON public.endorser_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_endorser_bookings_status ON public.endorser_bookings(status);

-- ==============================================================================
-- 6. TABEL: CONVERSATIONS & MESSAGES (CHAT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.endorser_bookings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);

-- ==============================================================================
-- 7. TABEL: RESOURCES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT,
  is_free BOOLEAN NOT NULL DEFAULT true,
  short_description TEXT,
  description TEXT,
  code_preview TEXT,
  thumbnail_path TEXT,
  file_path TEXT,
  file_name TEXT,
  dependencies JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

-- ==============================================================================
-- 8. RPC FUNCTION: BOOK ENDORSER SLOT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.book_endorser_slot(
  p_slot_id UUID,
  p_server_name TEXT,
  p_ip TEXT,
  p_port TEXT,
  p_features TEXT,
  p_social_media TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_slot RECORD;
  v_booking RECORD;
  v_conv_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak. Anda harus login terlebih dahulu.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;
  IF v_user_name IS NULL OR trim(v_user_name) = '' THEN
    v_user_name := split_part(v_user_email, '@', 1);
  END IF;

  -- Kunci baris slot untuk mencegah perlombaan booking bersamaan
  SELECT * INTO v_slot FROM public.endorser_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot tidak ditemukan.';
  END IF;

  IF v_slot.status != 'available' THEN
    RAISE EXCEPTION 'Slot ini sudah tidak tersedia.';
  END IF;

  -- Simpan booking baru
  INSERT INTO public.endorser_bookings (
    slot_id, user_id, server_name, ip, port, features, social_media, status, username, email
  ) VALUES (
    p_slot_id, v_user_id, trim(p_server_name), trim(p_ip), trim(p_port), trim(p_features), trim(p_social_media), 'pending', v_user_name, v_user_email
  ) RETURNING * INTO v_booking;

  -- Perbarui status slot
  UPDATE public.endorser_slots
  SET status = 'pending', server_name = trim(p_server_name), updated_at = timezone('utc'::text, now())
  WHERE id = p_slot_id;

  -- Buat ruang chat otomatis untuk booking ini
  INSERT INTO public.conversations (booking_id)
  VALUES (v_booking.id)
  RETURNING id INTO v_conv_id;

  RETURN jsonb_build_object(
    'id', v_booking.id,
    'slot_id', v_booking.slot_id,
    'server_name', v_booking.server_name,
    'status', v_booking.status,
    'conversation_id', v_conv_id
  );
END;
$$;

-- ==============================================================================
-- 9. RPC FUNCTION: CANCEL ENDORSER BOOKING
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cancel_endorser_booking(p_booking_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_booking RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak. Anda harus login terlebih dahulu.';
  END IF;

  SELECT * INTO v_booking FROM public.endorser_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan.';
  END IF;

  IF v_booking.user_id != v_user_id AND NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Anda tidak memiliki hak untuk membatalkan booking ini.';
  END IF;

  IF v_booking.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Booking dengan status saat ini tidak dapat dibatalkan.';
  END IF;

  UPDATE public.endorser_bookings
  SET status = 'cancelled', updated_at = timezone('utc'::text, now())
  WHERE id = p_booking_id;

  UPDATE public.endorser_slots
  SET status = 'available', progress = 0, current_phase = null, server_name = null, updated_at = timezone('utc'::text, now())
  WHERE id = v_booking.slot_id;

  RETURN TRUE;
END;
$$;

-- ==============================================================================
-- 10. RPC FUNCTION: ADMIN UPDATE BOOKING
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_booking(
  p_booking_id UUID,
  p_status TEXT,
  p_progress INTEGER,
  p_phase TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_booking RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat memperbarui booking.';
  END IF;

  SELECT * INTO v_booking FROM public.endorser_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking tidak ditemukan.';
  END IF;

  UPDATE public.endorser_bookings
  SET status = p_status, updated_at = timezone('utc'::text, now())
  WHERE id = p_booking_id;

  IF p_status IN ('approved', 'in_production', 'completed') THEN
    UPDATE public.endorser_slots
    SET
      status = p_status,
      progress = GREATEST(0, LEAST(100, p_progress)),
      current_phase = p_phase,
      server_name = v_booking.server_name,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_booking.slot_id;
  ELSIF p_status IN ('rejected', 'cancelled') THEN
    UPDATE public.endorser_slots
    SET
      status = 'available',
      progress = 0,
      current_phase = null,
      server_name = null,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_booking.slot_id;
  ELSE
    UPDATE public.endorser_slots
    SET status = p_status, updated_at = timezone('utc'::text, now())
    WHERE id = v_booking.slot_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endorser_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endorser_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Profiles: dibaca authenticated, update milik sendiri / admin
DROP POLICY IF EXISTS "Profiles read" ON public.profiles;
CREATE POLICY "Profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = id OR public.is_admin());

-- Admin Users: dibaca authenticated (untuk validasi hak akses), modifikasi admin
DROP POLICY IF EXISTS "Admin users select" ON public.admin_users;
CREATE POLICY "Admin users select" ON public.admin_users FOR SELECT TO authenticated USING (true);

-- Endorser Slots: publik bisa membaca kalender, modifikasi hanya admin
DROP POLICY IF EXISTS "Slots select" ON public.endorser_slots;
CREATE POLICY "Slots select" ON public.endorser_slots FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Slots admin insert" ON public.endorser_slots;
CREATE POLICY "Slots admin insert" ON public.endorser_slots FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Slots admin update" ON public.endorser_slots;
CREATE POLICY "Slots admin update" ON public.endorser_slots FOR UPDATE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Slots admin delete" ON public.endorser_slots;
CREATE POLICY "Slots admin delete" ON public.endorser_slots FOR DELETE TO authenticated USING (public.is_admin());

-- Endorser Bookings: user melihat booking miliknya, admin melihat semua
DROP POLICY IF EXISTS "Bookings select" ON public.endorser_bookings;
CREATE POLICY "Bookings select" ON public.endorser_bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Bookings insert" ON public.endorser_bookings;
CREATE POLICY "Bookings insert" ON public.endorser_bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Bookings update" ON public.endorser_bookings;
CREATE POLICY "Bookings update" ON public.endorser_bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Bookings delete" ON public.endorser_bookings;
CREATE POLICY "Bookings delete" ON public.endorser_bookings FOR DELETE TO authenticated
  USING (public.is_admin());

-- Conversations: pemilik booking atau admin
DROP POLICY IF EXISTS "Conversations select" ON public.conversations;
CREATE POLICY "Conversations select" ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.endorser_bookings b WHERE b.id = conversations.booking_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Conversations insert" ON public.conversations;
CREATE POLICY "Conversations insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.endorser_bookings b WHERE b.id = conversations.booking_id AND b.user_id = auth.uid())
  );

-- Messages: anggota percakapan atau admin
DROP POLICY IF EXISTS "Messages select" ON public.messages;
CREATE POLICY "Messages select" ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.endorser_bookings b ON b.id = c.booking_id
      WHERE c.id = messages.conversation_id AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Messages insert" ON public.messages;
CREATE POLICY "Messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      public.is_admin() OR
      EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.endorser_bookings b ON b.id = c.booking_id
        WHERE c.id = messages.conversation_id AND b.user_id = auth.uid()
      )
    )
  );

-- Resources: publik bisa melihat katalog, hanya admin yang bisa CRUD
DROP POLICY IF EXISTS "Resources select" ON public.resources;
CREATE POLICY "Resources select" ON public.resources FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Resources admin insert" ON public.resources;
CREATE POLICY "Resources admin insert" ON public.resources FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Resources admin update" ON public.resources;
CREATE POLICY "Resources admin update" ON public.resources FOR UPDATE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Resources admin delete" ON public.resources;
CREATE POLICY "Resources admin delete" ON public.resources FOR DELETE TO authenticated USING (public.is_admin());

-- ==============================================================================
-- 12. AKTIFKAN REALTIME REPLICATION DI SUPABASE
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.endorser_slots;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.endorser_bookings;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- ==============================================================================
-- 13. SETUP STORAGE BUCKETS DI SUPABASE
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('endorser-logos', 'endorser-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('resource-thumbnails', 'resource-thumbnails', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('resource-files', 'resource-files', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: endorser-logos (public read, authenticated upload)
DROP POLICY IF EXISTS "Logos public select" ON storage.objects;
CREATE POLICY "Logos public select" ON storage.objects FOR SELECT USING (bucket_id = 'endorser-logos');

DROP POLICY IF EXISTS "Logos upload" ON storage.objects;
CREATE POLICY "Logos upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'endorser-logos');

DROP POLICY IF EXISTS "Logos delete" ON storage.objects;
CREATE POLICY "Logos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'endorser-logos');

-- Storage policies: resource-thumbnails (public read, admin manage)
DROP POLICY IF EXISTS "Thumbnails public select" ON storage.objects;
CREATE POLICY "Thumbnails public select" ON storage.objects FOR SELECT USING (bucket_id = 'resource-thumbnails');

DROP POLICY IF EXISTS "Thumbnails admin insert" ON storage.objects;
CREATE POLICY "Thumbnails admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resource-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Thumbnails admin delete" ON storage.objects;
CREATE POLICY "Thumbnails admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resource-thumbnails' AND public.is_admin());

-- Storage policies: resource-files (signed url read, admin upload/delete)
DROP POLICY IF EXISTS "Resource files select" ON storage.objects;
CREATE POLICY "Resource files select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resource-files');

DROP POLICY IF EXISTS "Resource files admin insert" ON storage.objects;
CREATE POLICY "Resource files admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resource-files' AND public.is_admin());

DROP POLICY IF EXISTS "Resource files admin delete" ON storage.objects;
CREATE POLICY "Resource files admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resource-files' AND public.is_admin());

-- ==============================================================================
-- 14. CARA MENJADIKAN USER SEBAGAI ADMIN
-- Ganti 'akunrakaaja35@gmail.com' dengan email akun Anda:
--
-- INSERT INTO public.admin_users (user_id)
-- SELECT id FROM auth.users WHERE email = 'akunrakaaja35@gmail.com'
-- ON CONFLICT DO NOTHING;
-- ==============================================================================
