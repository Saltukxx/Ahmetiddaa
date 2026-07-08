# İddaa Günlük Hesap

İddaa bayisi için günlük kasa hesabı uygulaması.

## Kullanım

Tarayıcıda `index.html` dosyasını açın veya basit bir sunucu ile çalıştırın:

```bash
python3 -m http.server 8080
```

Ardından http://localhost:8080 adresine gidin.

## Firebase kurulumu (ahmetiddaa — ücretsiz Spark plan)

1. [Firebase Console](https://console.firebase.google.com/) → proje adı: **ahmetiddaa**
2. **Build → Firestore Database → Create database**
   - Test mode ile başlayın
   - Bölge: `europe-west1`
3. **Project settings → Your apps → Web (`</>`)** → uygulama ekleyin
4. Config'ten `apiKey`, `messagingSenderId`, `appId` değerlerini alın
5. `firebase-config.js` dosyasına yapıştırın (projectId zaten `ahmetiddaa`)

### Canlı yayın (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

Site adresi: **https://ahmetiddaa.web.app**

### Firestore kuralları

```bash
firebase deploy --only firestore:rules
```

Üstte **Firebase — bulut senkron** yazısını görürseniz bağlantı hazırdır.

### Firestore yapısı

```
kayitlar/{tarih}   →   günlük kayıt (YYYY-MM-DD)
```

### Ücretsiz plan limitleri (yeterli)

- Firestore: 1 GB depolama
- Günde ~50 okuma / birkaç yazma → pratikte **$0/ay**

### Eski yerel kayıtlar

Firebase ilk kez bağlandığında tarayıcıdaki eski `localStorage` kayıtları otomatik olarak Firestore'a taşınır.

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

Kayıtlar Firebase Firestore'da saklanır (`firebase-config.js` ayarlanmazsa geçici olarak tarayıcıda kalır).
