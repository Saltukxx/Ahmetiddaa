const TUR_LABELS = {
  borc_al: "Borç alındı",
  borc_ekle: "Borç eklendi",
  odeme: "Ödeme alındı",
};

const els = {
  syncStatus: document.getElementById("sync-status"),
  form: document.getElementById("borclu-form"),
  isim: document.getElementById("borclu-isim"),
  miktar: document.getElementById("borclu-miktar"),
  tarih: document.getElementById("borclu-tarih"),
  kaydetBtn: document.getElementById("borclu-kaydet-btn"),
  liste: document.getElementById("borclu-liste"),
  toplam: document.getElementById("borclu-toplam"),
  sayisi: document.getElementById("borclu-sayisi"),
};

let openAdjustId = null;

function updateSyncStatus() {
  if (!els.syncStatus) return;

  const textEl = els.syncStatus.querySelector(".sync-text");
  const setText = (msg) => {
    if (textEl) textEl.textContent = msg;
    else els.syncStatus.textContent = msg;
  };

  if (isSupabaseReady()) {
    setText("Supabase — tüm cihazlar senkron");
    els.syncStatus.className = "sync-status sync-status--cloud";
    return;
  }

  if (isSupabaseConfigured()) {
    setText("Supabase bağlantısı kurulamadı");
    els.syncStatus.className = "sync-status sync-status--error";
    return;
  }

  setText("Yerel kayıt (supabase-config.js ayarlayın)");
  els.syncStatus.className = "sync-status sync-status--local";
}

function setSavingState(isSaving) {
  els.kaydetBtn.disabled = isSaving;
  els.kaydetBtn.textContent = isSaving ? "Kaydediliyor…" : "Borç Al / Kaydet";
}

function bindAmountInput(input) {
  input.addEventListener("blur", () => {
    const val = parseAmount(input.value);
    if (val !== 0) input.value = formatInputAmount(val);
  });
}

function getSonHareketLabel(borclu) {
  const hareketler = borclu.hareketler ?? [];
  if (hareketler.length === 0) return "";
  const son = hareketler[hareketler.length - 1];
  const tur = TUR_LABELS[son.tur] ?? son.tur;
  const tarih = son.tarih ? formatTarihLabel(son.tarih) : "";
  return tarih ? `${tur} · ${tarih}` : tur;
}

function renderHareketler(borclu) {
  const hareketler = [...(borclu.hareketler ?? [])].reverse().slice(0, 5);
  if (hareketler.length === 0) {
    return '<p class="borclu-hareket-empty">Henüz hareket yok.</p>';
  }

  return hareketler
    .map((h) => {
      const tur = TUR_LABELS[h.tur] ?? h.tur;
      const tarih = h.tarih ? formatTarihLabel(h.tarih) : "—";
      const sign = h.tur === "odeme" ? "−" : "+";
      return `
        <li class="borclu-hareket-item borclu-hareket-item--${escapeHtml(h.tur)}">
          <span>${escapeHtml(tur)}</span>
          <span>${escapeHtml(tarih)}</span>
          <strong>${sign}${formatAmount(h.miktar)}</strong>
        </li>`;
    })
    .join("");
}

function renderAdjustPanel(borclu, type) {
  const isOpen = openAdjustId === `${borclu.id}:${type}`;
  if (!isOpen) return "";

  const title = type === "odeme" ? "Ödeme Al" : "Borç Ekle";
  const btnClass = type === "odeme" ? "btn-secondary" : "btn-primary";

  return `
    <form class="borclu-adjust" data-id="${escapeHtml(borclu.id)}" data-type="${type}">
      <p class="borclu-adjust__title">${escapeHtml(title)} — ${escapeHtml(borclu.isim)}</p>
      <label class="borclu-field">
        <span>Tutar (₺)</span>
        <input type="text" class="borclu-adjust-miktar" inputmode="decimal" required placeholder="0" />
      </label>
      <label class="borclu-field borclu-field--optional">
        <span>Tarih <em>(opsiyonel)</em></span>
        <input type="date" class="borclu-adjust-tarih" />
      </label>
      <div class="borclu-adjust__actions">
        <button type="button" class="btn btn-secondary borclu-adjust-iptal">İptal</button>
        <button type="submit" class="btn ${btnClass}">Kaydet</button>
      </div>
    </form>`;
}

