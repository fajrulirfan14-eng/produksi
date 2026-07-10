// indexdb.js — IndexedDB khusus buat cache data role produksi.
// Database: "produksiDB", object store: "cabang" (keyPath: "idCabang").
// Dipakai oleh home.js buat cache data kantorCabang.

window.openProduksiDB = function () {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("produksiDB", 1);
    request.onupgradeneeded = function (event) {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains("cabang")) {
        idb.createObjectStore("cabang", { keyPath: "idCabang" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Baca cache cabang dari IndexedDB. Return null kalau belum ada.
window.getCabangFromIDB = async function (idCabang) {
  if (!idCabang) return null;
  const idb = await window.openProduksiDB();
  return new Promise((resolve) => {
    const tx  = idb.transaction("cabang", "readonly");
    const req = tx.objectStore("cabang").get(idCabang);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => resolve(null);
  });
};

// Simpan / overwrite cache cabang ke IndexedDB.
window.saveCabangToIDB = async function (idCabang, data) {
  if (!idCabang) return false;
  const idb = await window.openProduksiDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("cabang", "readwrite");
    tx.objectStore("cabang").put({
      idCabang,
      data,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
};
