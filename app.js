const tablo1Fields = ["makine1", "makine2", "iddaa", "kazi-kazan", "mehmet-bey"];
const tablo2Fields = ["defter", "nakit", "makine1", "makine2", "iddaa"];

/** Her grup kaç satır */
const kaziKazanGruplari = [
  { label: "100₺", multiplier: 100, satirSayisi: 2 },
  { label: "150₺", multiplier: 150, satirSayisi: 2 },
  { label: "200₺", multiplier: 200, satirSayisi: 4 },
  { label: "250₺", multiplier: 250, satirSayisi: 4 },
  { label: "300₺", multiplier: 300, satirSayisi: 3 },
  { label: "500₺", multiplier: 500, satirSayisi: 2 },
];

const kaziStokFields = ["onceki-gun", "teslimat"];
const kaziExtraFields = ["cam"];

const karisikFiyatlari = [10000, 12000, 15000, 18000, 20000];

let manuelSatirlar = [];
let fixedRowCount = 0;

const els = {
  tarih: document.getElementById("hesap-tarihi"),
  kaziRows: document.getElementById("kazi-rows"),
  karisikRows: document.getElementById("karisik-rows"),
  karisikToplam: document.getElementById("karisik-toplam"),
  kaziBiletToplam: document.getElementById("kazi-bilet-toplam"),
  kaziSayim: document.getElementById("kazi-sayim"),
  kaziToplamStok: document.getElementById("kazi-toplam-stok"),
  kaziSatis: document.getElementById("kazi-satis"),
  kaziKazanTablo1: document.getElementById("kazi-kazan-tablo1"),
  toplam1: document.getElementById("toplam1"),
  toplam2: document.getElementById("toplam2"),
  fark: document.getElementById("fark"),
  formulToplam1: document.getElementById("formul-toplam1"),
  formulToplam2: document.getElementById("formul-toplam2"),
  durumBadge: document.getElementById("durum-badge"),
  durumAciklama: document.getElementById("durum-aciklama"),
  sonucKart: document.getElementById("sonuc-kart"),
  temizleBtn: document.getElementById("temizle-btn"),
  kaydetBtn: document.getElementById("kaydet-btn"),
  gecmisListe: document.getElementById("gecmis-liste"),
  kaziSatirEkleBtn: document.getElementById("kazi-satir-ekle"),
  gunNotu: document.getElementById("gun-notu"),
  syncStatus: document.getElementById("sync-status"),
};

function parseAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function parseAdet(value) {
  if (!value || typeof value !== "string") return 0;
  const num = parseInt(value.trim().replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

function formatAmount(amount) {
  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + " ₺"
  );
}

function formatInputAmount(val) {
  if (val === 0) return "";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getTabloValues(containerId, fields) {
  const container = document.getElementById(containerId);
  const values = {};
  for (const field of fields) {
    const input = container.querySelector(`[data-field="${field}"]`);
    values[field] = parseAmount(input?.value ?? "");
  }
  return values;
}

function sumValues(values) {
  return Object.values(values).reduce((acc, v) => acc + v, 0);
}

function setTabloValues(containerId, fields, values) {
  const container = document.getElementById(containerId);
  for (const field of fields) {
    const input = container.querySelector(`[data-field="${field}"]`);
    if (!input) continue;
    if (values[field] !== undefined) {
      input.value = formatInputAmount(values[field]);
    } else {
      input.value = "";
    }
  }
}

function createManuelId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatFiyatLabel(amount) {
  return new Intl.NumberFormat("tr-TR").format(amount) + " ₺";
}

function buildKarisikRows() {
  const html = karisikFiyatlari
    .map(
      (fiyat, idx) => `
        <tr data-row-type="karisik" data-mult="${fiyat}" data-row="${idx}">
          <td class="kazi-label" data-label="Fiyat">${formatFiyatLabel(fiyat)}</td>
          <td data-label="Adet"><input type="text" inputmode="numeric" class="karisik-adet" data-row="${idx}" placeholder="0" /></td>
          <td class="kazi-satir-toplam" data-label="Toplam" data-karisik-row-total="${idx}">0,00 ₺</td>
        </tr>`
    )
    .join("");

  els.karisikRows.innerHTML = html;
  bindKarisikRowInputs();
}

function getKarisikAdetler() {
  const adetler = [];
  els.karisikRows.querySelectorAll("tr").forEach((row) => {
    adetler.push({
      mult: Number(row.dataset.mult),
      adet: parseAdet(row.querySelector(".karisik-adet")?.value ?? ""),
    });
  });
  return adetler;
}

function bindKarisikRowInputs() {
  els.karisikRows.querySelectorAll(".karisik-adet").forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    bindAdetInput(input);
  });
}

