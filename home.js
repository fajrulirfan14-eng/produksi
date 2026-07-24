
function formatRupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

async function fetchCabangInfo(idCabang) {
  if (!idCabang) return null;

  const cacheKey = `cabang_${idCabang}`;
  try {
    const snap = await window.getDoc(window.doc(window.db, "kantorCabang", idCabang));
    if (snap.exists()) {
      const data = snap.data();
      window._ramCache[cacheKey] = data;
      return data;
    }
    return null;
  } catch (err) {
    console.error("❌ fetchCabangInfo:", err);
    // fallback ke cache RAM kalau fetch gagal (misal koneksi putus di tengah sesi)
    return window._ramCache[cacheKey] || null;
  }
}
window.fetchCabangInfo = fetchCabangInfo;

function getLoyangFieldKeyHome(jenis) {
  return jenis === "Original" ? "jumlahLoyang" : `jumlahLoyang${jenis}`;
}

async function fetchLaporanTerakhir(adminUid, uidKoki, loyangList, hargaMap) {
  try {
    const q = window.query(
      window.collection(window.db, "users", adminUid, "stockOpname"),
      window.where("uidKoki", "==", uidKoki),
      window.orderBy("tanggal", "desc"),
      window.limit(1)
    );
    const snap = await window.getDocs(q);

    if (snap.empty) {
      return { rows: [], total: 0, tanggal: null };
    }

    const docSnap = snap.docs[0];
    const existing = docSnap.data();
    const tanggal = docSnap.id;

    let total = 0;
    const rows = loyangList.map((jenis) => {
      const qty = Number(existing[getLoyangFieldKeyHome(jenis)]) || 0;
      const harga = hargaMap[jenis] || 0;
      total += qty * harga;
      return { jenis, qty };
    }).filter((r) => r.qty > 0);

    return { rows, total, tanggal };
  } catch (err) {
    console.error("❌ fetchLaporanTerakhir:", err);
    return { rows: [], total: 0, tanggal: null };
  }
}

