# İddaa Günlük Hesap

İddaa bayisi için günlük kasa hesabı uygulaması.

## Kullanım

Tarayıcıda `index.html` dosyasını açın veya basit bir sunucu ile çalıştırın:

```bash
python3 -m http.server 8080
```

Ardından http://localhost:8080 adresine gidin.

## Hesaplama

### Kazı-Kazan bölümü
- **Önceki Gün Stok:** Bir önceki günün kayıtlı elimde tutarı (otomatik gelir)
- **Yeni Teslimat:** Gün içinde gelen kazı-kazan teslimat tutarı
- **Bugün Sayım:** Bilet adetleri + Karışık + Cam ile hesaplanan elimde tutar
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

Kayıtlar tarayıcının yerel depolamasında saklanır.
