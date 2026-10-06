-- ==============================================================================
-- RAKDEV STUDIO - MASTER POSTGRESQL & SUPABASE MIGRATION SCHEMA
-- Project URL: https://shkxmedtmkbmykzogery.supabase.co
-- Key: sb_publishable_3hDUbJHHVocYsa4hC0045A_17Lyo0zU
-- Administrator: akunrakaaja35@gmail.com
--
-- JALANKAN SKRIP INI SECARA LENGKAP DI:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABEL: PROFILES (DATA PENGGUNA & ROLE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin', 'owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_profiles_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger otomatis sync user saat mendaftar di auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE 
      WHEN LOWER(NEW.email) = 'akunrakaaja35@gmail.com' THEN 'admin'
      ELSE 'client'
    END
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

-- Fungsi verifikasi Admin server-side
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

  -- Cek langsung UID admin utama
  IF check_user_id = 'e412db1b-62ea-4556-b669-93268a275879'::uuid THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = check_user_id
      AND (
        role IN ('admin', 'owner')
        OR LOWER(email) = 'akunrakaaja35@gmail.com'
      )
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = check_user_id
      AND LOWER(email) = 'akunrakaaja35@gmail.com'
  );
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles select public" ON public.profiles;
CREATE POLICY "Profiles select public" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles update own or admin" ON public.profiles;
CREATE POLICY "Profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles insert own or admin" ON public.profiles;
CREATE POLICY "Profiles insert own or admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- 3. TABEL: ENDORSER_SLOTS (JADWAL PROMOSI SERVER)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.endorser_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  time_slot TEXT DEFAULT 'Malam (19:00 - 21:00 WIB)',
  platform TEXT NOT NULL DEFAULT 'TikTok' CHECK (platform IN ('TikTok', 'YouTube', 'Instagram')),
  price_idr NUMERIC DEFAULT 0,
  content_type TEXT DEFAULT 'Shorts / Video Pendek',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'approved', 'rejected', 'cancelled', 'in_production', 'completed')),
  server_name TEXT,
  description TEXT,
  notes TEXT,
  current_phase TEXT DEFAULT 'Waiting Approval',
  progress_percent INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slots_scheduled_date ON public.endorser_slots(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON public.endorser_slots(status);

ALTER TABLE public.endorser_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Slots public read" ON public.endorser_slots;
CREATE POLICY "Slots public read" ON public.endorser_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Slots admin all" ON public.endorser_slots;
CREATE POLICY "Slots admin all" ON public.endorser_slots FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Slots client update when booking" ON public.endorser_slots;
CREATE POLICY "Slots client update when booking" ON public.endorser_slots FOR UPDATE TO authenticated 
USING (status = 'available' OR public.is_admin())
WITH CHECK (public.is_admin() OR status = 'pending');

-- ==============================================================================
-- 4. TABEL: ENDORSER_BOOKINGS (PESANAN MASUK DARI PEMILIK SERVER)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.endorser_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.endorser_slots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  server_name TEXT NOT NULL,
  server_ip TEXT NOT NULL,
  server_port TEXT NOT NULL DEFAULT '25565',
  features TEXT,
  social_media TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'in_production', 'completed')),
  admin_notes TEXT,
  username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.endorser_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.endorser_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.endorser_bookings(status);

ALTER TABLE public.endorser_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bookings select own or admin" ON public.endorser_bookings;
CREATE POLICY "Bookings select own or admin" ON public.endorser_bookings FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Bookings insert authenticated" ON public.endorser_bookings;
CREATE POLICY "Bookings insert authenticated" ON public.endorser_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Bookings update admin" ON public.endorser_bookings;
CREATE POLICY "Bookings update admin" ON public.endorser_bookings FOR UPDATE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Bookings delete admin" ON public.endorser_bookings;
CREATE POLICY "Bookings delete admin" ON public.endorser_bookings FOR DELETE TO authenticated USING (public.is_admin());

-- ==============================================================================
-- 5. TABEL: CONVERSATIONS & MESSAGES (KOORDINASI & LIVE CHAT REALTIME)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.endorser_bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_conversation_booking UNIQUE (booking_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL DEFAULT 'client' CHECK (sender_role IN ('client', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Conversations select member or admin" ON public.conversations;
CREATE POLICY "Conversations select member or admin" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Conversations insert member or admin" ON public.conversations;
CREATE POLICY "Conversations insert member or admin" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Messages select member or admin" ON public.messages;
CREATE POLICY "Messages select member or admin" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Messages insert member or admin" ON public.messages;
CREATE POLICY "Messages insert member or admin" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin())
  )
);

