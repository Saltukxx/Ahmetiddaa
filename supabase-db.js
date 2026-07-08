const TABLE_NAME = "kayitlar";
const BORCLU_TABLE_NAME = "borclular";
const LEGACY_STORAGE_KEY = "iddaa-gunluk-hesap";
const LEGACY_BORCLU_KEY = "iddaa-borclular";
const LEGACY_ALACAKLI_KEY = "iddaa-alacaklilar";

let supabaseClient = null;
let recordsCache = [];
let borclularCache = [];
let supabaseReady = false;
let realtimeChannel = null;

function isSupabaseConfigured() {
  const config = window.SUPABASE_CONFIG;
  if (!config) return false;

  const placeholders = ["YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY"];
  return (
    config.url &&
    config.anonKey &&
    !placeholders.includes(config.url) &&
    !placeholders.includes(config.anonKey)
  );
}

function sortRecords(records) {
  return records.slice().sort((a, b) => a.tarih.localeCompare(b.tarih));
}

function setRecordsCache(records) {
  recordsCache = sortRecords(records);
}

function getRecordsCache() {
  return recordsCache;
}

function isSupabaseReady() {
  return supabaseReady;
}

function canUseSupabase() {
  return Boolean(supabaseClient && isSupabaseConfigured());
}

function normalizeIsim(isim) {
  return String(isim ?? "").trim();
}

function isimKey(isim) {
  return normalizeIsim(isim).toLocaleLowerCase("tr");
}

function createHareket(tur, miktar, tarih) {
  return {
    tur,
    miktar,
    tarih: tarih || null,
    zaman: new Date().toISOString(),
  };
}

function getBorclularCache() {
  return borclularCache;
}

function setBorclularCache(items) {
  borclularCache = items.slice().sort((a, b) => {
    const nameCompare = a.isim.localeCompare(b.isim, "tr");
    if (nameCompare !== 0) return nameCompare;
    return (b.bakiye ?? 0) - (a.bakiye ?? 0);
  });
}

function rowToBorclu(row) {
  return {
    id: row.id,
    isim: row.isim,
    bakiye: Number(row.bakiye) || 0,
    hareketler: Array.isArray(row.hareketler) ? row.hareketler : [],
    kayitZamani: row.kayit_zamani ?? new Date().toISOString(),
  };
}

function findBorcluByIsim(isim) {
  const key = isimKey(isim);
  return getBorclularCache().find((item) => isimKey(item.isim) === key) ?? null;
}

function loadLegacyBorclularRaw() {
  const sources = [];
  try {
    const borcluRaw = localStorage.getItem(LEGACY_BORCLU_KEY);
    if (borcluRaw) sources.push(...JSON.parse(borcluRaw));
  } catch {
    /* ignore */
  }
  try {
    const alacakliRaw = localStorage.getItem(LEGACY_ALACAKLI_KEY);
    if (alacakliRaw) sources.push(...JSON.parse(alacakliRaw));
  } catch {
    /* ignore */
  }
  return sources;
}

function legacyItemsToBorclular(items) {
  const grouped = new Map();

  for (const item of items) {
    const isim = normalizeIsim(item.isim);
    if (!isim) continue;

    const key = isimKey(isim);
    const miktar = Number(item.bakiye ?? item.miktar) || 0;
    if (miktar <= 0 && !item.bakiye) continue;

    const hareket = createHareket(
      item.tur ?? "borc_al",
      miktar,
      item.tarih ?? null
    );

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: item.id && !String(item.id).startsWith("local-") ? item.id : createLocalId(),
        isim,
        bakiye: 0,
        hareketler: [],
        kayitZamani: item.kayitZamani ?? new Date().toISOString(),
      });
    }

    const borclu = grouped.get(key);
    borclu.bakiye += miktar;
    borclu.hareketler.push(hareket);
  }

  return [...grouped.values()];
}

function loadLegacyBorclular() {
  return legacyItemsToBorclular(loadLegacyBorclularRaw());
}

function saveLegacyBorclular(items) {
  localStorage.setItem(LEGACY_BORCLU_KEY, JSON.stringify(items));
}

async function fetchAllBorclular() {
  if (!supabaseClient) {
    setBorclularCache(loadLegacyBorclular());
    return borclularCache;
  }

  const { data, error } = await supabaseClient
    .from(BORCLU_TABLE_NAME)
    .select("id, isim, bakiye, hareketler, kayit_zamani")
    .order("isim", { ascending: true });

  if (error) throw error;

  setBorclularCache((data ?? []).map(rowToBorclu));
  return borclularCache;
}