function buildFixedKaziRows() {
  let html = "";
  let rowIndex = 0;

  for (const grup of kaziKazanGruplari) {
    for (let s = 0; s < grup.satirSayisi; s++) {
      html += `
        <tr data-row-type="fixed" data-mult="${grup.multiplier}" data-row="${rowIndex}">
          <td class="kazi-label" data-label="Fiyat">${grup.label}</td>
          <td data-label="Adet"><input type="text" inputmode="numeric" class="kazi-adet" data-row="${rowIndex}" placeholder="0" /></td>
          <td class="kazi-satir-toplam" data-label="Toplam" data-row-total="${rowIndex}">0,00 ₺</td>
        </tr>`;
      rowIndex++;
    }
  }

  fixedRowCount = rowIndex;
  els.kaziRows.innerHTML = html;
}

function createManuelRowHtml(satir, rowIndex) {
  const fiyat = satir.multiplier ? escapeHtml(formatInputAmount(satir.multiplier)) : "";
  const adet = satir.adet ? String(satir.adet) : "";

  return `
    <tr data-row-type="manual" data-id="${satir.id}" data-row="${rowIndex}">
      <td data-label="Fiyat">
        <input type="text" inputmode="decimal" class="kazi-manuel-fiyat" value="${fiyat}" placeholder="0" />
      </td>
      <td data-label="Adet"><input type="text" inputmode="numeric" class="kazi-adet" data-row="${rowIndex}" value="${adet}" placeholder="0" /></td>
      <td class="kazi-satir-toplam-cell" data-label="Toplam">
        <span class="kazi-satir-toplam" data-row-total="${rowIndex}">0,00 ₺</span>
        <button type="button" class="kazi-satir-sil" title="Satırı sil" aria-label="Satırı sil">×</button>
      </td>
    </tr>`;
}

function renderManuelSatirlar() {
  els.kaziRows.querySelectorAll('[data-row-type="manual"]').forEach((row) => row.remove());

  manuelSatirlar.forEach((satir, idx) => {
    const rowIndex = fixedRowCount + idx;
    els.kaziRows.insertAdjacentHTML("beforeend", createManuelRowHtml(satir, rowIndex));
  });

  bindKaziRowInputs();
}

function buildKaziRows() {
  buildFixedKaziRows();
  renderManuelSatirlar();
}

function syncManuelSatirlarFromDom() {
  const synced = [];

  els.kaziRows.querySelectorAll('[data-row-type="manual"]').forEach((row) => {
    synced.push({
      id: row.dataset.id,
      multiplier: parseAmount(row.querySelector(".kazi-manuel-fiyat")?.value ?? ""),
      adet: parseAdet(row.querySelector(".kazi-adet")?.value ?? ""),
    });
  });

  manuelSatirlar = synced;
}

function addManuelSatir() {
  syncManuelSatirlarFromDom();
  manuelSatirlar.push({
    id: createManuelId(),
    multiplier: 0,
    adet: 0,
  });
  renderManuelSatirlar();
  hesapla();

  const lastRow = els.kaziRows.querySelector(`[data-id="${manuelSatirlar.at(-1).id}"]`);
  lastRow?.querySelector(".kazi-manuel-fiyat")?.focus();
}