-- ==============================================================================
-- 6. TABEL: RESOURCES (PLUGIN, SKRIPT, CONFIG, MAPS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Plugin' CHECK (category IN ('Plugin', 'Skript', 'Config', 'Maps', 'Tools', 'Other')),
  version TEXT DEFAULT '1.0.0',
  download_url TEXT NOT NULL,
  file_name TEXT,
  file_size TEXT,
  thumbnail_url TEXT,
  dependencies TEXT,
  tags TEXT,
  downloads_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Resources public read" ON public.resources;
CREATE POLICY "Resources public read" ON public.resources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Resources admin all" ON public.resources;
CREATE POLICY "Resources admin all" ON public.resources FOR ALL TO authenticated USING (public.is_admin());

-- ==============================================================================
-- 7. TABEL: TUTORIALS (VIDEO PANDUAN YOUTUBE / TIKTOK)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  youtube_url TEXT,
  platform TEXT NOT NULL DEFAULT 'YouTube' CHECK (platform IN ('YouTube', 'TikTok', 'Instagram')),
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tutorials_category ON public.tutorials(category);
CREATE INDEX IF NOT EXISTS idx_tutorials_created_at ON public.tutorials(created_at DESC);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutorials public read" ON public.tutorials;
CREATE POLICY "Tutorials public read" ON public.tutorials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tutorials admin all" ON public.tutorials;
CREATE POLICY "Tutorials admin all" ON public.tutorials FOR ALL TO authenticated USING (public.is_admin());

-- ==============================================================================
-- 8. DATABASE FUNCTIONS / STORED PROCEDURES (ATOMIC OPERATIONS)
-- ==============================================================================

-- Fungsi booking slot secara atomik
CREATE OR REPLACE FUNCTION public.create_booking(
  p_slot_id UUID,
  p_server_name TEXT,
  p_server_ip TEXT,
  p_server_port TEXT,
  p_features TEXT,
  p_social_media TEXT,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking_id UUID;
  v_conv_id UUID;
  v_username TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna harus login untuk melakukan booking.';
  END IF;

  -- Validasi ketersediaan slot
  IF NOT EXISTS (SELECT 1 FROM public.endorser_slots WHERE id = p_slot_id AND status = 'available') THEN
    RAISE EXCEPTION 'Slot ini sudah tidak berstatus available atau sudah dipesan.';
  END IF;

  -- Ambil nama dan email user
  SELECT COALESCE(full_name, split_part(email, '@', 1)), email
  INTO v_username, v_email
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    v_username := COALESCE(v_username, split_part(v_email, '@', 1));
  END IF;

  -- 1. Insert booking
  INSERT INTO public.endorser_bookings (
    slot_id, user_id, server_name, server_ip, server_port, features, social_media, logo_url, status, username, email
  )
  VALUES (
    p_slot_id, v_user_id, p_server_name, p_server_ip, COALESCE(p_server_port, '25565'), p_features, p_social_media, p_logo_url, 'pending', v_username, v_email
  )
  RETURNING id INTO v_booking_id;

  -- 2. Update status slot menjadi pending
  UPDATE public.endorser_slots
  SET status = 'pending', server_name = p_server_name, updated_at = timezone('utc'::text, now())
  WHERE id = p_slot_id;

  -- 3. Inisialisasi percakapan live chat
  INSERT INTO public.conversations (booking_id, user_id)
  VALUES (v_booking_id, v_user_id)
  RETURNING id INTO v_conv_id;

  -- 4. Pesan otomatis selamat datang dari studio
  INSERT INTO public.messages (conversation_id, sender_id, sender_role, body)
  VALUES (
    v_conv_id,
    NULL,
    'admin',
    'Halo! Pengajuan booking untuk server "' || p_server_name || '" telah diterima. Tim rakDEV Studio akan segera meninjau detail teknis dan mengabari Anda melalui chat ini.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'conversation_id', v_conv_id
  );
END;
$$;

-- Fungsi penambahan counter unduhan secara atomik
CREATE OR REPLACE FUNCTION public.increment_resource_downloads(p_resource_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.resources
  SET downloads_count = COALESCE(downloads_count, 0) + 1
  WHERE id = p_resource_id;
END;
$$;

-- ==============================================================================
-- 9. SUPABASE STORAGE BUCKETS & POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('endorser-logos', 'endorser-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('resource-files', 'resource-files', true, 104857600, NULL),
  ('resource-thumbnails', 'resource-thumbnails', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('tutorial-thumbnails', 'tutorial-thumbnails', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS
DROP POLICY IF EXISTS "Storage public read endorser-logos" ON storage.objects;
CREATE POLICY "Storage public read endorser-logos" ON storage.objects FOR SELECT USING (bucket_id = 'endorser-logos');

DROP POLICY IF EXISTS "Storage auth upload endorser-logos" ON storage.objects;
CREATE POLICY "Storage auth upload endorser-logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'endorser-logos');

DROP POLICY IF EXISTS "Storage public read resource-files" ON storage.objects;
CREATE POLICY "Storage public read resource-files" ON storage.objects FOR SELECT USING (bucket_id = 'resource-files');

DROP POLICY IF EXISTS "Storage admin resource-files" ON storage.objects;
CREATE POLICY "Storage admin resource-files" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'resource-files' AND public.is_admin());

DROP POLICY IF EXISTS "Storage public read resource-thumbnails" ON storage.objects;
CREATE POLICY "Storage public read resource-thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'resource-thumbnails');

DROP POLICY IF EXISTS "Storage admin resource-thumbnails" ON storage.objects;
CREATE POLICY "Storage admin resource-thumbnails" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'resource-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Storage public read tutorial-thumbnails" ON storage.objects;
CREATE POLICY "Storage public read tutorial-thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'tutorial-thumbnails');

DROP POLICY IF EXISTS "Storage admin tutorial-thumbnails" ON storage.objects;
CREATE POLICY "Storage admin tutorial-thumbnails" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'tutorial-thumbnails' AND public.is_admin());

-- ==============================================================================
-- 10. REALTIME REPLICATION (LISTEN VIA POSTGRES_CHANGES)
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.endorser_slots;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.endorser_bookings;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.resources;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tutorials;
  EXCEPTION 
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- ==============================================================================
-- 11. INITIAL SEED DATA (DATA AWAL SUPABASE BERSIH)
-- ==============================================================================
-- Endorser Slots
INSERT INTO public.endorser_slots (id, scheduled_date, time_slot, platform, price_idr, content_type, status, server_name, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '2 day', 'Malam (19:30 WIB)', 'TikTok', 150000, 'Shorts / Video Pendek', 'available', NULL, 'Slot promosi video showcase server Minecraft di akun TikTok resmi rakDEV Studio.'),
  ('00000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '5 day', 'Sore (16:00 WIB)', 'YouTube', 250000, 'Dedicated Video / Review', 'available', NULL, 'Review gameplay mendalam & tur fitur server di channel YouTube rakDEV Studio.'),
  ('00000000-0000-0000-0000-000000000003', CURRENT_DATE + INTERVAL '8 day', 'Malam (20:00 WIB)', 'TikTok', 150000, 'Shorts / Video Pendek', 'available', NULL, 'Slot promosi fitur gameplay baru server Minecraft di TikTok rakDEV Studio.')
ON CONFLICT (id) DO NOTHING;

-- Resources
INSERT INTO public.resources (id, title, description, category, version, download_url, file_name, file_size, dependencies, tags, thumbnail_url)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'LuckPerms Pro Rank & Permissions Config',
    'Konfigurasi role dan permission lengkap siap pakai (Member, VIP, MVP, Mod, Admin, Owner) dengan prefix badge warna aesthetic.',
    'Config',
    '5.4.102',
    'https://github.com/LuckPerms/LuckPerms/releases',
    'LuckPerms-Preset-rakDEV.zip',
    '1.2 MB',
    'LuckPerms, Vault, EssentialsX',
    'luckperms, rank, permissions, config',
    'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=600&auto=format&fit=crop&q=80'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Server Optimizer Paper & Purpur 1.20+',
    'Kumpulan preset konfigurasi paper.yml, purpur.yml, dan bukkit.yml untuk menghilangkan lag, menaikkan TPS ke 20.0, dan hemat RAM hingga 40%.',
    'Config',
    '1.20.4',
    'https://papermc.io',
    'paper-purpur-optimized.zip',
    '850 KB',
    'PaperMC / Purpur',
    'optimasi, tps, paper, config, anti-lag',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Custom Economy & Daily Rewards Skript',
    'Skript otomatisasi hadiah harian, sistem leaderboard uang, dan shop interaktif GUI tanpa membebani performa server.',
    'Skript',
    '2.8.0',
    'https://github.com/SkriptLang/Skript',
    'rakDEV-DailyRewards.sk',
    '45 KB',
    'Skript, SkBee, Vault',
    'skript, ekonomi, rewards, gui',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
  )
ON CONFLICT (id) DO NOTHING;

-- Tutorials
INSERT INTO public.tutorials (id, title, description, category, platform, youtube_url, video_url, thumbnail_url)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'Cara Setup LuckPerms & Bikin Rank Server Minecraft dari Nol',
    'Panduan lengkap cara instalasi plugin LuckPerms, membuat rank Member hingga Owner, mengatur prefix warna di chat dan tablist menggunakan Vault.',
    'Plugin',
    'YouTube',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Optimasi Server Minecraft 1.20 Agar Anti-Lag & TPS Selalu 20',
    'Tutorial tuning settingan paper-world-defaults.yml, view-distance, chunk loading, dan entity limits untuk server ramai tanpa penurunan performa.',
    'Optimasi',
    'YouTube',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80'
  )
ON CONFLICT (id) DO NOTHING;
