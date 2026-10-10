/**
 * Payment Session Cache
 * Tracks in-progress member subscription / invoice state across modal re-opens,
 * page reloads (F5), network hiccups, and multi-step cash or online payment flows.
 *
 * Scoped by authenticated actor ID + member ID + sessionRef:
 * 1. Hard refreshes (F5) preserve in-flight transactions for the active staff member.
 * 2. Another user / role logging in or switching in the same tab CANNOT resume
 *    or access a previous user's pending transactions.
 * 3. Starting a "New Session" preserves the old session without overwriting it.
 * 4. Resuming a preserved session allows staff to safely inspect or complete it.
 * 5. Deleting / cancelling a session does NOT resurrect old sessions on modal reopen.
 * 6. No sensitive transaction data is leaked onto the global window object.
 */

const STORAGE_KEY_PREFIX = 'scms_in_progress_tx_';

function getStorageKey(actorId) {
  const safeActor = actorId !== undefined && actorId !== null ? String(actorId).trim() : 'anonymous';
  return `${STORAGE_KEY_PREFIX}${safeActor}`;
}

function getSessionStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
    return globalThis.sessionStorage;
  }
  return null;
}

function loadFromStorage(actorId) {
  const storage = getSessionStorage();
  if (!storage) return new Map();
  try {
    const raw = storage.getItem(getStorageKey(actorId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    // Corrupted storage, fall back to empty Map
  }
  return new Map();
}

function saveToStorage(map, actorId) {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    const key = getStorageKey(actorId);
    if (!map || map.size === 0) {
      storage.removeItem(key);
    } else {
      const obj = Object.fromEntries(map.entries());
      storage.setItem(key, JSON.stringify(obj));
    }
  } catch (e) {}
}

// In-memory cache keyed by actorId -> Map(compositeKey -> data)
const memoryStores = new Map();

function getStoreForActor(actorId) {
  const safeActor = actorId !== undefined && actorId !== null ? String(actorId).trim() : 'anonymous';
  if (!memoryStores.has(safeActor)) {
    memoryStores.set(safeActor, loadFromStorage(safeActor));
  }
  return { store: memoryStores.get(safeActor), safeActor };
}

function makeCompositeKey(memberId, sessionRef) {
  return `${String(memberId)}::${String(sessionRef)}`;
}

export const inProgressTransactionCache = {
  get(memberId, actorId, sessionRef) {
    const mId = String(memberId);
    const { store, safeActor } = getStoreForActor(actorId);

    // Sync from storage if needed
    const fromDisk = loadFromStorage(safeActor);
    for (const [k, v] of fromDisk.entries()) {
      if (!store.has(k)) store.set(k, v);
    }

    if (sessionRef) {
      const compKey = makeCompositeKey(mId, sessionRef);
      return store.get(compKey) || null;
    }

    // If no specific sessionRef requested, check active session pointer
    const activeRef = store.get(`_active_${mId}`);
    if (activeRef) {
      const compKey = makeCompositeKey(mId, activeRef);
      const activeSession = store.get(compKey);
      if (activeSession) return activeSession;
    }

    // Fallback: search for active session in composite store
    for (const [k, v] of store.entries()) {
      if (k.startsWith(`${mId}::`) && v && v.status === 'active') {
        return v;
      }
    }

    // Never return a stale legacy bare-member key that might have been cancelled
    return null;
  },

  set(memberId, value, actorId, sessionRef) {
    const mId = String(memberId);
    const sRef = sessionRef || value?.sessionRef || `TXN-${Date.now()}`;
    const compKey = makeCompositeKey(mId, sRef);
    const { store, safeActor } = getStoreForActor(actorId);

    const sessionData = {
      ...value,
      memberId: mId,
      sessionRef: sRef,
      updatedAt: Date.now(),
      status: value?.status || 'active',
    };

    store.set(compKey, sessionData);
    if (sessionData.status === 'active') {
      store.set(`_active_${mId}`, sRef);
    }

    // Remove legacy bare key to avoid resurrection bug
    store.delete(mId);

    saveToStorage(store, safeActor);
    return this;
  },

  startNewSession(memberId, actorId, newSessionRef, preservedInfo = {}) {
    const mId = String(memberId);
    const { store, safeActor } = getStoreForActor(actorId);

    // Find current active session and mark it as preserved so it's not overwritten
    const currentActiveRef = store.get(`_active_${mId}`);
    if (currentActiveRef) {
      const oldKey = makeCompositeKey(mId, currentActiveRef);
      const oldSession = store.get(oldKey);
      if (oldSession) {
        store.set(oldKey, {
          ...oldSession,
          status: 'preserved',
          preservedAt: Date.now(),
        });
      }
    }

    // Create the fresh new session
    const newKey = makeCompositeKey(mId, newSessionRef);
    const newSession = {
      memberId: mId,
      sessionRef: newSessionRef,
      subscriptionId: null,
      invoiceId: null,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...preservedInfo,
    };
    store.set(newKey, newSession);
    store.set(`_active_${mId}`, newSessionRef);

    // Remove legacy bare key
    store.delete(mId);

    saveToStorage(store, safeActor);
    return newSession;
  },

  resumeSession(memberId, actorId, targetSessionRef) {
    const mId = String(memberId);
    const { store, safeActor } = getStoreForActor(actorId);

    const targetKey = makeCompositeKey(mId, targetSessionRef);
    const session = store.get(targetKey);
    if (!session) return null;

    // If another session was active, mark it preserved
    const currentActiveRef = store.get(`_active_${mId}`);
    if (currentActiveRef && currentActiveRef !== targetSessionRef) {
      const oldKey = makeCompositeKey(mId, currentActiveRef);
      const oldSession = store.get(oldKey);
      if (oldSession && oldSession.status === 'active') {
        store.set(oldKey, {
          ...oldSession,
          status: 'preserved',
          updatedAt: Date.now(),
        });
      }
    }

    // Activate the resumed session
    const updated = {
      ...session,
      status: 'active',
      resumedAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.set(targetKey, updated);
    store.set(`_active_${mId}`, targetSessionRef);

    // Remove legacy bare key
    store.delete(mId);

    saveToStorage(store, safeActor);
    return updated;
  },

  delete(memberId, actorId, sessionRef) {
    const mId = String(memberId);
    const { store, safeActor } = getStoreForActor(actorId);

    // Clean up legacy bare key unconditionally
    store.delete(mId);

    if (sessionRef) {
      const compKey = makeCompositeKey(mId, sessionRef);
      store.delete(compKey);

      if (store.get(`_active_${mId}`) === sessionRef) {
        store.delete(`_active_${mId}`);

        // Look for any remaining session for this member (prefer active, otherwise latest preserved)
        let candidate = null;
        for (const [k, v] of store.entries()) {
          if (k.startsWith(`${mId}::`) && v && typeof v === 'object' && v.sessionRef) {
            if (v.status === 'active') {
              candidate = v;
              break;
            }
            if (!candidate || (v.updatedAt || 0) > (candidate.updatedAt || 0)) {
              candidate = v;
            }
          }
        }

        if (candidate) {
          const activatedCandidate = { ...candidate, status: 'active', updatedAt: Date.now() };
          store.set(makeCompositeKey(mId, activatedCandidate.sessionRef), activatedCandidate);
          store.set(`_active_${mId}`, activatedCandidate.sessionRef);
        }
      }
    } else {
      const activeRef = store.get(`_active_${mId}`);
      if (activeRef) {
        store.delete(makeCompositeKey(mId, activeRef));
        store.delete(`_active_${mId}`);
      }
    }

    saveToStorage(store, safeActor);
    return true;
  },

  getAllSessionsForMember(memberId, actorId) {
    const mId = String(memberId);
    const { store, safeActor } = getStoreForActor(actorId);
    const fromDisk = loadFromStorage(safeActor);
    for (const [k, v] of fromDisk.entries()) {
      if (!store.has(k)) store.set(k, v);
    }
    const sessions = [];
    for (const [k, v] of store.entries()) {
      if (k.startsWith(`${mId}::`) && v && typeof v === 'object') {
        sessions.push(v);
      }
    }
    // Sort so active session is first, then by updatedAt descending
    sessions.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return sessions;
  },

  clear(actorId) {
    const { store, safeActor } = getStoreForActor(actorId);
    store.clear();
    saveToStorage(store, safeActor);
  },

  has(memberId, actorId, sessionRef) {
    return Boolean(this.get(memberId, actorId, sessionRef));
  },

  loadFromStorage(actorId) {
    if (actorId !== undefined) {
      const safeActor = String(actorId).trim();
      const diskStore = loadFromStorage(safeActor);
      memoryStores.set(safeActor, diskStore);
      return diskStore;
    }
    for (const safeActor of memoryStores.keys()) {
      memoryStores.set(safeActor, loadFromStorage(safeActor));
    }
    return true;
  },

  entries(actorId) {
    const { store } = getStoreForActor(actorId);
    return store.entries();
  },
};

export function getInProgressTransaction(memberId, actorId, sessionRef) {
  if (!memberId) return null;
  return inProgressTransactionCache.get(memberId, actorId, sessionRef);
}

export function setInProgressTransaction(memberId, data, actorId, sessionRef) {
  if (!memberId) return;
  inProgressTransactionCache.set(memberId, data, actorId, sessionRef);
}

export function clearInProgressTransaction(memberId, actorId, sessionRef) {
  if (!memberId) return;
  inProgressTransactionCache.delete(memberId, actorId, sessionRef);
}

export function clearAllInProgressTransactions(actorId) {
  inProgressTransactionCache.clear(actorId);
}

// Test-only harness seam: ONLY exposed when Vite is explicitly configured with VITE_TEST_HARNESS === 'true'.
// Strictly stripped and absent in normal development (npm run dev) and production builds (npm run build).
if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TEST_HARNESS === 'true') {
  window.__inProgressTransactionCache = inProgressTransactionCache;
}
