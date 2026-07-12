
const LAPORAN_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const LAPORAN_HARI_NAMA  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function formatRupiahLaporan(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function formatTanggalLaporan(tanggalStr) {
  const [y, m, d] = tanggalStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${LAPORAN_HARI_NAMA[dateObj.getDay()]}, ${d} ${LAPORAN_BULAN_NAMA[m - 1]} ${y}`;
}

function getLaporanFieldKey(jenis) {
  return jenis === "Original" ? "jumlahLoyang" : `jumlahLoyang${jenis}`;
}

async function fetchLaporanBulan(adminUid, uidKoki, start, end) {
  try {
    const q = window.query(
      window.collection(window.db, "users", adminUid, "stockOpname"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    );
    const snap = await window.getDocs(q);

    return snap.docs
      .map((d) => ({ tanggal: d.id, ...d.data() }))
      .filter((r) => r.uidKoki === uidKoki);
  } catch (err) {
    console.error("❌ fetchLaporanBulan:", err);
    return [];
  }
}

async function fetchKasbonBulan(adminUid, uidKoki, start, end) {
  const kasbonPerTanggal = {};
  let totalKasbonBulan = 0;

  try {
    const q = window.query(
      window.collection(window.db, "users", adminUid, "pengeluaran"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    );
    const snap = await window.getDocs(q);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const kasbonArr = data.kasbonProduksi || [];
      const milikSendiri = kasbonArr.filter((item) => item.uid === uidKoki);
      if (!milikSendiri.length) return;

      const totalTanggal = milikSendiri.reduce((a, item) => a + (Number(item.nominal) || 0), 0);
      kasbonPerTanggal[docSnap.id] = totalTanggal;
      totalKasbonBulan += totalTanggal;
    });
  } catch (err) {
    console.error("❌ fetchKasbonBulan:", err);
  }

  return { kasbonPerTanggal, totalKasbonBulan };
}

async function fetchVarianBulan(adminUid, uidKoki, start, end) {
  const varianPerTanggal = {};
  try {
    const q = window.query(
      window.collection(window.db, "users", adminUid, "purchase"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    );
    const snap = await window.getDocs(q);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const info = (data.staff || {})[uidKoki];
      if (!info || !info.varian) return;
      varianPerTanggal[docSnap.id] = info.varian;
    });
  } catch (err) {
    console.error("❌ fetchVarianBulan:", err);
  }
  return varianPerTanggal;
}

function renderLaporanList(container, entries, hargaMap, loyangList, kasbonPerTanggal, totalKasbonBulan, varianPerTanggal, varianKodeList) {
  const entryByTanggal = {};
  entries.forEach((e) => { entryByTanggal[e.tanggal] = e; });

  const semuaTanggal = Array.from(new Set([
    ...entries.map((e) => e.tanggal),
    ...Object.keys(kasbonPerTanggal || {}),
  ])).sort((a, b) => b.localeCompare(a));

  // ── Total per jenis loyang (akumulasi sebulan) ──
  const totalPerLoyang = {};
  loyangList.forEach((jenis) => { totalPerLoyang[jenis] = 0; });
  entries.forEach((e) => {
    loyangList.forEach((jenis) => {
      totalPerLoyang[jenis] += Number(e[getLaporanFieldKey(jenis)]) || 0;
    });
  });

  // ── Total per varian (akumulasi sebulan) ──
  const totalPerVarian = {};
  (varianKodeList || []).forEach((kode) => { totalPerVarian[kode] = 0; });
  Object.values(varianPerTanggal || {}).forEach((dayVarian) => {
    (varianKodeList || []).forEach((kode) => {
      totalPerVarian[kode] += Number(dayVarian[kode]) || 0;
    });
  });

  // ── Render breakdown loyang di card ──
  const loyangBreakdownEl = document.getElementById("laporan-total-loyang-breakdown");
  if (loyangBreakdownEl) {
    const rows = loyangList
      .map((jenis) => ({ jenis, qty: totalPerLoyang[jenis], nominal: totalPerLoyang[jenis] * (hargaMap[jenis] || 0) }))
      .filter((r) => r.qty > 0);
    loyangBreakdownEl.innerHTML = rows.length
      ? `<div class="laporan-total-section-title">Total Loyang</div>` +
        rows.map((r) => `
          <div class="laporan-total-row">
            <span class="laporan-total-row-label">${r.jenis} (${r.qty})</span>
            <span class="laporan-total-row-value">${formatRupiahLaporan(r.nominal)}</span>
          </div>
        `).join("")
      : "";
  }

  // ── Render breakdown varian di card ──
  const varianBreakdownEl = document.getElementById("laporan-total-varian-breakdown");
  if (varianBreakdownEl) {
    const rows = (varianKodeList || [])
      .map((kode) => ({ kode, qty: totalPerVarian[kode] }))
      .filter((r) => r.qty > 0);
    varianBreakdownEl.innerHTML = rows.length
      ? `<div class="laporan-total-section-title">Total Varian</div>` +
        rows.map((r) => `
          <div class="laporan-total-row">
            <span class="laporan-total-row-label">${r.kode}</span>
            <span class="laporan-total-row-value">${r.qty}</span>
          </div>
        `).join("")
      : "";
  }

  // ── Render total kasbon di card ──
  const kasbonRowEl = document.getElementById("laporan-total-kasbon-row");
  const kasbonValueEl = document.getElementById("laporan-total-kasbon-value");
  if (kasbonRowEl && kasbonValueEl) {
    if (totalKasbonBulan > 0) {
      kasbonValueEl.textContent = "- " + formatRupiahLaporan(totalKasbonBulan);
      kasbonRowEl.style.display = "flex";
    } else {
      kasbonRowEl.style.display = "none";
    }
  }

  if (!semuaTanggal.length) {
    container.innerHTML = '<div class="empty-state">Belum ada laporan untuk bulan ini.</div>';
    const totalEl = document.getElementById("laporan-total-bulan");
    if (totalEl) totalEl.textContent = formatRupiahLaporan(0);
    return;
  }

  let totalBulan = 0;

  const rowsHtml = semuaTanggal.map((tanggal) => {
    const entry = entryByTanggal[tanggal] || null;
    let totalTanggal = 0;

    const jenisRows = loyangList.map((jenis) => {
      const qty = entry ? (Number(entry[getLaporanFieldKey(jenis)]) || 0) : 0;
      const harga = hargaMap[jenis] || 0;
      const nominal = qty * harga;
      totalTanggal += nominal;
      return { jenis, qty, harga, nominal };
    }).filter((r) => r.qty > 0);

    const kasbonTanggal = (kasbonPerTanggal || {})[tanggal] || 0;
    totalTanggal -= kasbonTanggal;
    totalBulan += totalTanggal;

    const itemRowsHtml = jenisRows.length
      ? jenisRows.map((r) => `
          <div class="laporan-loyang-row">
            <span class="laporan-loyang-jenis">${r.jenis}</span>
            <span class="laporan-loyang-qty">${r.qty}</span>
            <span class="laporan-loyang-harga">${formatRupiahLaporan(r.harga)}</span>
            <span class="laporan-loyang-nominal">${formatRupiahLaporan(r.nominal)}</span>
          </div>
        `).join("")
      : '<div class="laporan-loyang-empty">Tidak ada loyang tercatat</div>';

    const kasbonRowHtml = kasbonTanggal > 0
      ? `<div class="laporan-kasbon-row">
           <span>Kasbon</span>
           <span class="laporan-kasbon-nominal">- ${formatRupiahLaporan(kasbonTanggal)}</span>
         </div>`
      : "";

    return `
      <div class="laporan-item">
        <div class="laporan-item__header">
          <div class="laporan-item__tanggal">${formatTanggalLaporan(tanggal)}</div>
          <div class="laporan-item__total">${formatRupiahLaporan(totalTanggal)}</div>
        </div>
        <div class="laporan-loyang-table">
          <div class="laporan-loyang-row laporan-loyang-head">
            <span class="laporan-loyang-jenis">Loyang</span>
            <span class="laporan-loyang-qty">Qty</span>
            <span class="laporan-loyang-harga">Harga</span>
            <span class="laporan-loyang-nominal">Nominal</span>
          </div>
          ${itemRowsHtml}
        </div>
        ${kasbonRowHtml}
      </div>
    `;
  }).join("");

  container.innerHTML = rowsHtml;

  const totalEl = document.getElementById("laporan-total-bulan");
  if (totalEl) totalEl.textContent = formatRupiahLaporan(totalBulan);
}

window.initLaporanView = async function () {
  const root = document.getElementById("laporan-root");
  if (!root) return;

  const now = new Date();
  let laporanBulan = now.getMonth();
  let laporanTahun = now.getFullYear();
  let customRange = null; // { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } kalau aktif, override bulan/tahun

  function formatTanggalRangeLabel(tanggalStr) {
    const bulanPendek = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const [y, m, d] = tanggalStr.split("-").map(Number);
    return `${d} ${bulanPendek[m - 1]} ${y}`;
  }

  root.innerHTML = `
    <div class="laporan-topbar">
      <button class="laporan-topbar__back" onclick="showView('home')">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="laporan-topbar__title">Laporan Saya</div>
    </div>
    <div class="laporan-body">
      <div class="laporan-filter">
        <button class="laporan-filter-btn" id="laporan-bulan-btn">
          <i class="fa-solid fa-calendar"></i>
          <span id="laporan-bulan-label">-</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="laporan-dropdown" id="laporan-bulan-dropdown"></div>

        <button class="laporan-filter-btn" id="laporan-tahun-btn">
          <span id="laporan-tahun-label">-</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="laporan-dropdown" id="laporan-tahun-dropdown"></div>

        <button class="laporan-filter-btn laporan-filter-btn--range" id="laporan-rentang-btn">
          <i class="fa-solid fa-calendar-week"></i>
          <span id="laporan-rentang-label">Rentang</span>
        </button>
      </div>

      <div class="laporan-rentang-overlay" id="laporan-rentang-overlay">
        <div class="laporan-rentang-popup" id="laporan-rentang-popup">
          <div class="laporan-rentang-popup__title">Filter Rentang Tanggal</div>
          <div class="laporan-rentang-popup__field">
            <label>Dari</label>
            <input type="date" id="laporan-rentang-dari">
          </div>
          <div class="laporan-rentang-popup__field">
            <label>Sampai</label>
            <input type="date" id="laporan-rentang-sampai">
          </div>
          <div class="laporan-rentang-popup__actions">
            <button class="laporan-rentang-btn-reset" id="laporan-rentang-reset">Reset</button>
            <button class="laporan-rentang-btn-terapkan" id="laporan-rentang-terapkan">Terapkan</button>
          </div>
        </div>
      </div>

      <div class="laporan-total-card">
        <div class="laporan-total-label" id="laporan-total-label">Total</div>
        <div class="laporan-total-value" id="laporan-total-bulan">Rp 0</div>
        <div class="laporan-total-breakdown" id="laporan-total-loyang-breakdown"></div>
        <div class="laporan-total-breakdown" id="laporan-total-varian-breakdown"></div>
        <div class="laporan-total-kasbon-row" id="laporan-total-kasbon-row">
          <span>Total Kasbon</span>
          <span id="laporan-total-kasbon-value">Rp 0</span>
        </div>
      </div>

      <div id="laporan-list" class="laporan-list">
        <div class="laporan-item">
          <div class="laporan-item__header">
            <div class="sk-row" style="width:50%;height:14px"></div>
            <div class="sk-row" style="width:25%;height:14px"></div>
          </div>
          <div class="sk-row" style="height:60px;margin-top:8px"></div>
        </div>
        <div class="laporan-item">
          <div class="laporan-item__header">
            <div class="sk-row" style="width:50%;height:14px"></div>
            <div class="sk-row" style="width:25%;height:14px"></div>
          </div>
          <div class="sk-row" style="height:60px;margin-top:8px"></div>
        </div>
      </div>
    </div>
  `;

  const listEl = document.getElementById("laporan-list");
  const bulanBtn = document.getElementById("laporan-bulan-btn");
  const tahunBtn = document.getElementById("laporan-tahun-btn");
  const bulanDD = document.getElementById("laporan-bulan-dropdown");
  const tahunDD = document.getElementById("laporan-tahun-dropdown");
  const bulanLabelEl = document.getElementById("laporan-bulan-label");
  const tahunLabelEl = document.getElementById("laporan-tahun-label");

  const rentangBtn = document.getElementById("laporan-rentang-btn");
  const rentangLabelEl = document.getElementById("laporan-rentang-label");
  const rentangOverlay = document.getElementById("laporan-rentang-overlay");
  const rentangDariEl = document.getElementById("laporan-rentang-dari");
  const rentangSampaiEl = document.getElementById("laporan-rentang-sampai");
  const rentangResetBtn = document.getElementById("laporan-rentang-reset");
  const rentangTerapkanBtn = document.getElementById("laporan-rentang-terapkan");

  bulanLabelEl.textContent = LAPORAN_BULAN_NAMA[laporanBulan];
  tahunLabelEl.textContent = laporanTahun;

  bulanDD.innerHTML = LAPORAN_BULAN_NAMA.map((nama, idx) =>
    `<div class="laporan-dropdown-option ${idx === laporanBulan ? "selected" : ""}" data-bulan="${idx}">${nama}</div>`
  ).join("");
  tahunDD.innerHTML = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) =>
    `<div class="laporan-dropdown-option ${y === laporanTahun ? "selected" : ""}" data-tahun="${y}">${y}</div>`
  ).join("");

  const closeAllDD = () => { bulanDD.classList.remove("show"); tahunDD.classList.remove("show"); };
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".laporan-filter")) closeAllDD();
  });
  bulanBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = bulanDD.classList.contains("show");
    closeAllDD();
    if (!isOpen) bulanDD.classList.add("show");
  });
  tahunBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = tahunDD.classList.contains("show");
    closeAllDD();
    if (!isOpen) tahunDD.classList.add("show");
  });

  bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      laporanBulan = Number(opt.dataset.bulan);
      bulanLabelEl.textContent = LAPORAN_BULAN_NAMA[laporanBulan];
      bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAllDD();
      customRange = null;
      rentangLabelEl.textContent = "Rentang";
      rentangBtn.classList.remove("active");
      await loadAndRender();
    });
  });

  tahunDD.querySelectorAll(".laporan-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      laporanTahun = Number(opt.dataset.tahun);
      tahunLabelEl.textContent = laporanTahun;
      tahunDD.querySelectorAll(".laporan-dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAllDD();
      customRange = null;
      rentangLabelEl.textContent = "Rentang";
      rentangBtn.classList.remove("active");
      await loadAndRender();
    });
  });

  rentangBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllDD();
    rentangDariEl.value = customRange?.start || "";
    rentangSampaiEl.value = customRange?.end || "";
    rentangOverlay.classList.add("show");
  });

  rentangOverlay.addEventListener("click", (e) => {
    if (e.target === rentangOverlay) rentangOverlay.classList.remove("show");
  });

  rentangResetBtn.addEventListener("click", async () => {
    customRange = null;
    rentangLabelEl.textContent = "Rentang";
    rentangBtn.classList.remove("active");
    rentangOverlay.classList.remove("show");
    await loadAndRender();
  });

  rentangTerapkanBtn.addEventListener("click", async () => {
    if (!rentangDariEl.value || !rentangSampaiEl.value) return;
    let start = rentangDariEl.value;
    let end = rentangSampaiEl.value;
    if (start > end) { const tmp = start; start = end; end = tmp; }
    customRange = { start, end };
    rentangLabelEl.textContent = `${formatTanggalRangeLabel(start)} - ${formatTanggalRangeLabel(end)}`;
    rentangBtn.classList.add("active");
    rentangOverlay.classList.remove("show");
    await loadAndRender();
  });

  const idCabang = window.currentUser?.idCabang;
  const uidKoki = window.currentUser?.uid;
  const cabangData = await window.fetchCabangInfo?.(idCabang);
  const adminUid = await resolveAdminUid(idCabang);

  const loyangArr = cabangData?.loyang || [];
  const loyangActive = loyangArr.filter((item) => item?.status === true);
  const loyangList = loyangActive.map((item) => item.jenisLoyang).filter(Boolean);
  const hargaMap = {};
  loyangActive.forEach((item) => {
    if (item.jenisLoyang) hargaMap[item.jenisLoyang] = Number(item.upah) || 0;
  });
  const varianKodeList = Object.keys(cabangData?.varian || {}).sort();

  async function loadAndRender() {
    let start, end;
    if (customRange) {
      start = customRange.start;
      end = customRange.end;
    } else {
      const mm = String(laporanBulan + 1).padStart(2, "0");
      start = `${laporanTahun}-${mm}-01`;
      end = `${laporanTahun}-${mm}-31`;
    }

    const totalLabelEl = document.getElementById("laporan-total-label");
    if (totalLabelEl) {
      totalLabelEl.textContent = customRange
        ? `Total ${formatTanggalRangeLabel(start)} – ${formatTanggalRangeLabel(end)}`
        : `Total ${LAPORAN_BULAN_NAMA[laporanBulan]} ${laporanTahun}`;
    }
    listEl.innerHTML = `
      <div class="laporan-item">
        <div class="laporan-item__header">
          <div class="sk-row" style="width:50%;height:14px"></div>
          <div class="sk-row" style="width:25%;height:14px"></div>
        </div>
        <div class="sk-row" style="height:60px;margin-top:8px"></div>
      </div>
      <div class="laporan-item">
        <div class="laporan-item__header">
          <div class="sk-row" style="width:50%;height:14px"></div>
          <div class="sk-row" style="width:25%;height:14px"></div>
        </div>
        <div class="sk-row" style="height:60px;margin-top:8px"></div>
      </div>`;
    if (!adminUid || !uidKoki) {
      listEl.innerHTML = '<div class="empty-state">Data admin cabang tidak ditemukan.</div>';
      return;
    }

    const [entries, kasbonData, varianPerTanggal] = await Promise.all([
      fetchLaporanBulan(adminUid, uidKoki, start, end),
      fetchKasbonBulan(adminUid, uidKoki, start, end),
      fetchVarianBulan(adminUid, uidKoki, start, end),
    ]);
    entries.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    renderLaporanList(
      listEl, entries, hargaMap, loyangList.length ? loyangList : ["Original"],
      kasbonData.kasbonPerTanggal, kasbonData.totalKasbonBulan,
      varianPerTanggal, varianKodeList
    );
  }

  await loadAndRender();
};