function removeManuelSatir(id) {
  syncManuelSatirlarFromDom();
  manuelSatirlar = manuelSatirlar.filter((satir) => satir.id !== id);
  renderManuelSatirlar();
  hesapla();
}

function getRowMultiplier(row) {
  if (row.dataset.rowType === "manual") {
    return parseAmount(row.querySelector(".kazi-manuel-fiyat")?.value ?? "");
  }
  return Number(row.dataset.mult);
}

function getKaziStokValues() {
  const stok = {};
  for (const field of kaziStokFields) {
    const input = document.querySelector(`[data-kazi="${field}"]`);
    stok[field] = parseAmount(input?.value ?? "");
  }
  return stok;
}

function getKaziValues() {
  const adetler = [];
  els.kaziRows.querySelectorAll("tr").forEach((row) => {
    const mult = getRowMultiplier(row);
    const adet = parseAdet(row.querySelector(".kazi-adet")?.value ?? "");
    const entry = { mult, adet };

    if (row.dataset.rowType === "manual") {
      entry.manual = true;
      entry.id = row.dataset.id;
    }

    adetler.push(entry);
  });

  syncManuelSatirlarFromDom();

  const extras = {};
  for (const field of kaziExtraFields) {
    const input = document.querySelector(`[data-kazi="${field}"]`);
    extras[field] = parseAmount(input?.value ?? "");
  }

  const karisikAdetler = getKarisikAdetler();
  const stok = getKaziStokValues();

  return { adetler, manuelSatirlar: [...manuelSatirlar], karisikAdetler, extras, stok };
}

function getPreviousDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getOncekiGunStokFromRecords(tarih) {
  const prevDate = getPreviousDate(tarih);
  const records = getRecordsCache();
  const prev = records.find((r) => r.tarih === prevDate);
  if (!prev?.kaziKazan) return 0;

  if (prev.kaziKazan.bugunElimde != null) return prev.kaziKazan.bugunElimde;
  if (prev.kaziKazan.genelToplam != null) return prev.kaziKazan.genelToplam;
  return 0;
}

function setOncekiGunStok(tarih, force = false) {
  const input = document.querySelector('[data-kazi="onceki-gun"]');
  if (!input) return;

  const autoValue = getOncekiGunStokFromRecords(tarih);
  if (force || !input.value.trim()) {
    input.value = autoValue ? formatInputAmount(autoValue) : "";
  }
}

function hesaplaKaziKazan() {
  const { adetler, karisikAdetler, extras, stok } = getKaziValues();
  let biletToplam = 0;
  let karisikToplam = 0;

  adetler.forEach((row, idx) => {
    const satirToplam = row.adet * row.mult;
    biletToplam += satirToplam;

    const cell = els.kaziRows.querySelector(`[data-row-total="${idx}"]`);
    if (cell) cell.textContent = formatAmount(satirToplam);
  });

  karisikAdetler.forEach((row, idx) => {
    const satirToplam = row.adet * row.mult;
    karisikToplam += satirToplam;

    const cell = els.karisikRows.querySelector(`[data-karisik-row-total="${idx}"]`);
    if (cell) cell.textContent = formatAmount(satirToplam);
  });

  const camToplam = extras.cam ?? 0;
  const extraToplam = karisikToplam + camToplam;
  const bugunSayim = biletToplam + extraToplam;
  const teslimat = stok.teslimat;
  const oncekiGun = stok["onceki-gun"];
  const toplamStok = oncekiGun + teslimat;
  const gunlukSatis = toplamStok - bugunSayim;
  const bugunElimde = bugunSayim;

  const hasSayim =
    bugunSayim > 0 ||
    adetler.some((r) => r.adet > 0) ||
    karisikAdetler.some((r) => r.adet > 0);
  const hasStokInput = oncekiGun > 0 || teslimat > 0 || hasSayim;

  els.karisikToplam.textContent = formatAmount(karisikToplam);
  els.kaziBiletToplam.textContent = formatAmount(biletToplam);
  els.kaziSayim.textContent = formatAmount(bugunSayim);
  els.kaziToplamStok.textContent = formatAmount(toplamStok);
  els.kaziSatis.textContent = formatAmount(gunlukSatis);

  if (hasStokInput) {
    els.kaziKazanTablo1.value = formatInputAmount(gunlukSatis);
  }

  return {
    adetler,
    manuelSatirlar: [...manuelSatirlar],
    karisikAdetler,
    extras,
    stok,
    biletToplam,
    karisikToplam,
    camToplam,
    extraToplam,
    bugunSayim,
    teslimat,
    oncekiGun,
    toplamStok,
    bugunElimde,
    gunlukSatis,
    hasStokInput,
  };
}

