
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

async function fetchLaporanBulan(adminUid, uidKoki, bulan, tahun) {
  try {
    const mm = String(bulan + 1).padStart(2, "0");
    const start = `${tahun}-${mm}-01`;
    const end = `${tahun}-${mm}-31`;

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

async function fetchKasbonBulan(adminUid, uidKoki, bulan, tahun) {
  const kasbonPerTanggal = {};
  let totalKasbonBulan = 0;

  try {
    const mm = String(bulan + 1).padStart(2, "0");
    const start = `${tahun}-${mm}-01`;
    const end = `${tahun}-${mm}-31`;

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

function renderLaporanList(container, entries, hargaMap, loyangList, kasbonPerTanggal, totalKasbonBulan) {
  const entryByTanggal = {};
  entries.forEach((e) => { entryByTanggal[e.tanggal] = e; });

  const semuaTanggal = Array.from(new Set([
    ...entries.map((e) => e.tanggal),
    ...Object.keys(kasbonPerTanggal || {}),
  ])).sort((a, b) => b.localeCompare(a));

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
      </div>

      <div class="laporan-total-card">
        <div class="laporan-total-label">Total Bulan Ini</div>
        <div class="laporan-total-value" id="laporan-total-bulan">Rp 0</div>
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

  async function loadAndRender() {
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

    const [entries, kasbonData] = await Promise.all([
      fetchLaporanBulan(adminUid, uidKoki, laporanBulan, laporanTahun),
      fetchKasbonBulan(adminUid, uidKoki, laporanBulan, laporanTahun),
    ]);
    entries.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    renderLaporanList(
      listEl, entries, hargaMap, loyangList.length ? loyangList : ["Original"],
      kasbonData.kasbonPerTanggal, kasbonData.totalKasbonBulan
    );
  }

  bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      laporanBulan = Number(opt.dataset.bulan);
      bulanLabelEl.textContent = LAPORAN_BULAN_NAMA[laporanBulan];
      bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAllDD();
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
      await loadAndRender();
    });
  });

  await loadAndRender();
};
