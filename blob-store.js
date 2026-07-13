const MAX_TOTAL_BLOB_BYTES = 100 * 1024 * 1024;

globalThis.AtlasBlobStore = Object.freeze({
  async put(record) {
    if (!record?.key || !(record.blob instanceof Blob)) {
      throw new Error("Invalid blob record.");
    }
    const database = await openDatabase();
    try {
      await putWithBudget(database, {
        ...record,
        size: record.blob.size,
        mime: record.blob.type || record.mime || "application/octet-stream",
        createdAt: record.createdAt || new Date().toISOString()
      });
    } finally {
      database.close();
    }
  },

  async get(key) {
    const database = await openDatabase();
    try {
      const record = await runRequest(
        database.transaction("blobs", "readonly").objectStore("blobs").get(key)
      );
      return record || null;
    } finally {
      database.close();
    }
  },

  async delete(key) {
    if (!key) return;
    const database = await openDatabase();
    try {
      await runWriteTransaction(database, (store) => store.delete(key));
    } finally {
      database.close();
    }
  },

  async clear() {
    const database = await openDatabase();
    try {
      await runWriteTransaction(database, (store) => store.clear());
    } finally {
      database.close();
    }
  },

  async prune(keepKeys) {
    const keep = new Set(Array.isArray(keepKeys) ? keepKeys : []);
    const database = await openDatabase();
    let keys;
    try {
      keys = await runRequest(
        database.transaction("blobs", "readonly").objectStore("blobs").getAllKeys()
      );
    } finally {
      database.close();
    }
    await Promise.all(
      keys.filter((key) => !keep.has(key)).map((key) => this.delete(key))
    );
  }
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("atlas-sidebar", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("blobs")) {
        database.createObjectStore("blobs", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Blob database failed."));
  });
}

function runRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Blob operation failed."));
  });
}

function runWriteTransaction(database, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("blobs", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error || new Error("Blob transaction was aborted."));
    transaction.onerror = () =>
      reject(transaction.error || new Error("Blob transaction failed."));
    operation(transaction.objectStore("blobs"));
  });
}

function putWithBudget(database, record) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("blobs", "readwrite");
    const store = transaction.objectStore("blobs");
    let explicitError = null;

    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        explicitError || transaction.error || new Error("Blob transaction was aborted.")
      );
    transaction.onerror = () =>
      reject(explicitError || transaction.error || new Error("Blob transaction failed."));

    const request = store.getAll();
    request.onerror = () => {
      explicitError = request.error || new Error("Unable to inspect Blob quota.");
      transaction.abort();
    };
    request.onsuccess = () => {
      const existingBytes = request.result
        .filter((candidate) => candidate.key !== record.key)
        .reduce((total, candidate) => total + (Number(candidate.size) || 0), 0);
      if (existingBytes + record.size > MAX_TOTAL_BLOB_BYTES) {
        explicitError = new Error("临时文件总量超过 100 MB，请先清理部分素材。");
        transaction.abort();
        return;
      }
      store.put(record);
    };
  });
}
