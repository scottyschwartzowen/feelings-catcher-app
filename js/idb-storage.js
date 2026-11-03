// Every function below takes the signed-in user's id FIRST, because each user
// gets their own local database on this device.
const DATABASE_NAME = "feelings-catcher-local";
const DATABASE_VERSION = 2;
const STORE_NAME = "feelings";
const PENDING_STORE = "pendingChanges";

function createChangeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `change-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newestFirst(feelings) {
  return [...feelings].sort(
    (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0),
  );
}

function openDatabase(userId) {
  return new Promise((resolve, reject) => {
    if (!userId) {
      reject(new Error("openDatabase needs a signed-in user id"));
      return;
    }
    const request = indexedDB.open(
      `${DATABASE_NAME}-${userId}`,
      DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      // The feelings store already exists in version 1, so its records stay (online)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }

      // Each feeling can have one latest pending action in the queue (offline)
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: "feelingId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readAllFeelings(userId) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(newestFirst(request.result));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

export async function replaceFeelings(userId, feelings) {
  const db = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.clear();
    feelings.forEach((item) => store.put(item));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB transaction failed"));
    };
    tx.onerror = () => {};
  });
}

// Save the user's change and its sync task together, so neither is lost alone.
export async function saveFeelingAndQueue(userId, feeling, action) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, PENDING_STORE], "readwrite");
    const feelings = tx.objectStore(STORE_NAME);
    const pending = tx.objectStore(PENDING_STORE);
    const previousRequest = pending.get(feeling.id);

    previousRequest.onsuccess = () => {
      const previous = previousRequest.result;
      // An edit to a feeling that was never synced is still a "create"
      const actionType = previous?.type === "create" ? "create" : action;
      const queuedAtMs = previous?.queuedAtMs || Date.now();

      feelings.put(feeling);
      pending.put({
        feelingId: feeling.id,
        type: actionType,
        data: feeling,
        queuedAtMs,
        changeId: createChangeId(),
      });
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not save the offline change."));
    };
    tx.onerror = () => {};
  });
}

// Store a delete task even when a create is being synced at the same time.
export async function deleteFeelingAndQueue(userId, feelingId) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, PENDING_STORE], "readwrite");
    const feelings = tx.objectStore(STORE_NAME);
    const pending = tx.objectStore(PENDING_STORE);
    const previousRequest = pending.get(feelingId);

    feelings.delete(feelingId);

    previousRequest.onsuccess = () => {
      const previous = previousRequest.result;

      pending.put({
        feelingId,
        type: "delete",
        queuedAtMs: previous?.queuedAtMs || Date.now(),
        changeId: createChangeId(),
      });
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not queue the offline delete."));
    };
    tx.onerror = () => {};
  });
}

// Every change still waiting to be sent to Firestore, oldest first
export async function readPendingChanges(userId) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readonly");
    const request = tx.objectStore(PENDING_STORE).getAll();

    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => a.queuedAtMs - b.queuedAtMs));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => db.close();
  });
}

// Remove a change only if it is still the version we just synced,
// so an edit made while syncing is not lost.
export async function removeSyncedChange(userId, feelingId, changeId) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    const request = store.get(feelingId);

    request.onsuccess = () => {
      if (request.result?.changeId === changeId) store.delete(feelingId);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not remove the synced change."));
    };
    tx.onerror = () => {};
  });
}

// Combine Firestore data with this device's data and unsent changes.
export async function mergeServerFeelings(
  userId,
  serverFeelings,
  possiblyIncomplete,
) {
  const db = await openDatabase(userId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, PENDING_STORE], "readwrite");
    const feelings = tx.objectStore(STORE_NAME);
    const pending = tx.objectStore(PENDING_STORE);
    let merged = [];

    const localRequest = feelings.getAll();
    localRequest.onsuccess = () => {
      const pendingRequest = pending.getAll();

      pendingRequest.onsuccess = () => {
        const byId = new Map(serverFeelings.map((item) => [item.id, item]));

        if (possiblyIncomplete) {
          localRequest.result.forEach((item) => {
            if (!byId.has(item.id)) byId.set(item.id, item);
          });
        }

        // Unsent local changes win over what the server says
        pendingRequest.result.forEach((change) => {
          if (change.type === "delete") byId.delete(change.feelingId);
          else byId.set(change.feelingId, change.data);
        });

        merged = newestFirst([...byId.values()]);
        feelings.clear();
        merged.forEach((item) => feelings.put(item));
      };
    };

    tx.oncomplete = () => {
      db.close();
      resolve(merged);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Could not merge the feelings."));
    };
    tx.onerror = () => {};
  });
}