function formatTanggalLaporanHome(tanggalStr) {
  const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [y, m, d] = tanggalStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${hariNama[dateObj.getDay()]}, ${d} ${bulanNama[m - 1]} ${y}`;
}
function formatTanggalPurchaseHome(tanggalStr) {
  const bulanNama = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const [y, m, d] = tanggalStr.split("-").map(Number);
  return `${d} ${bulanNama[m - 1]} ${y}`;
}

async function fetchPurchaseByTanggal(adminUid, tanggalStr) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "purchase", tanggalStr));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error("❌ fetchPurchaseByTanggal:", err);
    return null;
  }
}

function renderPurchaseCard(data, varianKodeList) {
  const listEl = document.getElementById("homePurchaseList");
  const totalBlockEl = document.getElementById("homePurchaseTotalBlock");
  const totalGridEl = document.getElementById("homePurchaseTotalGrid");
  if (!listEl) return;

  const staffMap = data?.staff || {};
  const staffEntries = Object.entries(staffMap);

  if (!staffEntries.length) {
    listEl.innerHTML = '<div class="home-purchase-empty">Belum ada purchase order</div>';
    if (totalBlockEl) totalBlockEl.style.display = "none";
    const catatanBlockEl = document.getElementById("homePurchaseCatatanBlock");
    if (catatanBlockEl) catatanBlockEl.style.display = "none";
    return;
  }

  const totalPerVarian = {};
  varianKodeList.forEach((kode) => { totalPerVarian[kode] = 0; });

  listEl.innerHTML = staffEntries.map(([uid, info]) => {
    const varianGridHtml = varianKodeList.map((kode) => {
      const qty = Number(info.varian?.[kode]) || 0;
      totalPerVarian[kode] += qty;
      return `
        <div class="home-purchase-varian-item">
          <div class="home-purchase-varian-kode">${kode}</div>
          <div class="home-purchase-varian-qty">${qty}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="home-purchase-staff-block">
        <div class="home-purchase-staff-nama">${info.nama || "Tanpa Nama"}</div>
        <div class="home-purchase-varian-grid">
          ${varianGridHtml}
        </div>
      </div>
    `;
  }).join("");

  if (totalGridEl) {
    totalGridEl.innerHTML = varianKodeList.map((kode) => `
      <div class="home-purchase-varian-item home-purchase-varian-item-total">
        <div class="home-purchase-varian-kode">${kode}</div>
        <div class="home-purchase-varian-qty">${totalPerVarian[kode]}</div>
      </div>
    `).join("");
  }
  if (totalBlockEl) totalBlockEl.style.display = "block";

  const catatanBlockEl = document.getElementById("homePurchaseCatatanBlock");
  const catatanTextEl = document.getElementById("homePurchaseCatatanText");
  const catatan = (data?.catatan || "").trim();
  if (catatanBlockEl) catatanBlockEl.style.display = catatan ? "block" : "none";
  if (catatanTextEl) catatanTextEl.textContent = catatan;
}
function renderLaporanHomeCard(rows, total, tanggal) {
  const listEl = document.getElementById("homeLaporanList");
  const totalEl = document.getElementById("homeLaporanTotal");
  const titleEl = document.getElementById("homeLaporanTitle");
  if (!listEl || !totalEl) return;

  totalEl.style.visibility = "visible";
  if (titleEl) {
    titleEl.innerHTML = tanggal
      ? `<i class="fa-solid fa-receipt"></i> Laporan Terakhir — ${formatTanggalLaporanHome(tanggal)}`
      : `<i class="fa-solid fa-receipt"></i> Laporan Terakhir`;
  }

  if (!rows.length) {
    listEl.innerHTML = '<div class="home-laporan-empty">Belum ada laporan tercatat</div>';
  } else {
    listEl.innerHTML = rows.map((r) => `
      <div class="home-laporan-row">
        <span class="home-laporan-jenis">Loyang ${r.jenis}</span>
        <span class="home-laporan-qty">${r.qty}</span>
      </div>
    `).join("");
  }

  totalEl.textContent = formatRupiah(total);
}

/* ── ESTIMASI LOYANG (read only, di card Purchase Order) ── */
async function hitungSaldoUntukTanggalProduksi(adminUid, tanggalTarget, varianKodeList) {
  try {
    if (!adminUid || !tanggalTarget) return {};
    const [tahunT, bulanT, hariT] = tanggalTarget.split("-").map(Number);

    let saldoAwalMap = {};
    try {
      const prevBulanDate = new Date(tahunT, bulanT - 2, 1);
      const prevBulanKey  = `${prevBulanDate.getFullYear()}-${String(prevBulanDate.getMonth()+1).padStart(2,"0")}`;
      const saldoSnap = await window.getDoc(
        window.doc(window.db, "users", adminUid, "saldoBulanKemarin", prevBulanKey)
      );
      saldoAwalMap = saldoSnap.exists() ? (saldoSnap.data()?.saldo || {}) : {};
    } catch (err) {
      console.error("❌ hitungSaldoUntukTanggalProduksi (saldoBulanKemarin):", err);
    }

    const promises = [];
    const laporanPromises = [];
    for (let d = 1; d <= hariT; d++) {
      const tglStr = `${tahunT}-${String(bulanT).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      promises.push(
        window.getDoc(window.doc(window.db, "users", adminUid, "stockOpname", tglStr))
          .then(snap => snap.exists() ? { id: tglStr, ...snap.data() } : null)
      );
      laporanPromises.push(
        window.getDoc(window.doc(window.db, "users", adminUid, "laporanAdmin", tglStr))
          .then(snap => snap.exists() ? { id: tglStr, ...snap.data() } : null)
      );
    }
    const [results, laporanResults] = await Promise.all([Promise.all(promises), Promise.all(laporanPromises)]);
    const dataByDate = {};
    results.forEach(r => { if (r) dataByDate[r.id] = r; });
    const laporanByDate = {};
    laporanResults.forEach(r => { if (r) laporanByDate[r.id] = r; });

    const LAPORAN_SKIP_KEYS = new Set(["tanggal", "createdBy"]);
    function aggregateLaporanLokal(laporanDoc) {
      const agg = { output: {}, fee: {}, offFlavor: {} };
      if (!laporanDoc) return agg;
      Object.keys(laporanDoc).forEach(key => {
        if (LAPORAN_SKIP_KEYS.has(key)) return;
        const entry = laporanDoc[key];
        if (!entry || typeof entry !== "object") return;
        const closing = entry.pembayaran?.closing || {};
        Object.entries(closing).forEach(([varian, qty]) => {
          agg.output[varian] = (agg.output[varian] || 0) + (Number(qty) || 0);
        });
        Object.entries(entry.fee || {}).forEach(([varian, qty]) => {
          agg.fee[varian] = (agg.fee[varian] || 0) + (Number(qty) || 0);
        });
        Object.entries(entry.offFlavor || {}).forEach(([varian, qty]) => {
          agg.offFlavor[varian] = (agg.offFlavor[varian] || 0) + (Number(qty) || 0);
        });
      });
      return agg;
    }

    let prevSaldo = { ...saldoAwalMap };
    for (let d = 1; d <= hariT; d++) {
      const tglStr = `${tahunT}-${String(bulanT).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const existing   = dataByDate[tglStr] || {};
      const laporanAgg = aggregateLaporanLokal(laporanByDate[tglStr]);

      const rowSaldo = {};
      varianKodeList.forEach(v => {
        const prev  = Number(prevSaldo[v] || 0);
        const masuk = Number(existing.produksi?.[v] || 0);
        const keluar =
          Number(laporanAgg.output[v]       || 0) +
          Number(laporanAgg.fee[v]          || 0) +
          Number(existing.reject?.[v]       || 0) +
          Number(existing.rusakFreezer?.[v] || 0) +
          Number(existing.basiFreezer?.[v]  || 0) +
          Number(existing.promosi?.[v]      || 0) +
          Number(laporanAgg.offFlavor[v]    || 0) +
          Number(existing.barangHilang?.[v] || 0);
        rowSaldo[v] = prev + masuk - keluar;
      });
      prevSaldo = rowSaldo;
    }
    return prevSaldo;
  } catch (err) {
    console.error("❌ hitungSaldoUntukTanggalProduksi:", err);
    return {};
  }
}

function hitungTotalVarianDariPurchase(data, varianKodeList) {
  const total = {};
  varianKodeList.forEach(k => { total[k] = 0; });
  const staffMap = data?.staff || {};
  Object.values(staffMap).forEach(info => {
    varianKodeList.forEach(k => {
      total[k] += Number(info.varian?.[k]) || 0;
    });
  });
  return total;
}

function renderSaldoBarangCard(saldoMap, varianKodeList) {
  const cardEl = document.getElementById("homeSaldoBarangCard");
  if (!cardEl) return;
  if (!varianKodeList.length) {
    cardEl.innerHTML = '<div class="home-purchase-empty">Varian belum tersedia.</div>';
    return;
  }
  cardEl.innerHTML = `
    <div class="home-purchase-staff-block">
      <div class="home-purchase-varian-grid">
        ${varianKodeList.map(kode => `
          <div class="home-purchase-varian-item">
            <div class="home-purchase-varian-kode">${kode}</div>
            <div class="home-purchase-varian-qty">${Number(saldoMap[kode] || 0)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderEstimasiLoyangCard(rows) {
  const cardEl = document.getElementById("homeEstimasiLoyangCard");
  if (!cardEl) return;
  if (!rows.length) {
    cardEl.innerHTML = '<div class="home-purchase-empty">Estimasi loyang belum diset di Kantor Cabang.</div>';
    return;
  }
  cardEl.innerHTML = `
    <div class="home-purchase-staff-block">
      <div class="home-purchase-varian-grid">
        ${rows.map(r => `
          <div class="home-purchase-varian-item">
            <div class="home-purchase-varian-kode">${r.label}</div>
            <div class="home-purchase-varian-qty">${r.jumlahLoyang}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

window.initHomeView = async function () {
  const user = window.currentUser;
  const root = document.getElementById("home-root");
  if (!root) return;

  const nama = user?.nama || user?.email?.split("@")[0] || "User";

  const avatarContent = user?.fotoURL
    ? `<img src="${user.fotoURL}" class="home-avatar-img" alt="${nama}">`
    : initials(nama);

  root.innerHTML = `
    <div class="headerHome" id="headerHome">
      <div class="home-top-row">
        <div class="home-avatar" id="homeAvatar">${avatarContent}</div>
        <div class="home-greeting">
          <div class="home-nama">${nama}</div>
          <div class="home-kantor" id="homeKantor">Memuat kantor cabang...</div>
        </div>
        <button class="home-notif-btn" id="homeNotifBtn">
          <i class="fa-solid fa-bell"></i>
        </button>
      </div>

      <div class="home-laporan-card" id="homeLaporanCard">
        <div class="home-laporan-title" id="homeLaporanTitle"><i class="fa-solid fa-receipt"></i> Laporan Terakhir</div>
        <div class="home-laporan-list" id="homeLaporanList"></div>
        <div class="home-laporan-total" id="homeLaporanTotal" style="visibility:hidden">Rp 0</div>
      </div>
    </div>

    <div class="home-purchase-card" id="homePurchaseCard">
      <div class="home-purchase-header">
        <div class="home-purchase-title"><i class="fa-solid fa-cart-shopping"></i> Purchase Order</div>
        <button class="menu-btn" onclick="showView('input')">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="menu-btn" onclick="showView('riwayat')">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </button>
        <div class="home-purchase-filter">
          <button class="home-purchase-filter-btn" id="homePurchaseDateBtn">
            <i class="fa-solid fa-calendar-days"></i>
            <span id="homePurchaseDateLabel">Hari Ini</span>
          </button>
          <input type="date" id="homePurchaseDateNative" class="home-purchase-date-native">
        </div>
      </div>
      <div class="home-purchase-subtitle" id="homePurchaseSubtitle"></div>
      <div class="home-purchase-list" id="homePurchaseList"></div>
      <div class="home-purchase-total-block" id="homePurchaseTotalBlock" style="display:none">
        <div class="home-purchase-total-title">Total</div>
        <div class="home-purchase-varian-grid" id="homePurchaseTotalGrid"></div>
      </div>
      <div class="home-purchase-catatan-block" id="homePurchaseCatatanBlock" style="display:none">
        <div class="home-purchase-catatan-title">Catatan</div>
        <div class="home-purchase-catatan-text" id="homePurchaseCatatanText"></div>
      </div>
      <div class="home-purchase-total-block" id="homeSaldoBlock">
        <div class="home-purchase-total-title">
          Saldo Barang Hari Ini <span class="home-readonly-badge">Read Only</span>
        </div>
        <div id="homeSaldoBarangCard" class="home-purchase-list">
          <div class="home-purchase-empty">Memuat...</div>
        </div>
      </div>
      <div class="home-purchase-total-block" id="homeEstimasiBlock">
        <div class="home-purchase-total-title">
          Estimasi Loyang <span class="home-readonly-badge">Read Only</span>
        </div>
        <div id="homeEstimasiLoyangCard" class="home-purchase-list">
          <div class="home-purchase-empty">Memuat...</div>
        </div>
      </div>
    </div>
  `;

  // Tanggal + jam realtime
  const hariNama  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulanNama = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  function updateDateTime() {
    const now = new Date();
    const el = document.getElementById("homeTanggal");
    if (el) el.innerText = `${hariNama[now.getDay()]}, ${now.getDate()} ${bulanNama[now.getMonth()]} ${now.getFullYear()}`;
  }
  updateDateTime();
  if (window.homeClock) clearInterval(window.homeClock);
  window.homeClock = setInterval(updateDateTime, 60000);

  document.getElementById("homeNotifBtn")?.addEventListener("click", () => {
    // TODO: buka panel/halaman notifikasi
  });

  // Foto sampul (kalau ada, disimpan di profil nanti)
  const savedCover = localStorage.getItem("ttn_cover_photo");
  const headerEl = document.getElementById("headerHome");
  if (headerEl) {
    if (savedCover) {
      headerEl.style.backgroundImage = `url(${savedCover})`;
      headerEl.classList.add("has-cover");
    } else {
      headerEl.style.backgroundImage = "";
      headerEl.classList.remove("has-cover");
    }
  }
  // Info kantor cabang — fresh-first Firestore, fallback RAM cache
  const cabangData = await fetchCabangInfo(user?.idCabang);
  const kantorEl = document.getElementById("homeKantor");
  if (kantorEl) {
    kantorEl.textContent = cabangData?.namaCabang || cabangData?.nama || "Kantor cabang tidak ditemukan";
  }

  // Laporan hari ini (loyang qty + total nominal), sesuai tanggal device
  const adminUid = await resolveAdminUid(user?.idCabang);
  const loyangArr = cabangData?.loyang || [];
  const loyangActive = loyangArr.filter((item) => item?.status === true);
  const loyangList = loyangActive.map((item) => item.jenisLoyang).filter(Boolean);
  const hargaMap = {};
  loyangActive.forEach((item) => {
    if (item.jenisLoyang) hargaMap[item.jenisLoyang] = Number(item.upah) || 0;
  });

  if (adminUid && user?.uid) {
    const { rows, total, tanggal } = await fetchLaporanTerakhir(
      adminUid, user.uid, loyangList.length ? loyangList : ["Original"], hargaMap
    );
    renderLaporanHomeCard(rows, total, tanggal);
  } else {
    renderLaporanHomeCard([], 0, null);
  }

  // Purchase Order — default hari ini, bisa difilter tanggal lain
  const varianKodeList = Object.keys(cabangData?.varian || {}).sort();
  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  const dateBtnEl = document.getElementById("homePurchaseDateBtn");
  const dateLabelEl = document.getElementById("homePurchaseDateLabel");
  const dateNativeEl = document.getElementById("homePurchaseDateNative");
  if (dateNativeEl) dateNativeEl.value = todayStr;

  async function loadPurchaseForDate(tglStr) {
    if (dateLabelEl) {
      dateLabelEl.textContent = tglStr === todayStr ? "Hari Ini" : formatTanggalPurchaseHome(tglStr);
    }
    const subtitleEl = document.getElementById("homePurchaseSubtitle");
    if (subtitleEl) subtitleEl.textContent = `Stock untuk hari: ${formatTanggalLaporanHome(tglStr)}`;
    if (!adminUid) {
      renderPurchaseCard(null, varianKodeList);
      return;
    }
    const data = await fetchPurchaseByTanggal(adminUid, tglStr);
    renderPurchaseCard(data, varianKodeList);

    // Estimasi Loyang (read only) — total input purchase dikurangi saldo di tanggal target
    const estimasiConfig = cabangData?.estimasi || {};
    if (!Object.keys(estimasiConfig).length) {
      renderEstimasiLoyangCard([]);
    } else {
      const estimasiCardEl = document.getElementById("homeEstimasiLoyangCard");
      if (estimasiCardEl) estimasiCardEl.innerHTML = '<div class="home-purchase-empty">Menghitung...</div>';
      const totalVarian = hitungTotalVarianDariPurchase(data, varianKodeList);
      const saldoMap = adminUid ? await hitungSaldoUntukTanggalProduksi(adminUid, todayStr, varianKodeList) : {};
      renderSaldoBarangCard(saldoMap, varianKodeList);
      const rows = Object.keys(estimasiConfig).map(groupKey => {
        const capacityMap = estimasiConfig[groupKey] || {};
        let fraksiTotal = 0;
        Object.entries(capacityMap).forEach(([kode, kapasitas]) => {
          const kap = Number(kapasitas) || 0;
          if (kap <= 0) return;
          const input     = Number(totalVarian[kode] || 0);
          const saldo     = Number(saldoMap[kode]    || 0);
          const kebutuhan = Math.max(0, input - saldo);
          fraksiTotal += kebutuhan / kap;
        });
        const jumlahLoyang = fraksiTotal > 0 ? Math.ceil(fraksiTotal) : 0;
        return { label: groupKey.replace(/^loyang/i, "") || groupKey, jumlahLoyang };
      });
      renderEstimasiLoyangCard(rows);
    }
  }
  dateNativeEl?.addEventListener("change", () => {
    if (dateNativeEl.value) loadPurchaseForDate(dateNativeEl.value);
  });

  await loadPurchaseForDate(todayStr);
};
