-- Borçlular tablosu (kişi başına bakiye + hareket geçmişi)
CREATE TABLE IF NOT EXISTS public.borclular (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isim text NOT NULL,
  bakiye numeric NOT NULL DEFAULT 0 CHECK (bakiye >= 0),
  hareketler jsonb NOT NULL DEFAULT '[]'::jsonb,
  kayit_zamani timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS borclular_isim_unique_idx ON public.borclular (lower(trim(isim)));

ALTER TABLE public.borclular ENABLE ROW LEVEL SECURITY;

-- hareketler öğesi: { "tur": "borc_al"|"borc_ekle"|"odeme", "miktar": number, "tarih": "YYYY-MM-DD"|null, "zaman": iso }
