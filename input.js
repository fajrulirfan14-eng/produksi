
async function resolveAdminUid(idCabang) {
  if (!idCabang) return null;
  try {
    const q = window.query(
      window.collection(window.db, "users"),
      window.where("idCabang", "==", idCabang),
      window.where("role", "==", "adminCabang")
    );
    const snap = await window.getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (err) {
    console.error("❌ resolveAdminUid:", err);
    return null;
  }
}

async function saveEntryOnline(adminUid, tanggal, payload) {
  const ref = window.doc(window.db, "users", adminUid, "stockOpname", tanggal);
  await window.setDoc(ref, {
    ...payload,
    createdBy: adminUid,
    tanggal,
    uidKoki: window.currentUser?.uid || "",
    koki: window.currentUser?.nama || "",
    updatedAt: window.serverTimestamp(),
  }, { merge: true });
}

function showInputStatus(el, type, msg) {
  el.textContent = msg;
  el.className = `input-status ${type}`;
}

function hideInputStatus(el) {
  el.textContent = "";
  el.className = "input-status";
}
function showConfirmModal(pesan) {
  return new Promise((resolve) => {
    const overlay  = document.getElementById("input-confirm-overlay");
    const textEl   = document.getElementById("input-confirm-text");
    const btnOk    = document.getElementById("input-confirm-ok");
    const btnCancel = document.getElementById("input-confirm-cancel");

    textEl.textContent = pesan;
    overlay.classList.add("show");

    function cleanup(result) {
      overlay.classList.remove("show");
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    btnOk.addEventListener("click", onOk);
    btnCancel.addEventListener("click", onCancel);
  });
}

const HARI_NAMA  = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function formatTanggalIndo(dateObj) {
  return `${HARI_NAMA[dateObj.getDay()]}, ${dateObj.getDate()} ${BULAN_NAMA[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

function renderVarianGrid(container, varian, prefix) {
  const entries = Object.entries(varian || {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Varian belum tersedia. Buka Home dulu buat sinkron data cabang.</div>';
    return;
  }
  container.innerHTML = entries.map(([kode, nama]) => `
    <div class="varian-item" title="${nama}">
      <input type="number" min="0" inputmode="numeric" class="varian-input" data-prefix="${prefix}" data-kode="${kode}" placeholder="${kode}" />
    </div>
  `).join("");
}

function collectVarianData(prefix) {
  const data = {};
  document.querySelectorAll(`.varian-input[data-prefix="${prefix}"]`).forEach((el) => {
    data[el.dataset.kode] = Number(el.value) || 0;
  });
  return data;
}
function getLoyangFieldKey(jenis) {
  return jenis === "Original" ? "jumlahLoyang" : `jumlahLoyang${jenis}`;
}
function renderLoyangInputs(container, loyangList) {
  if (!loyangList.length) {
    container.innerHTML = '<div class="empty-state">Jenis loyang belum tersedia.</div>';
    return;
  }
  container.classList.add("loyang-grid");
  container.innerHTML = loyangList.map((jenis) => {
    const fieldKey = getLoyangFieldKey(jenis);
    return `
      <div class="loyang-field">
        <label for="input-${fieldKey}">Loyang ${jenis}</label>
        <input id="input-${fieldKey}" type="number" min="0" inputmode="numeric" data-loyang-jenis="${jenis}" placeholder="0" />
      </div>
    `;
  }).join("");
}
function collectLoyangData(loyangList) {
  const data = {};
  loyangList.forEach((jenis) => {
    const fieldKey = getLoyangFieldKey(jenis);
    const el = document.getElementById(`input-${fieldKey}`);
    data[fieldKey] = Number(el?.value) || 0;
  });
  return data;
}

window.initInputView = async function () {
  const root = document.getElementById("input-root");
  if (!root) return;

  root.innerHTML = `
    <div class="input-topbar">
      <button class="input-topbar__back" onclick="showView('home')">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="input-topbar__title">Input Produksi</div>
    </div>
    <div class="input-confirm-overlay" id="input-confirm-overlay">
      <div class="input-confirm-box">
        <div class="input-confirm-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="input-confirm-title">Ubah Data Tersimpan?</div>
        <div class="input-confirm-text" id="input-confirm-text">Tanggal ini sudah punya data tersimpan. Yakin ingin mengubahnya?</div>
        <div class="input-confirm-actions">
          <button type="button" class="input-confirm-btn cancel" id="input-confirm-cancel">Batal</button>
          <button type="button" class="input-confirm-btn ok" id="input-confirm-ok">Ya, Ubah</button>
        </div>
      </div>
    </div>

    <div class="input-body">
      <form id="input-form" class="card input-form">
        <label for="input-tanggal">Tanggal</label>
        <div class="input-date-field">
          <div class="input-date-display">
            <span id="inputTanggalText">-</span>
            <i class="fa-solid fa-calendar-days"></i>
          </div>
          <input type="date" id="input-tanggal" class="input-date-native" required />
        </div>

        <div id="loyang-inputs"><div class="spinner"></div></div>

        <label for="input-tanggal-expired">Tanggal Expired</label>
        <input id="input-tanggal-expired" type="text" class="input-expired-display" readonly value="-" />

        <div class="section-title" style="margin-top:16px;">Produksi</div>
        <div id="produksi-grid" class="varian-grid"><div class="spinner"></div></div>

        <div class="section-title" style="margin-top:16px;">Rejected</div>
        <div id="rejected-grid" class="varian-grid"><div class="spinner"></div></div>

        <div id="input-lock-msg" class="input-lock-msg" style="display:none"></div>
        <button type="submit" class="btn-primary" id="input-submit">Simpan</button>
        <div id="input-status" class="input-status"></div>
      </form>
    </div>
  `;

  const formEl       = document.getElementById("input-form");
  const submitBtn    = document.getElementById("input-submit");
  const statusEl     = document.getElementById("input-status");
  const tanggalInput = document.getElementById("input-tanggal");
  const tanggalText  = document.getElementById("inputTanggalText");

  const today = new Date();
  tanggalInput.value = today.toISOString().slice(0, 10);
  tanggalText.textContent = formatTanggalIndo(today);
  tanggalInput.onchange = async () => {
    if (!tanggalInput.value) return;
    hideInputStatus(statusEl);
    const [y, m, d] = tanggalInput.value.split("-").map(Number);
    tanggalText.textContent = formatTanggalIndo(new Date(y, m - 1, d));
    await loadPreviewForDate(tanggalInput.value);
  };

  const idCabang = window.currentUser?.idCabang;
  const cabangData = await window.fetchCabangInfo?.(idCabang);
  const varian = cabangData?.varian || {};

  const loyangArr = cabangData?.loyang || [];
  const loyangList = loyangArr
    .filter((item) => item?.status === true)
    .map((item) => item.jenisLoyang)
    .filter(Boolean);

  renderLoyangInputs(document.getElementById("loyang-inputs"), loyangList.length ? loyangList : ["Original"]);
  renderVarianGrid(document.getElementById("produksi-grid"), varian, "produksi");
  renderVarianGrid(document.getElementById("rejected-grid"), varian, "rejected");

  const adminUid = await resolveAdminUid(idCabang);
  const expiredDays = Number(cabangData?.target?.expired) || 0;

  if (!adminUid) {
    showInputStatus(statusEl, "error", "Data admin cabang tidak ditemukan.");
  }

  function hitungTanggalExpired(tanggalStr) {
    const [y, m, d] = tanggalStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + expiredDays);
    return dateObj.toISOString().slice(0, 10);
  }

  function formatTanggalDisplay(tanggalStr) {
    if (!tanggalStr) return "-";
    const [y, m, d] = tanggalStr.split("-").map(Number);
    return formatTanggalIndo(new Date(y, m - 1, d));
  }

  const lockMsgEl = document.getElementById("input-lock-msg");

  function showLoadingOverlay() {
    submitBtn.disabled = true;
    submitBtn.textContent = "Memuat...";
  }

  function hideOverlay() {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan";
  }

  function setFormLocked(locked, pesanLock) {
    submitBtn.disabled = locked;
    formEl.querySelectorAll("input:not(.input-date-native)").forEach((el) => {
      el.disabled = locked;
    });

    if (locked) {
      lockMsgEl.innerHTML = `<i class="fa-solid fa-lock"></i><span>${pesanLock}</span>`;
      lockMsgEl.style.display = "flex";
    } else {
      lockMsgEl.style.display = "none";
      lockMsgEl.innerHTML = "";
    }
  }

  let lastKnownExisting = {};
  let lastKnownHasData = false;

  function hitungHasData(existing) {
    const loyangIsi = (loyangList.length ? loyangList : ["Original"]).some((jenis) => {
      return Number(existing[getLoyangFieldKey(jenis)]) > 0;
    });
    const produksiIsi = Object.values(existing.produksi || {}).some((v) => Number(v) > 0);
    const rejectIsi   = Object.values(existing.reject || {}).some((v) => Number(v) > 0);
    return loyangIsi || produksiIsi || rejectIsi;
  }
  async function loadPreviewForDate(tanggalStr) {
    const expiredEl = document.getElementById("input-tanggal-expired");

    if (!adminUid || !tanggalStr) {
      if (expiredEl) expiredEl.value = "-";
      return;
    }

    showLoadingOverlay();

    try {
      const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tanggalStr));
      const existing = snap.exists() ? snap.data() : {};

      const myUid = window.currentUser?.uid || "";
      const ownerUid = existing.uidKoki || "";
      const sudahAdaKoki = "koki" in existing;
      const isOwnedByOther = sudahAdaKoki && ownerUid !== myUid;

      lastKnownExisting = existing;
      lastKnownHasData = hitungHasData(existing);

      if (isOwnedByOther) {
        setFormLocked(true, `Tanggal ini sudah diisi oleh ${existing.koki || "orang lain"}. Kamu tidak bisa mengubahnya.`);
      } else {
        setFormLocked(false, "");
      }

      // isi ulang input loyang
      (loyangList.length ? loyangList : ["Original"]).forEach((jenis) => {
        const fieldKey = getLoyangFieldKey(jenis);
        const el = document.getElementById(`input-${fieldKey}`);
        if (el) el.value = existing[fieldKey] || "";
      });

      // isi ulang grid produksi & reject
      document.querySelectorAll('.varian-input[data-prefix="produksi"]').forEach((inp) => {
        inp.value = existing.produksi?.[inp.dataset.kode] || "";
      });
      document.querySelectorAll('.varian-input[data-prefix="rejected"]').forEach((inp) => {
        inp.value = existing.reject?.[inp.dataset.kode] || "";
      });

      // tanggal expired — pakai yang tersimpan kalau ada, kalau tidak hitung otomatis
      if (expiredEl) {
        expiredEl.value = existing.tanggalExpired
          ? formatTanggalDisplay(existing.tanggalExpired)
          : formatTanggalDisplay(hitungTanggalExpired(tanggalStr));
      }

      if (!isOwnedByOther) hideOverlay();
    } catch (err) {
      console.error("❌ loadPreviewForDate:", err);
      if (expiredEl) expiredEl.value = formatTanggalDisplay(hitungTanggalExpired(tanggalStr));
      hideOverlay();
    }
  }

  await loadPreviewForDate(tanggalInput.value);

  formEl.onsubmit = async (e) => {
    e.preventDefault();

    if (!adminUid) {
      showInputStatus(statusEl, "error", "Data admin cabang tidak ditemukan, coba muat ulang halaman.");
      return;
    }

    if (submitBtn.disabled) {
      return; // form sedang terkunci, bukan hak koki ini untuk mengubah
    }

    const tanggal = tanggalInput.value;

    // re-check kepemilikan fresh langsung ke Firestore, untuk mengurangi risiko
    // race condition kalau ada koki lain yang submit lebih dulu selagi form ini terbuka
    submitBtn.disabled = true;
    submitBtn.textContent = "Memeriksa...";
    let freshExisting = {};
    try {
      const freshSnap = await window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tanggal));
      freshExisting = freshSnap.exists() ? freshSnap.data() : {};
    } catch (err) {
      console.error("❌ re-check sebelum submit:", err);
      showInputStatus(statusEl, "error", "Gagal memeriksa data terbaru, coba lagi.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Simpan";
      return;
    }

    const myUid = window.currentUser?.uid || "";
    const freshOwnerUid = freshExisting.uidKoki || "";
    const freshSudahAdaKoki = "koki" in freshExisting;
    const freshIsOwnedByOther = freshSudahAdaKoki && freshOwnerUid !== myUid;

    if (freshIsOwnedByOther) {
      setFormLocked(true, `Tanggal ini baru saja diisi oleh ${freshExisting.koki || "orang lain"}. Kamu tidak bisa mengubahnya.`);
      showInputStatus(statusEl, "error", "Data sudah diisi orang lain, form dikunci.");
      submitBtn.textContent = "Simpan";
      await loadPreviewForDate(tanggal);
      return;
    }

    // konfirmasi kalau ini mengubah data yang sudah ada isinya (bukan input baru)
    const hasDataNow = hitungHasData(freshExisting);
    if (hasDataNow) {
      const konfirmasi = await showConfirmModal(
        "Tanggal ini sudah punya data tersimpan. Yakin ingin mengubahnya?"
      );
      if (!konfirmasi) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Simpan";
        return;
      }
    }

    const loyangData = collectLoyangData(loyangList.length ? loyangList : ["Original"]);
    const produksi = collectVarianData("produksi");
    const rejected = collectVarianData("rejected");
    const tanggalExpired = hitungTanggalExpired(tanggal);

    const payload = {
      ...loyangData,
      produksi,
      reject: rejected,
      tanggalExpired,
    };

    submitBtn.textContent = "Menyimpan...";
    try {
      await saveEntryOnline(adminUid, tanggal, payload);
      showInputStatus(statusEl, "success", "Data berhasil disimpan.");
      await loadPreviewForDate(tanggal);
    } catch (err) {
      console.error("❌ saveEntryOnline:", err);
      showInputStatus(statusEl, "error", "Gagal menyimpan data.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Simpan";
    }
  };
};