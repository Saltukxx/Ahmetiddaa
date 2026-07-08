const TABLE_NAME = "kayitlar";
const LEGACY_STORAGE_KEY = "iddaa-gunluk-hesap";

let supabaseClient = null;
let recordsCache = [];
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
    .channel("kayitlar-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE_NAME },
      async () => {
        try {
          await fetchAllRecords();
          window.dispatchEvent(new CustomEvent("kayitlar-sync"));
        } catch (error) {
          console.error("Senkron güncelleme hatası:", error);
        }
      }
    )
    .subscribe();
}

async function initSupabaseDb() {
  if (!isSupabaseConfigured()) {
    const legacy = loadLegacyRecords();
    setRecordsCache(legacy);
    supabaseReady = false;
    return false;
  }

  if (!window.supabase?.createClient) {
    throw new Error("Supabase istemcisi yüklenemedi.");
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  supabaseClient = window.supabase.createClient(url, anonKey);

  await fetchAllRecords();
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