function hesapla() {
  hesaplaKaziKazan();

  const t1 = getTabloValues("tablo1", tablo1Fields);
  const t2 = getTabloValues("tablo2", tablo2Fields);
  const toplam1 = sumValues(t1);
  const toplam2 = sumValues(t2);
  const fark = toplam2 - toplam1;

  els.toplam1.textContent = formatAmount(toplam1);
  els.toplam2.textContent = formatAmount(toplam2);
  els.formulToplam1.textContent = formatAmount(toplam1);
  els.formulToplam2.textContent = formatAmount(toplam2);
  els.fark.textContent = formatAmount(Math.abs(fark));

  els.sonucKart.classList.remove("fazla", "acik", "esit");

  if (fark > 0) {
    els.sonucKart.classList.add("fazla");
    els.durumBadge.textContent = "Fazla";
    els.durumAciklama.textContent =
      "2. tablo toplamı 1. tablodan fazla. Kasada " + formatAmount(fark) + " fazla var.";
  } else if (fark < 0) {
    els.sonucKart.classList.add("acik");
    els.durumBadge.textContent = "Açık";
    els.durumAciklama.textContent =
      "2. tablo toplamı 1. tablodan eksik. Kasada " + formatAmount(Math.abs(fark)) + " açık var.";
  } else {
    els.sonucKart.classList.add("esit");
    els.durumBadge.textContent = "Tam";
    els.durumAciklama.textContent = "Her iki tablo eşit. Hesap tam.";
  }

  return { t1, t2, toplam1, toplam2, fark };
}

function setKaziValues(kaziData) {
  if (!kaziData) return;

  if (kaziData.adetler) {
    const fixedRows = els.kaziRows.querySelectorAll('[data-row-type="fixed"]');
    let fixedIdx = 0;

    kaziData.adetler.forEach((row) => {
      if (row.manual) return;

      const tr = fixedRows[fixedIdx];
      fixedIdx++;
      if (!tr) return;

      const input = tr.querySelector(".kazi-adet");
      const adet = row.adet ?? row.col1 ?? 0;
      if (input) input.value = adet ? String(adet) : "";
    });
  }

  manuelSatirlar = kaziData.manuelSatirlar
    ? kaziData.manuelSatirlar.map((satir) => ({
        id: satir.id ?? createManuelId(),
        multiplier: satir.multiplier ?? 0,
        adet: satir.adet ?? 0,
      }))
    : [];

  renderManuelSatirlar();

  if (kaziData.karisikAdetler) {
    const rows = els.karisikRows.querySelectorAll("tr");
    kaziData.karisikAdetler.forEach((row, idx) => {
      const tr = rows[idx];
      if (!tr) return;
      const input = tr.querySelector(".karisik-adet");
      const adet = row.adet ?? 0;
      if (input) input.value = adet ? String(adet) : "";
    });
  }

  if (kaziData.extras) {
    for (const field of kaziExtraFields) {
      const input = document.querySelector(`[data-kazi="${field}"]`);
      if (input && kaziData.extras[field] !== undefined) {
        input.value = formatInputAmount(kaziData.extras[field]);
      }
    }
  }

  if (kaziData.stok) {
    for (const field of kaziStokFields) {
      const input = document.querySelector(`[data-kazi="${field}"]`);
      if (input && kaziData.stok[field] !== undefined) {
        input.value = formatInputAmount(kaziData.stok[field]);
      }
    }
  }
}