async function migrateLegacyBorclular() {
  if (!supabaseClient) return;

  const legacy = loadLegacyBorclular();
  if (legacy.length === 0) {
    localStorage.removeItem(LEGACY_ALACAKLI_KEY);
    return;
  }

  for (const borclu of legacy) {
    if (!borclu.isim || borclu.bakiye <= 0) continue;

    const existing = findBorcluByIsim(borclu.isim);
    if (existing && canUseSupabase()) {
      await adjustBorcluInDb(existing.id, "borc_ekle", borclu.bakiye, null);
      continue;
    }

    const row = {
      isim: borclu.isim,
      bakiye: borclu.bakiye,
      hareketler: borclu.hareketler?.length ? borclu.hareketler : [createHareket("borc_al", borclu.bakiye, null)],
      kayit_zamani: borclu.kayitZamani ?? new Date().toISOString(),
    };

    const { error } = await supabaseClient.from(BORCLU_TABLE_NAME).insert(row);
    if (error && error.code !== "23505") throw error;
  }

  await fetchAllBorclular();
  localStorage.removeItem(LEGACY_BORCLU_KEY);
  localStorage.removeItem(LEGACY_ALACAKLI_KEY);
}

async function saveBorcluToDb(isim, miktar, tarih, tur = "borc_al") {
  const cleanIsim = normalizeIsim(isim);
  const amount = Number(miktar) || 0;
  if (!cleanIsim || amount <= 0) {
    throw new Error("Geçersiz borç kaydı");
  }

  const existing = findBorcluByIsim(cleanIsim);
  if (existing) {
    return adjustBorcluInDb(existing.id, tur === "borc_al" ? "borc_ekle" : tur, amount, tarih);
  }

  const hareket = createHareket(tur, amount, tarih);
  const borclu = {
    isim: cleanIsim,
    bakiye: amount,
    hareketler: [hareket],
    kayitZamani: new Date().toISOString(),
  };

  if (canUseSupabase()) {
    const { data, error } = await supabaseClient
      .from(BORCLU_TABLE_NAME)
      .insert({
        isim: borclu.isim,
        bakiye: borclu.bakiye,
        hareketler: borclu.hareketler,
        kayit_zamani: borclu.kayitZamani,
      })
      .select("id, isim, bakiye, hareketler, kayit_zamani")
      .single();

    if (error?.code === "23505") {
      await fetchAllBorclular();
      const duplicate = findBorcluByIsim(cleanIsim);
      if (duplicate) {
        return adjustBorcluInDb(duplicate.id, "borc_ekle", amount, tarih);
      }
    }

    if (error) throw error;
    borclu.id = data.id;
    borclu.kayitZamani = data.kayit_zamani;
    borclu.hareketler = data.hareketler ?? borclu.hareketler;
    borclu.bakiye = Number(data.bakiye) || borclu.bakiye;
  } else {
    borclu.id = createLocalId();
    const items = getBorclularCache();
    items.push(borclu);
    setBorclularCache(items);
    saveLegacyBorclular(borclularCache);
    return borclu;
  }

  const items = getBorclularCache();
  items.push(rowToBorclu({ ...borclu, kayit_zamani: borclu.kayitZamani }));
  setBorclularCache(items);
  return borclu;
}

async function adjustBorcluInDb(id, tur, miktar, tarih) {
  const amount = Number(miktar) || 0;
  if (amount <= 0) throw new Error("Geçersiz tutar");

  const borclu = getBorclularCache().find((item) => item.id === id);
  if (!borclu) throw new Error("Borçlu bulunamadı");

  if (tur === "odeme" && amount > borclu.bakiye) {
    throw new Error("Ödeme tutarı borçtan fazla olamaz");
  }

  const hareket = createHareket(tur, amount, tarih);
  const hareketler = [...(borclu.hareketler ?? []), hareket];
  const bakiye = tur === "odeme" ? borclu.bakiye - amount : borclu.bakiye + amount;

  if (canUseSupabase()) {
    const { data, error } = await supabaseClient
      .from(BORCLU_TABLE_NAME)
      .update({ bakiye, hareketler })
      .eq("id", id)
      .select("id, isim, bakiye, hareketler, kayit_zamani")
      .single();
    if (error) throw error;

    const updated = rowToBorclu(data);
    const items = getBorclularCache();
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) items[index] = updated;
    else items.push(updated);
    setBorclularCache(items);
    return updated;
  }

  borclu.bakiye = bakiye;
  borclu.hareketler = hareketler;
  setBorclularCache(getBorclularCache());
  saveLegacyBorclular(borclularCache);
  return borclu;
}

