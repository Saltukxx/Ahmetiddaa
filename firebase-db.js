const FIRESTORE_COLLECTION = "kayitlar";
const LEGACY_STORAGE_KEY = "iddaa-gunluk-hesap";

let db = null;
let recordsCache = [];
let firebaseReady = false;

function isFirebaseConfigured() {
  const config = window.FIREBASE_CONFIG;
  if (!config) return false;

  const placeholders = ["YOUR_API_KEY", "YOUR_PROJECT_ID", "YOUR_SENDER_ID", "YOUR_APP_ID"];
  return (
    config.apiKey &&
    config.projectId &&
    !placeholders.includes(config.apiKey) &&
    !placeholders.includes(config.projectId)
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

function isFirebaseReady() {
  return firebaseReady;
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
  if (!db || recordsCache.length > 0) return;

  const legacy = loadLegacyRecords();
  if (legacy.length === 0) return;

  const batch = db.batch();
  legacy.forEach((kayit) => {
    const ref = db.collection(FIRESTORE_COLLECTION).doc(kayit.tarih);
    batch.set(ref, kayit);
  });
  await batch.commit();
  setRecordsCache(legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function fetchAllRecords() {
  if (!db) return [];

  const snapshot = await db.collection(FIRESTORE_COLLECTION).get();
  const records = snapshot.docs.map((doc) => doc.data());
  setRecordsCache(records);
  return recordsCache;
}

async function initFirebaseDb() {
  if (!isFirebaseConfigured()) {
    const legacy = loadLegacyRecords();
    setRecordsCache(legacy);
    firebaseReady = false;
    return false;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(window.FIREBASE_CONFIG);
  }

  db = firebase.firestore();
  await fetchAllRecords();
  await migrateLegacyRecords();
  firebaseReady = true;
  return true;
}

async function saveRecordToDb(kayit) {
  if (firebaseReady && db) {
    await db.collection(FIRESTORE_COLLECTION).doc(kayit.tarih).set(kayit);
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
  if (firebaseReady && db) {
    await db.collection(FIRESTORE_COLLECTION).doc(tarih).delete();
  } else {
    setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(recordsCache));
    return;
  }

  setRecordsCache(getRecordsCache().filter((r) => r.tarih !== tarih));
}
