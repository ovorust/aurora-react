/**
 * Camada de armazenamento de conversas.
 *
 * Arquitetura:
 *  - IndexedDB é a FONTE DA VERDADE: toda leitura/escrita local é instantânea,
 *    sobrevive a refresh/fechar aba, e não depende de rede.
 *  - localStorage é um fallback automático caso IndexedDB não esteja disponível
 *    (ex.: modo privado em alguns navegadores).
 *  - O backup na nuvem (npoint.io, via utils/api.js) roda em segundo plano,
 *    é debounced e enfileirado (nunca duas gravações concorrentes), e nunca
 *    bloqueia a UI. Se falhar, os dados continuam seguros localmente.
 */

import { loadChats as loadChatsCloud, saveChats as saveChatsCloud } from './api';

const DB_NAME = 'aurora-chats-db';
const DB_VERSION = 1;
const STORE = 'chats';
const LS_FALLBACK_KEY = 'aurora_chats_fallback';

let dbPromise = null;
let indexedDbBroken = false;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Falha ao abrir IndexedDB'));
  });
  return dbPromise;
}

function runTx(mode, executor) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        try {
          executor(store, (r) => {
            result = r;
          });
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

/* ── Fallback via localStorage (usado só se IndexedDB não existir) ── */
function readLocalStorageFallback() {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalStorageFallback(chats) {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(chats));
  } catch (err) {
    console.error('[AURORA] Falha ao salvar fallback em localStorage:', err);
  }
}

/* ── API pública: leitura/escrita local (instantânea, confiável) ── */

export async function getAllChatsLocal() {
  if (indexedDbBroken) return readLocalStorageFallback();
  try {
    const chats = await runTx('readonly', (store, setResult) => {
      const req = store.getAll();
      req.onsuccess = () => setResult(req.result || []);
    });
    return chats;
  } catch (err) {
    console.warn('[AURORA] IndexedDB indisponível, usando fallback local:', err);
    indexedDbBroken = true;
    return readLocalStorageFallback();
  }
}

export async function replaceAllChatsLocal(chats) {
  if (indexedDbBroken) {
    writeLocalStorageFallback(chats);
    return;
  }
  try {
    await runTx('readwrite', (store) => {
      store.clear();
      chats.forEach((c) => store.put(c));
    });
  } catch (err) {
    console.warn('[AURORA] IndexedDB indisponível, usando fallback local:', err);
    indexedDbBroken = true;
    writeLocalStorageFallback(chats);
  }
}

export async function putChatLocal(chat) {
  if (indexedDbBroken) {
    const all = readLocalStorageFallback();
    const idx = all.findIndex((c) => c.id === chat.id);
    if (idx >= 0) all[idx] = chat;
    else all.unshift(chat);
    writeLocalStorageFallback(all);
    return;
  }
  try {
    await runTx('readwrite', (store) => {
      store.put(chat);
    });
  } catch (err) {
    console.warn('[AURORA] IndexedDB indisponível, usando fallback local:', err);
    indexedDbBroken = true;
    await putChatLocal(chat);
  }
}

export async function deleteChatLocal(id) {
  if (indexedDbBroken) {
    const all = readLocalStorageFallback().filter((c) => c.id !== id);
    writeLocalStorageFallback(all);
    return;
  }
  try {
    await runTx('readwrite', (store) => {
      store.delete(id);
    });
  } catch (err) {
    console.warn('[AURORA] IndexedDB indisponível, usando fallback local:', err);
    indexedDbBroken = true;
    await deleteChatLocal(id);
  }
}

/* ── Backup em nuvem: debounced, enfileirado, nunca bloqueia a UI ── */

let cloudTimer = null;
let cloudInFlight = false;
let cloudPending = null;
let onCloudStatusChange = null;

export function setCloudStatusListener(fn) {
  onCloudStatusChange = fn;
}

function notifyCloud(status) {
  onCloudStatusChange?.(status); // 'syncing' | 'synced' | 'offline'
}

async function flushCloudSync() {
  if (cloudInFlight || cloudPending === null) return;
  const data = cloudPending;
  cloudPending = null;
  cloudInFlight = true;
  notifyCloud('syncing');
  try {
    await saveChatsCloud(data);
    notifyCloud('synced');
  } catch (err) {
    console.warn('[AURORA] Backup na nuvem falhou (dados seguros localmente):', err);
    notifyCloud('offline');
  } finally {
    cloudInFlight = false;
    if (cloudPending !== null) flushCloudSync();
  }
}

/** Agenda um backup em nuvem debounced. Nunca lança erro nem bloqueia. */
export function scheduleCloudBackup(chats, delay = 1500) {
  cloudPending = chats;
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(flushCloudSync, delay);
}

/**
 * Carrega as conversas na inicialização:
 * 1. Lê do IndexedDB local (instantâneo) — é o que a UI mostra imediatamente.
 * 2. Se local estiver vazio, tenta importar da nuvem (migração/1º acesso em novo navegador).
 * 3. Nunca deixa uma falha de rede impedir o app de abrir.
 */
export async function loadInitialChats() {
  const local = await getAllChatsLocal();
  if (local.length > 0) {
    // Ainda tenta buscar da nuvem em paralelo só para checar se há algo mais novo
    // vindo de outro dispositivo, mas não bloqueia nem sobrescreve sem critério.
    return { chats: local, source: 'local' };
  }
  try {
    const cloud = await loadChatsCloud();
    if (Array.isArray(cloud) && cloud.length > 0) {
      await replaceAllChatsLocal(cloud);
      return { chats: cloud, source: 'cloud' };
    }
  } catch (err) {
    console.warn('[AURORA] Sem conexão com backup em nuvem, iniciando local:', err);
  }
  return { chats: [], source: 'local' };
}