function clearKaziInputs() {
  els.kaziRows.querySelectorAll('[data-row-type="fixed"] .kazi-adet').forEach((input) => {
    input.value = "";
  });
  els.karisikRows.querySelectorAll(".karisik-adet").forEach((input) => {
    input.value = "";
  });
  manuelSatirlar = [];
  renderManuelSatirlar();
  for (const field of [...kaziExtraFields, ...kaziStokFields]) {
    const input = document.querySelector(`[data-kazi="${field}"]`);
    if (input) input.value = "";
  }
}

function getGunNotu() {
  return els.gunNotu?.value.trim() ?? "";
}

function setGunNotu(not) {
  if (els.gunNotu) els.gunNotu.value = not ?? "";
}

function loadGunKaydi(tarih) {
  const records = getRecordsCache();
  const kayit = records.find((r) => r.tarih === tarih);

  if (kayit) {
    setKaziValues(kayit.kaziKazan);
    setTabloValues("tablo1", tablo1Fields.filter((f) => f !== "kazi-kazan"), kayit.tablo1);
    setTabloValues("tablo2", tablo2Fields, kayit.tablo2);
    if (!kayit.kaziKazan && kayit.tablo1?.["kazi-kazan"]) {
      els.kaziKazanTablo1.value = formatInputAmount(kayit.tablo1["kazi-kazan"]);
    } else {
      els.kaziKazanTablo1.value = "";
    }
    setGunNotu(kayit.not);
  } else {
    clearKaziInputs();
    setOncekiGunStok(tarih, true);
    setTabloValues("tablo1", tablo1Fields.filter((f) => f !== "kazi-kazan"), {});
    setTabloValues("tablo2", tablo2Fields, {});
    els.kaziKazanTablo1.value = "";
    setGunNotu("");
  }

  hesapla();
}

function updateSyncStatus() {
  if (!els.syncStatus) return;

  if (isSupabaseReady()) {
    els.syncStatus.textContent = "Supabase — tüm cihazlar senkron";
    els.syncStatus.className = "sync-status sync-status--cloud";
    return;
  }

  if (isSupabaseConfigured()) {
    els.syncStatus.textContent = "Supabase bağlantısı kurulamadı";
    els.syncStatus.className = "sync-status sync-status--error";
    return;
  }

  els.syncStatus.textContent = "Yerel kayıt (supabase-config.js ayarlayın)";
  els.syncStatus.className = "sync-status sync-status--local";
}

function setSavingState(isSaving) {
  els.kaydetBtn.disabled = isSaving;
  els.kaydetBtn.textContent = isSaving ? "Kaydediliyor…" : "Kaydet";
}