async function deleteBorcluFromDb(id) {
  if (canUseSupabase()) {
    const { error } = await supabaseClient.from(BORCLU_TABLE_NAME).delete().eq("id", id);
    if (error) throw error;
  } else {
    setBorclularCache(getBorclularCache().filter((item) => item.id !== id));
    saveLegacyBorclular(borclularCache);
    return;
  }

  setBorclularCache(getBorclularCache().filter((item) => item.id !== id));
}

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToKayit(row) {
  const kayit = row.kayit ?? {};
  return {
    ...kayit,
    tarih: row.tarih,
    kayitZamani: kayit.kayitZamani ?? row.kayit_zamani ?? new Date().toISOString(),
  };
}

function loadLegacyRecords() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function migrateLegacyRecords() {
  if (!supabaseClient || recordsCache.length > 0) return;

  const legacy = loadLegacyRecords();
  if (legacy.length === 0) return;

  const rows = legacy.map((kayit) => ({
    tarih: kayit.tarih,
    kayit,
    kayit_zamani: kayit.kayitZamani ?? new Date().toISOString(),
  }));

  const { error } = await supabaseClient.from(TABLE_NAME).upsert(rows, { onConflict: "tarih" });
  if (error) throw error;

  setRecordsCache(legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function fetchAllRecords() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("tarih, kayit, kayit_zamani")
    .order("tarih", { ascending: true });

  if (error) throw error;

  const records = (data ?? []).map(rowToKayit);
  setRecordsCache(records);
  return recordsCache;
}

function subscribeToChanges() {
  if (!supabaseClient || realtimeChannel) return;

  realtimeChannel = supabaseClient
    .channel("app-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE_NAME },
      async () => {
        try {
          await fetchAllRecords();
          window.dispatchEvent(new CustomEvent("kayitlar-sync"));
        } catch (error) {
          console.error("Kayıt senkron hatası:", error);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: BORCLU_TABLE_NAME },
      async () => {
        try {
          await fetchAllBorclular();
          window.dispatchEvent(new CustomEvent("borclular-sync"));
        } catch (error) {
          console.error("Borçlu senkron hatası:", error);
        }
      }
    )
    .subscribe();
}

async function initSupabaseDb() {
  if (!isSupabaseConfigured()) {
    const legacy = loadLegacyRecords();
    setRecordsCache(legacy);
    setBorclularCache(loadLegacyBorclular());
    supabaseReady = false;
    return false;
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase istemcisi yüklenemedi.");
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  supabaseClient = window.supabase.createClient(url, anonKey);

  await fetchAllRecords();

  try {
    await fetchAllBorclular();
  } catch (error) {
    console.error("Borçlu kayıtları yüklenemedi:", error);
    setBorclularCache(loadLegacyBorclular());
  }

  await migrateLegacyRecords();

  try {
    await migrateLegacyBorclular();
  } catch (error) {
    console.error("Yerel borçlu kayıtları taşınamadı:", error);
  }

  subscribeToChanges();

  supabaseReady = true;
  return true;
}

async function saveRecordToDb(kayit) {
  if (canUseSupabase()) {
    const { error } = await supabaseClient.from(TABLE_NAME).upsert(
      {
        tarih: kayit.tarih,
        kayit,
        kayit_zamani: kayit.kayitZamani ?? new Date().toISOString(),
      },
      { onConflict: "tarih" }
    );
    if (error) throw error;
  } else {
    const records = getRecordsCache();
    const index = records.findIndex((r) => r.tarih === kayit.tarih);
    if (index >= 0) records[index] = kayit;
    else records.push(kayit);
    setRecordsCache(records);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(recordsCache));
    return;
  }

  const records = getRecordsCache();
  const index = records.findIndex((r) => r.tarih === kayit.tarih);
  if (index >= 0) records[index] = kayit;
  else records.push(kayit);
  setRecordsCache(records);
}

async function deleteRecordFromDb(tarih) {
  if (canUseSupabase()) {
    const { error } = await supabaseClient.from(TABLE_NAME).delete().eq("tarih", tarih);
    if (error) throw error;
  } else {
    setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(recordsCache));
    return;
  }

  setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
}