function renderListe() {
  const items = getBorclularCache();

  if (items.length === 0) {
    els.liste.innerHTML = '<p class="empty-state">Henüz borçlu kaydı yok.</p>';
    els.toplam.textContent = formatAmount(0);
    els.sayisi.textContent = "0 kişi";
    return;
  }

  const toplamBorc = items.reduce((sum, item) => sum + item.bakiye, 0);
  els.toplam.textContent = formatAmount(toplamBorc);
  els.sayisi.textContent = `${items.length} kişi`;

  els.liste.innerHTML = items
    .map((item) => {
      const sonLabel = getSonHareketLabel(item);
      const sonHtml = sonLabel
        ? `<span class="borclu-item__son">${escapeHtml(sonLabel)}</span>`
        : "";

      return `
        <article class="borclu-item" data-id="${escapeHtml(item.id)}">
          <div class="borclu-item__header">
            <div class="borclu-item__main">
              <strong class="borclu-item__isim">${escapeHtml(item.isim)}</strong>
              ${sonHtml}
            </div>
            <span class="borclu-item__bakiye">${formatAmount(item.bakiye)}</span>
          </div>
          <div class="borclu-item__actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="borc_ekle">+ Borç Ekle</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="odeme" ${item.bakiye <= 0 ? "disabled" : ""}>− Ödeme Al</button>
            <button type="button" class="sil-btn" title="Sil" aria-label="${escapeHtml(item.isim)} kaydını sil">×</button>
          </div>
          ${renderAdjustPanel(item, "borc_ekle")}
          ${renderAdjustPanel(item, "odeme")}
          <details class="borclu-hareketler">
            <summary>Son hareketler (${(item.hareketler ?? []).length})</summary>
            <ul class="borclu-hareket-list">${renderHareketler(item)}</ul>
          </details>
        </article>`;
    })
    .join("");

  bindListeEvents();
}

function bindListeEvents() {
  els.liste.querySelectorAll('[data-action="borc_ekle"], [data-action="odeme"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".borclu-item");
      const id = item?.dataset.id;
      const type = btn.dataset.action;
      if (!id || !type) return;

      const key = `${id}:${type}`;
      openAdjustId = openAdjustId === key ? null : key;
      renderListe();
    });
  });

  els.liste.querySelectorAll(".borclu-adjust-iptal").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAdjustId = null;
      renderListe();
    });
  });

  els.liste.querySelectorAll(".borclu-adjust").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = form.dataset.id;
      const type = form.dataset.type;
      const miktarInput = form.querySelector(".borclu-adjust-miktar");
      const tarihInput = form.querySelector(".borclu-adjust-tarih");
      const miktar = parseAmount(miktarInput?.value ?? "");
      const tarih = tarihInput?.value || null;

      if (miktar <= 0) {
        alert("Lütfen geçerli bir tutar girin.");
        miktarInput?.focus();
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      try {
        await adjustBorcluInDb(id, type, miktar, tarih);
        openAdjustId = null;
        renderListe();
      } catch (error) {
        console.error(error);
        alert(error.message || "İşlem yapılamadı.");
      } finally {
        submitBtn.disabled = false;
      }
    });

    const miktarInput = form.querySelector(".borclu-adjust-miktar");
    if (miktarInput) bindAmountInput(miktarInput);
  });

  els.liste.querySelectorAll(".sil-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".borclu-item");
      const id = item?.dataset.id;
      if (!id) return;

      const record = getBorclularCache().find((entry) => entry.id === id);
      const label = record?.isim ?? "Bu";
      if (!confirm(`${label} kaydı ve tüm borç geçmişi silinsin mi?`)) return;

      btn.disabled = true;
      try {
        await deleteBorcluFromDb(id);
        openAdjustId = null;
        renderListe();
      } catch (error) {
        console.error(error);
        alert("Kayıt silinemedi. İnternet bağlantınızı kontrol edin.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const isim = els.isim.value.trim();
  const miktar = parseAmount(els.miktar.value);
  const tarih = els.tarih.value || null;

  if (!isim) {
    alert("Lütfen borçlu ismini girin.");
    els.isim.focus();
    return;
  }

  if (miktar <= 0) {
    alert("Lütfen geçerli bir borç tutarı girin.");
    els.miktar.focus();
    return;
  }

  const existing = findBorcluByIsim(isim);
  if (existing && !confirm(`${existing.isim} zaten listede. ${formatAmount(miktar)} borç eklensin mi?`)) {
    return;
  }

  setSavingState(true);
  try {
    await saveBorcluToDb(isim, miktar, tarih, existing ? "borc_ekle" : "borc_al");
    els.form.reset();
    renderListe();
  } catch (error) {
    console.error(error);
    alert(error.message || "Kayıt eklenemedi. İnternet bağlantınızı kontrol edin.");
  } finally {
    setSavingState(false);
  }
}

function init() {
  bindAmountInput(els.miktar);
  els.form.addEventListener("submit", handleSubmit);
}

async function bootstrap() {
  init();

  window.addEventListener("borclular-sync", () => {
    renderListe();
    updateSyncStatus();
  });

  try {
    await initSupabaseDb();
  } catch (error) {
    console.error(error);
    setBorclularCache(loadLegacyBorclular());
  }

  updateSyncStatus();
  renderListe();
}

bootstrap();
