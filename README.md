# İddaa Günlük Hesap

İddaa bayisi için günlük kasa hesabı uygulaması.

## Kullanım

Tarayıcıda `index.html` dosyasını açın veya basit bir sunucu ile çalıştırın:

```bash
python3 -m http.server 8080
```

Ardından http://localhost:8080 adresine gidin.

## Supabase kurulumu (tüm cihazlarda aynı veri)

Kayıtlar **Supabase Postgres** üzerinde saklanır. Bir cihazda kaydettiğiniz veri diğer cihazlarda da görünür (Realtime senkron).

1. [Supabase Dashboard](https://supabase.com/dashboard) → proje: **ahmetiddaa**
2. **Project Settings → API** → `Project URL` ve `anon` public key
3. `supabase-config.example.js` dosyasını `supabase-config.js` olarak kopyalayın ve değerleri girin

```javascript
window.SUPABASE_CONFIG = {
  url: "https://wvsvdiumlmrxmguidhxa.supabase.co",
  anonKey: "YOUR_ANON_KEY",
};
```

Üstte **Supabase — tüm cihazlar senkron** yazısını görürseniz bağlantı hazırdır.

### Canlı yayın (GitHub Pages)

Sunucu gerekmez — statik dosyalar GitHub Pages üzerinden yayınlanır.

1. Repo'yu GitHub'a push edin
2. **Settings → Pages** → Source: **Deploy from a branch**
3. Branch: **main**, klasör: **/ (root)**
4. Birkaç dakika sonra site hazır: `https://<kullanici>.github.io/<repo>/`

`supabase-config.js` repoda yer alır; tüm cihazlar aynı bulut veritabanını kullanır.

### Veritabanı yapısı

```
kayitlar
  tarih          → birincil anahtar (YYYY-MM-DD)
  kayit          → jsonb (günlük kayıt)
  kayit_zamani   → kayıt zamanı
  updated_at     → son güncelleme
```

### Alternatif: Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

Site adresi: **https://ahmetiddaa.web.app**

Deploy öncesi `supabase-config.js` dosyasının sunucuya dahil olduğundan emin olun.

### Eski yerel kayıtlar

Supabase ilk kez bağlandığında tarayıcıdaki eski `localStorage` kayıtları otomatik olarak buluta taşınır.

## Hesaplama

### Kazı-Kazan bölümü
- **Önceki Gün Stok:** Bir önceki günün kayıtlı elimde tutarı (otomatik gelir)
- **Yeni Teslimat:** Gün içinde gelen kazı-kazan teslimat tutarı
- **Bugün Sayım:** Bilet adetleri + Karışık tablosu + Cam ile hesaplanan elimde tutar
- **Toplam Stok** = Önceki Gün Stok + Yeni Teslimat
- **Günlük Satış** = Toplam Stok − Bugün Sayım
- Günlük satış otomatik olarak **1. Tablo → Kazı-Kazan** alanına yazılır

### Ana tablolar
- **1. Tablo:** 1. Makine, 2. Makine, İddaa, Kazı-Kazan, Mehmet Bey
- **2. Tablo:** Defter, Nakit, 1. Makine, 2. Makine, İddaa

**Sonuç = 2. Tablo Toplamı − 1. Tablo Toplamı**

- Pozitif → **Fazla** (kasada fazla para var)
- Negatif → **Açık** (kasada eksik var)
- Sıfır → **Tam** (hesap tutuyor)

Kayıtlar Supabase'de saklanır (`supabase-config.js` ayarlanmazsa geçici olarak tarayıcıda kalır).
