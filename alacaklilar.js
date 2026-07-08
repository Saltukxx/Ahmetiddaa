const els = {
  syncStatus: document.getElementById("sync-status"),
  form: document.getElementById("alacakli-form"),
  isim: document.getElementById("alacakli-isim"),
  miktar: document.getElementById("alacakli-miktar"),
  tarih: document.getElementById("alacakli-tarih"),
  ekleBtn: document.getElementById("alacakli-ekle-btn"),
  liste: document.getElementById("alacakli-liste"),
  toplam: document.getElementById("alacakli-toplam"),
  sayisi: document.getElementById("alacakli-sayisi"),
};

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
  els.ekleBtn.disabled = isSaving;
  els.ekleBtn.textContent = isSaving ? "Kaydediliyor…" : "Ekle";
}

function bindAmountInput(input) {
  input.addEventListener("blur", () => {
    const val = parseAmount(input.value);
    if (val !== 0) {
      input.value = formatInputAmount(val);
    }
  });
}

function renderListe() {
  const items = getAlacaklilarCache();

  if (items.length === 0) {
    els.liste.innerHTML = '<p class="empty-state">Henüz alacaklı kaydı yok.</p>';
    els.toplam.textContent = formatAmount(0);
    els.sayisi.textContent = "0 kayıt";
    return;
  }

  const toplamMiktar = items.reduce((sum, item) => sum + item.miktar, 0);
  els.toplam.textContent = formatAmount(toplamMiktar);
  els.sayisi.textContent = `${items.length} kayıt`;

  els.liste.innerHTML = items
    .map((item) => {
      const tarihHtml = item.tarih
        ? `<span class="alacakli-item__tarih">${escapeHtml(formatTarihLabel(item.tarih))}</span>`
        : "";

      return `
        <article class="alacakli-item" data-id="${escapeHtml(item.id)}">
          <div class="alacakli-item__main">
            <strong class="alacakli-item__isim">${escapeHtml(item.isim)}</strong>
            ${tarihHtml}
          </div>
          <span class="alacakli-item__miktar">${formatAmount(item.miktar)}</span>
          <button type="button" class="sil-btn" title="Sil" aria-label="${escapeHtml(item.isim)} kaydını sil">×</button>
        </article>`;
    })
    .join("");

  els.liste.querySelectorAll(".sil-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = btn.closest(".alacakli-item");
      const id = item?.dataset.id;
      if (!id) return;

      const record = getAlacaklilarCache().find((entry) => entry.id === id);
      const label = record?.isim ?? "Bu";
      if (!confirm(`${label} kaydı silinsin mi?`)) return;

      btn.disabled = true;
      try {
        await deleteAlacakliFromDb(id);
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
    alert("Lütfen alacaklı ismini girin.");
    els.isim.focus();
    return;
  }

  if (miktar <= 0) {
    alert("Lütfen geçerli bir miktar girin.");
    els.miktar.focus();
    return;
  }

  setSavingState(true);
  try {
    await saveAlacakliToDb({ isim, miktar, tarih });
    els.form.reset();
    renderListe();
  } catch (error) {
    console.error(error);
    alert("Kayıt eklenemedi. İnternet bağlantınızı kontrol edin.");
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

  window.addEventListener("alacaklilar-sync", () => {
    renderListe();
    updateSyncStatus();
  });

  try {
    await initSupabaseDb();
  } catch (error) {
    console.error(error);
    setAlacaklilarCache(loadLegacyAlacaklilar());
  }

  updateSyncStatus();
  renderListe();
}

bootstrap();
