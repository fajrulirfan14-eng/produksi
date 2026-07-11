
const RIWAYAT_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const RIWAYAT_HARI_NAMA  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function formatTanggalRiwayat(tanggalStr) {
  const [y, m, d] = tanggalStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${RIWAYAT_HARI_NAMA[dateObj.getDay()]}, ${d} ${RIWAYAT_BULAN_NAMA[m - 1]} ${y}`;
}

const RIWAYAT_SKIP_KEYS = new Set(["tanggal", "createdBy"]);

async function fetchRiwayatBulan(adminUid, bulan, tahun) {
  try {
    const mm = String(bulan + 1).padStart(2, "0");
    const start = `${tahun}-${mm}-01`;
    const end = `${tahun}-${mm}-31`;

    const q = window.query(
      window.collection(window.db, "users", adminUid, "laporanAdmin"),
      window.where("tanggal", ">=", start),
      window.where("tanggal", "<=", end)
    );
    const snap = await window.getDocs(q);

    return snap.docs.map((docSnap) => ({ tanggal: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  } catch (err) {
    console.error("❌ fetchRiwayatBulan:", err);
    return [];
  }
}

function renderRiwayatList(entries, varianList) {
  const listEl = document.getElementById("riwayat-list");
  if (!listEl) return;

  if (!entries.length) {
    listEl.innerHTML = '<div class="empty-state">Belum ada riwayat untuk bulan ini.</div>';
    return;
  }

  listEl.innerHTML = entries.map((entry, idx) => {
    const staffEntries = Object.entries(entry).filter(([key]) => !RIWAYAT_SKIP_KEYS.has(key) && key !== "tanggal");

    const totalPerVarian = {};
    varianList.forEach((kode) => { totalPerVarian[kode] = 0; });

    const staffList = staffEntries.map(([uid, info]) => {
      const closing = info?.pembayaran?.closing || {};
      varianList.forEach((kode) => {
        totalPerVarian[kode] += Number(closing[kode]) || 0;
      });
      return { uid, nama: info?.nama || "Tanpa Nama", closing };
    });

    const totalGridHtml = varianList.map((kode) => `
      <div class="riwayat-varian-item">
        <div class="riwayat-varian-kode">${kode}</div>
        <div class="riwayat-varian-qty">${totalPerVarian[kode] || 0}</div>
      </div>
    `).join("");

    const staffDetailHtml = staffList.length
      ? staffList.map((s) => `
          <div class="riwayat-staff-block">
            <div class="riwayat-staff-nama">${s.nama}</div>
            <div class="riwayat-varian-grid">
              ${varianList.map((kode) => `
                <div class="riwayat-varian-item">
                  <div class="riwayat-varian-kode">${kode}</div>
                  <div class="riwayat-varian-qty">${Number(s.closing[kode]) || 0}</div>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")
      : '<div class="riwayat-empty-staff">Belum ada data staff</div>';

    return `
      <div class="riwayat-card" data-idx="${idx}">
        <div class="riwayat-card-header" onclick="toggleRiwayatCard(${idx})">
          <div class="riwayat-card-tanggal">${formatTanggalRiwayat(entry.tanggal)}</div>
          <i class="fa-solid fa-chevron-down riwayat-chevron"></i>
        </div>
        <div class="riwayat-varian-grid riwayat-total-grid">
          ${totalGridHtml}
        </div>
        <div class="riwayat-staff-detail" id="riwayatDetail-${idx}">
          ${staffDetailHtml}
        </div>
      </div>
    `;
  }).join("");
}

window.toggleRiwayatCard = function (idx) {
  const card = document.querySelector(`.riwayat-card[data-idx="${idx}"]`);
  if (!card) return;
  card.classList.toggle("open");
};

window.initRiwayatView = async function () {
  const root = document.getElementById("riwayat-root");
  if (!root) return;

  const now = new Date();
  let riwayatBulan = now.getMonth();
  let riwayatTahun = now.getFullYear();

  root.innerHTML = `
    <div class="laporan-topbar">
      <button class="laporan-topbar__back" onclick="showView('home')">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="laporan-topbar__title">Riwayat Produksi</div>
    </div>
    <div class="laporan-body">
      <div class="laporan-filter">
        <button class="laporan-filter-btn" id="riwayat-bulan-btn">
          <i class="fa-solid fa-calendar"></i>
          <span id="riwayat-bulan-label">-</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="laporan-dropdown" id="riwayat-bulan-dropdown"></div>

        <button class="laporan-filter-btn" id="riwayat-tahun-btn">
          <span id="riwayat-tahun-label">-</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="laporan-dropdown" id="riwayat-tahun-dropdown"></div>
      </div>

      <div id="riwayat-list" class="laporan-list">
        <div class="riwayat-card">
          <div class="sk-row" style="width:50%;height:14px;margin-bottom:10px"></div>
          <div class="riwayat-varian-grid">
            <div class="sk-box"></div><div class="sk-box"></div><div class="sk-box"></div><div class="sk-box"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const listEl = document.getElementById("riwayat-list");
  const bulanBtn = document.getElementById("riwayat-bulan-btn");
  const tahunBtn = document.getElementById("riwayat-tahun-btn");
  const bulanDD = document.getElementById("riwayat-bulan-dropdown");
  const tahunDD = document.getElementById("riwayat-tahun-dropdown");
  const bulanLabelEl = document.getElementById("riwayat-bulan-label");
  const tahunLabelEl = document.getElementById("riwayat-tahun-label");

  bulanLabelEl.textContent = RIWAYAT_BULAN_NAMA[riwayatBulan];
  tahunLabelEl.textContent = riwayatTahun;

  bulanDD.innerHTML = RIWAYAT_BULAN_NAMA.map((nama, idx) =>
    `<div class="laporan-dropdown-option ${idx === riwayatBulan ? "selected" : ""}" data-bulan="${idx}">${nama}</div>`
  ).join("");
  tahunDD.innerHTML = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) =>
    `<div class="laporan-dropdown-option ${y === riwayatTahun ? "selected" : ""}" data-tahun="${y}">${y}</div>`
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
  const adminUid = await resolveAdminUid(idCabang);
  const cabangData = await window.fetchCabangInfo?.(idCabang);
  const varianList = Object.keys(cabangData?.varian || {}).sort();

  async function loadAndRender() {
    listEl.innerHTML = `
      <div class="riwayat-card">
        <div class="sk-row" style="width:50%;height:14px;margin-bottom:10px"></div>
        <div class="riwayat-varian-grid">
          <div class="sk-box"></div><div class="sk-box"></div><div class="sk-box"></div><div class="sk-box"></div>
        </div>
      </div>`;

    if (!adminUid) {
      listEl.innerHTML = '<div class="empty-state">Data admin cabang tidak ditemukan.</div>';
      return;
    }

    const entries = await fetchRiwayatBulan(adminUid, riwayatBulan, riwayatTahun);
    renderRiwayatList(entries, varianList);
  }

  bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      riwayatBulan = Number(opt.dataset.bulan);
      bulanLabelEl.textContent = RIWAYAT_BULAN_NAMA[riwayatBulan];
      bulanDD.querySelectorAll(".laporan-dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAllDD();
      await loadAndRender();
    });
  });

  tahunDD.querySelectorAll(".laporan-dropdown-option").forEach((opt) => {
    opt.addEventListener("click", async (e) => {
      e.stopPropagation();
      riwayatTahun = Number(opt.dataset.tahun);
      tahunLabelEl.textContent = riwayatTahun;
      tahunDD.querySelectorAll(".laporan-dropdown-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      closeAllDD();
      await loadAndRender();
    });
  });

  await loadAndRender();
};