function renderGecmis() {
  const list = getRecordsCache();
  if (list.length === 0) {
    els.gecmisListe.innerHTML = '<p class="empty-state">Henüz kayıt yok.</p>';
    return;
  }

  els.gecmisListe.innerHTML = list
    .slice()
    .reverse()
    .map(
      (item, idx) => `
      <div class="history-item" data-index="${list.length - 1 - idx}">
        <span class="tarih" data-tarih="${item.tarih}">${item.tarih}${item.not ? ' <span class="not-badge" title="Not var">📝</span>' : ""}</span>
        <span class="fark ${item.fark >= 0 ? "fazla" : "acik"}">
          ${item.fark >= 0 ? "Fazla" : "Açık"} ${formatAmount(Math.abs(item.fark))}
        </span>
        <button type="button" class="sil-btn" title="Sil" aria-label="Kaydı sil">×</button>
      </div>`
    )
    .join("");

  els.gecmisListe.querySelectorAll(".sil-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".history-item");
      const tarih = item.querySelector(".tarih")?.dataset.tarih;
      if (!tarih) return;
      if (!confirm(`${tarih} tarihli kayıt silinsin mi?`)) return;

      btn.disabled = true;
      try {
        await deleteRecordFromDb(tarih);
        if (els.tarih.value === tarih) {
          loadGunKaydi(tarih);
        }
        renderGecmis();
      } catch (error) {
        console.error(error);
        alert("Kayıt silinemedi. İnternet bağlantınızı kontrol edin.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function kaydet() {
  const kazi = hesaplaKaziKazan();
  const { t1, t2, toplam1, toplam2, fark } = hesapla();
  const tarih = els.tarih.value;
  if (!tarih) {
    alert("Lütfen tarih seçin.");
    return;
  }

  const records = getRecordsCache();
  const existingIndex = records.findIndex((r) => r.tarih === tarih);

  const kayit = {
    tarih,
    kaziKazan: kazi,
    tablo1: t1,
    tablo2: t2,
    toplam1,
    toplam2,
    fark,
    not: getGunNotu(),
    kayitZamani: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    if (!confirm(`${tarih} tarihli kayıt zaten var. Üzerine yazılsın mı?`)) return;
  }

  setSavingState(true);
  try {
    await saveRecordToDb(kayit);
    renderGecmis();
  } catch (error) {
    console.error(error);
    alert("Kayıt yapılamadı. İnternet bağlantınızı kontrol edin.");
  } finally {
    setSavingState(false);
  }
}

function temizle() {
  if (!confirm("Tüm alanlar temizlensin mi?")) return;

  clearKaziInputs();
  setTabloValues("tablo1", tablo1Fields.filter((f) => f !== "kazi-kazan"), {});
  setTabloValues("tablo2", tablo2Fields, {});
  els.kaziKazanTablo1.value = "";
  setGunNotu("");
  hesapla();
}

function bindAmountInput(input) {
  input.addEventListener("input", hesapla);
  input.addEventListener("blur", () => {
    const val = parseAmount(input.value);
    if (val !== 0) {
      input.value = formatInputAmount(val);
    }
    hesapla();
  });
}

function bindAdetInput(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");
    hesapla();
  });
}

function bindKaziRowInputs() {
  els.kaziRows.querySelectorAll(".kazi-adet").forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    bindAdetInput(input);
  });

  els.kaziRows.querySelectorAll(".kazi-manuel-fiyat").forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    bindAmountInput(input);
  });

  els.kaziRows.querySelectorAll(".kazi-satir-sil").forEach((btn) => {
    if (btn.dataset.bound === "true") return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => {
      const row = btn.closest('[data-row-type="manual"]');
      if (row) removeManuelSatir(row.dataset.id);
    });
  });
}

function init() {
  buildKarisikRows();
  buildKaziRows();

  const today = new Date();
  els.tarih.value = today.toISOString().slice(0, 10);

  document.querySelectorAll("#tablo1 input:not([readonly]), #tablo2 input").forEach(bindAmountInput);
  document.querySelectorAll("[data-kazi]").forEach(bindAmountInput);

  els.kaziSatirEkleBtn.addEventListener("click", addManuelSatir);
  els.temizleBtn.addEventListener("click", temizle);
  els.kaydetBtn.addEventListener("click", () => {
    kaydet();
  });

  els.tarih.addEventListener("change", () => {
    loadGunKaydi(els.tarih.value);
  });
}

async function bootstrap() {
  init();

  window.addEventListener("kayitlar-sync", () => {
    const currentDate = els.tarih.value;
    loadGunKaydi(currentDate);
    renderGecmis();
    updateSyncStatus();
  });

  try {
    await initSupabaseDb();
  } catch (error) {
    console.error(error);
    setRecordsCache(loadLegacyRecords());
  }

  updateSyncStatus();
  loadGunKaydi(els.tarih.value);
  renderGecmis();
}

bootstrap();
