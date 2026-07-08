const TABLE_NAME = "kayitlar";
const ALACAKLI_TABLE_NAME = "alacaklilar";
const LEGACY_STORAGE_KEY = "iddaa-gunluk-hesap";
const LEGACY_ALACAKLI_KEY = "iddaa-alacaklilar";

let supabaseClient = null;
let recordsCache = [];
let alacaklilarCache = [];
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

function getAlacaklilarCache() {
  return alacaklilarCache;
}

function setAlacaklilarCache(items) {
  alacaklilarCache = items.slice().sort((a, b) => {
    const nameCompare = a.isim.localeCompare(b.isim, "tr");
    if (nameCompare !== 0) return nameCompare;
    return (b.tarih ?? "").localeCompare(a.tarih ?? "");
  });
}

function rowToAlacakli(row) {
  return {
    id: row.id,
    isim: row.isim,
    miktar: Number(row.miktar) || 0,
    tarih: row.tarih ?? null,
    kayitZamani: row.kayit_zamani ?? new Date().toISOString(),
  };
}

function loadLegacyAlacaklilar() {
  try {
    const raw = localStorage.getItem(LEGACY_ALACAKLI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLegacyAlacaklilar(items) {
  localStorage.setItem(LEGACY_ALACAKLI_KEY, JSON.stringify(items));
}

async function fetchAllAlacaklilar() {
  if (!supabaseClient) {
    const legacy = loadLegacyAlacaklilar();
    setAlacaklilarCache(legacy);
    return alacaklilarCache;
  }

  const { data, error } = await supabaseClient
    .from(ALACAKLI_TABLE_NAME)
    .select("id, isim, miktar, tarih, kayit_zamani")
    .order("isim", { ascending: true });

  if (error) throw error;

  setAlacaklilarCache((data ?? []).map(rowToAlacakli));
  return alacaklilarCache;
}

async function saveAlacakliToDb(alacakli) {
  const payload = {
    isim: alacakli.isim.trim(),
    miktar: alacakli.miktar,
    tarih: alacakli.tarih || null,
  };

  if (supabaseReady && supabaseClient) {
    if (alacakli.id && !String(alacakli.id).startsWith("local-")) {
      const { error } = await supabaseClient
        .from(ALACAKLI_TABLE_NAME)
        .update(payload)
        .eq("id", alacakli.id);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseClient
        .from(ALACAKLI_TABLE_NAME)
        .insert(payload)
        .select("id, isim, miktar, tarih, kayit_zamani")
        .single();
      if (error) throw error;
      alacakli.id = data.id;
      alacakli.kayitZamani = data.kayit_zamani;
    }
  } else {
    if (!alacakli.id) alacakli.id = createLocalId();
    alacakli.kayitZamani = new Date().toISOString();
    const items = getAlacaklilarCache();
    items.push(alacakli);
    setAlacaklilarCache(items);
    saveLegacyAlacaklilar(alacaklilarCache);
    return alacakli;
  }

  const items = getAlacaklilarCache();
  const index = items.findIndex((item) => item.id === alacakli.id);
  const saved = {
    ...alacakli,
    kayitZamani: alacakli.kayitZamani ?? new Date().toISOString(),
  };
  if (index >= 0) items[index] = saved;
  else items.push(saved);
  setAlacaklilarCache(items);
  return saved;
}

async function deleteAlacakliFromDb(id) {
  if (supabaseReady && supabaseClient) {
    const { error } = await supabaseClient.from(ALACAKLI_TABLE_NAME).delete().eq("id", id);
    if (error) throw error;
  } else {
    setAlacaklilarCache(getAlacaklilarCache().filter((item) => item.id !== id));
    saveLegacyAlacaklilar(alacaklilarCache);
    return;
  }

  setAlacaklilarCache(getAlacaklilarCache().filter((item) => item.id !== id));
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
      { event: "*", schema: "public", table: ALACAKLI_TABLE_NAME },
      async () => {
        try {
          await fetchAllAlacaklilar();
          window.dispatchEvent(new CustomEvent("alacaklilar-sync"));
        } catch (error) {
          console.error("Alacaklı senkron hatası:", error);
        }
      }
    )
    .subscribe();
}

async function initSupabaseDb() {
  if (!isSupabaseConfigured()) {
    const legacy = loadLegacyRecords();
    setRecordsCache(legacy);
    setAlacaklilarCache(loadLegacyAlacaklilar());
    supabaseReady = false;
    return false;
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase istemcisi yüklenemedi.");
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  supabaseClient = window.supabase.createClient(url, anonKey);

  await fetchAllRecords();
  await fetchAllAlacaklilar();
  await migrateLegacyRecords();
  subscribeToChanges();

  supabaseReady = true;
  return true;
}

async function saveRecordToDb(kayit) {
  if (supabaseReady && supabaseClient) {
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
  if (supabaseReady && supabaseClient) {
    const { error } = await supabaseClient.from(TABLE_NAME).delete().eq("tarih", tarih);
    if (error) throw error;
  } else {
    setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(recordsCache));
    return;
  }

  setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
}
