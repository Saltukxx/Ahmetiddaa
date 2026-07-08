-- Alacaklılar tablosu (Supabase Postgres)
-- Dashboard veya CLI ile uygulayın; proje zaten bu migration ile kurulmuş olabilir.

CREATE TABLE IF NOT EXISTS public.alacaklilar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isim text NOT NULL,
  miktar numeric NOT NULL DEFAULT 0 CHECK (miktar >= 0),
  tarih date,
  kayit_zamani timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alacaklilar_isim_idx ON public.alacaklilar (isim);
CREATE INDEX IF NOT EXISTS alacaklilar_tarih_idx ON public.alacaklilar (tarih DESC NULLS LAST);

ALTER TABLE public.alacaklilar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alacaklilar_select_anon" ON public.alacaklilar
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "alacaklilar_insert_anon" ON public.alacaklilar
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "alacaklilar_update_anon" ON public.alacaklilar
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "alacaklilar_delete_anon" ON public.alacaklilar
  FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_alacaklilar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alacaklilar_updated_at ON public.alacaklilar;
CREATE TRIGGER alacaklilar_updated_at
  BEFORE UPDATE ON public.alacaklilar
  FOR EACH ROW EXECUTE FUNCTION public.set_alacaklilar_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.alacaklilar;
