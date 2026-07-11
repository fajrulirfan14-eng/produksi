import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  writeBatch,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  getDocs,
  onSnapshot,
  deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605",
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
const db      = getFirestore(app);
const storage = getStorage(app);

let currentView = "home";

// ── expose ke window, biar view-view lain (plain script) bisa pakai ──
window.auth = auth;
window.db = db;
window.serverTimestamp = serverTimestamp;
window.collection = collection;
window.addDoc = addDoc;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.limit = limit;
window.getDocs = getDocs;
window.onSnapshot = onSnapshot;
window.updateDoc = updateDoc;
window.writeBatch = writeBatch;
window.deleteField = deleteField;
window.storage = storage;
window.storageRef = storageRef;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.deleteObject = deleteObject;
window.currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docRef  = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();

        if (userData.status === false) {
          showPopupNonaktif();
          return;
        }

        window.currentUser = { uid: user.uid, email: user.email, ...userData };
        localStorage.setItem("userCache", JSON.stringify(window.currentUser));
      }
    } catch (err) {
      // OFFLINE MODE — fallback ke cache
      const cache = localStorage.getItem("userCache");
      if (cache) {
        window.currentUser = JSON.parse(cache);
      } else {
        window.location.href = "login.html";
        return;
      }
    }

    initNavbar();
    showView("home");
  } else {
    const cache = localStorage.getItem("userCache");
    if (cache && !navigator.onLine) {
      window.currentUser = JSON.parse(cache);
      initNavbar();
      showView("home");
    } else {
      localStorage.clear();
      window.location.href = "login.html";
    }
  }
});

function showPopupNonaktif() {
  const overlay = document.createElement("div");
  overlay.className = "nonaktif-overlay";
  overlay.innerHTML = `
    <div class="nonaktif-card">
      <div class="nonaktif-icon">🚫</div>
      <div class="nonaktif-title">Akun Dinonaktifkan</div>
      <div class="nonaktif-desc">Akun kamu telah dinonaktifkan oleh admin. Hubungi admin cabang untuk informasi lebih lanjut.</div>
      <button class="nonaktif-btn" id="btnNonaktifOk">OK</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("btnNonaktifOk").onclick = async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  };
}

window.logout = async function () {
  try {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
  } catch (err) { /* noop */ }
};

window._ramCache = {}; // cache sementara di memori, hilang saat app direfresh

function showSyncToast(pesan, sukses = true) {
  const existing = document.getElementById("syncToastEl");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "syncToastEl";
  toast.style.cssText = `
    position:fixed;bottom:120px;left:50%;transform:translateX(-50%);
    background:${sukses ? "#2eaf62" : "#e53935"};
    color:#fff;padding:10px 20px;border-radius:20px;
    font-size:13px;font-weight:600;z-index:99999;
    max-width:90vw;text-align:center;
  `;
  toast.textContent = pesan;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
window.showSyncToast = showSyncToast;

/* =========================================================
   LOCK HEIGHT — keyboard Android tidak resize layout
   ========================================================= */
function setAppHeight() {
  if (!window.initialAppHeight) window.initialAppHeight = window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${window.initialAppHeight}px`);
}
setAppHeight();
window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    window.initialAppHeight = window.innerHeight;
    setAppHeight();
  }, 300);
});

/* =========================================================
   ROUTER — showView
   ========================================================= */
function showView(viewName, trigger = "direct") {
  currentView = viewName;
  window.currentView = viewName;

  if (location.hash !== "#" + viewName) {
    history.replaceState(null, "", "#" + viewName);
  }

  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active", "anim-navbar", "anim-direct", "anim-back");
  });

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.add("active");
    const ANIM_MAP = { navbar: "anim-navbar", direct: "anim-direct", back: "anim-back" };
    const animOff = localStorage.getItem("pref_anim") === "0";
    const animClass = !animOff ? ANIM_MAP[trigger] : null;
    if (animClass) {
      target.classList.add(animClass);
      target.addEventListener("animationend", () => target.classList.remove(animClass), { once: true });
    }
    target.scrollTop = 0;
  }

  const navbar = document.getElementById("navbarBottom");
  const hideNavbarViews = ["input", "peraturan", "tentang", "keamanan", "perjanjian", "slip"];
  if (navbar) {
    navbar.classList.toggle("hide", hideNavbarViews.includes(viewName));
  }
  lazyInitView(viewName);
}

let _inited = {};

function lazyInitView(viewName, forceRefresh = false) {
  if (viewName !== "input" && _inited[viewName] && !forceRefresh) return;
  if (viewName !== "input") _inited[viewName] = true;

  switch (viewName) {
    case "home":      window.initHomeView?.();      break;
    case "input":     window.initInputView?.();     break;
    case "profil":    window.initProfilView?.();    break;
    case "laporan":   window.initLaporanView?.();   break;
    case "peraturan": window.initPeraturanView?.(); break;
    case "keamanan":  window.initKeamananView?.();  break;
  }
}
window.showView = showView;

/* Blocker back agar tidak keluar ke login.html */
history.pushState({ app: true }, "");
history.pushState({ app: true }, "");
location.hash = "home";

let _backLocked = false;
function _handleBack() {
  if (_backLocked) return;
  _backLocked = true;

  if (currentView !== "home") {
    const backToProfilViews = ["peraturan", "tentang", "keamanan", "perjanjian", "slip"];
    const backTarget = backToProfilViews.includes(currentView) ? "profil" : "home";
    showView(backTarget, "back");
    const homeNav = document.querySelector(`.nav-item[data-view='${backTarget}']`);
    if (homeNav) {
      document.querySelectorAll(".nav-item").forEach((i) => {
        i.innerHTML = `<i class="${i.dataset.icon}"></i><span>${i.dataset.label}</span>`;
        i.classList.remove("active");
      });
      homeNav.innerHTML = `<span class="nav-placeholder"></span><span>${homeNav.dataset.label}</span>`;
      homeNav.classList.add("active");
      window._moveFab?.(homeNav);
    }
  }

  setTimeout(() => {
    history.replaceState(null, "", "#" + currentView);
    _backLocked = false;
  }, 300);
}
window.addEventListener("hashchange", _handleBack);

/* =========================================================
   NAVBAR — FAB curve morphing
   ========================================================= */
function initNavbar() {
  const fab     = document.getElementById("navFab");
  const fabIcon = document.getElementById("navFabIcon");
  const svgPath = document.getElementById("navSvgPath");
  if (!fab || !fabIcon || !svgPath) return;

  function getFabLeftPercent(item) {
    const navbar   = document.getElementById("navbarBottom");
    const navRect  = navbar.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const centerX  = itemRect.left + itemRect.width / 2 - navRect.left;
    return (centerX / navRect.width) * 100;
  }

  function buildPath(leftPercent) {
    const css = getComputedStyle(document.documentElement);
    const W   = 400;
    const cx  = (leftPercent / 100) * W;
    const r   = parseFloat(css.getPropertyValue("--nav-curve-r"))   || 52;
    const dip = parseFloat(css.getPropertyValue("--nav-curve-dip")) || 32;
    const cp  = parseFloat(css.getPropertyValue("--nav-curve-cp"))  || 0.55;
    const top = 16;
    const x0  = cx - r;
    const x1  = cx + r;
    return [
      `M16 ${top}`,
      `H${x0}`,
      `C${x0 + r * cp} ${top}  ${cx - r * cp} ${top + dip}  ${cx} ${top + dip}`,
      `C${cx + r * cp} ${top + dip}  ${x1 - r * cp} ${top}  ${x1} ${top}`,
      `H400 V64 Q400 80 384 80`,
      `H16 Q0 80 0 64 V${top} Z`,
    ].join(" ");
  }

  function moveFab(item, animate = true) {
    const leftPct = getFabLeftPercent(item);
    if (animate) {
      fab.classList.remove("is-moving");
      void fab.offsetWidth;
      fab.classList.add("is-moving");
    }
    fab.style.left = `${leftPct}%`;
    fabIcon.className = item.dataset.icon;
    if (animate) {
      fabIcon.classList.remove("icon-anim");
      void fabIcon.offsetWidth;
      fabIcon.classList.add("icon-anim");
    }
    svgPath.setAttribute("d", buildPath(leftPct));
    const css = getComputedStyle(document.documentElement);
    fab.style.borderColor = css.getPropertyValue("--nav-fab-border").trim() || "#fff";
  }
  window._moveFab = moveFab;

  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    const labelEl = item.querySelector("span:last-child");
    if (labelEl && !item.dataset.label) item.dataset.label = labelEl.textContent.trim();
  });

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const prevActive = document.querySelector(".nav-item.active");
      if (prevActive && prevActive !== item) {
        prevActive.innerHTML = `<i class="${prevActive.dataset.icon}"></i><span>${prevActive.dataset.label}</span>`;
        prevActive.classList.remove("active");
      }
      item.innerHTML = `<span class="nav-placeholder"></span><span>${item.dataset.label}</span>`;
      item.classList.add("active");
      moveFab(item);
      showView(item.dataset.view, "navbar");
    });
  });

  const firstActive = document.querySelector(".nav-item.active");
  if (firstActive) {
    svgPath.style.transition = "none";
    fab.style.transition = "none";
    setTimeout(() => {
      moveFab(firstActive, false);
      setTimeout(() => {
        svgPath.style.transition = "";
        fab.style.transition = "left .4s cubic-bezier(.34,1.3,.64,1)";
      }, 50);
    }, 80);
  }
}

/* =========================================================
   PULL TO REFRESH
   ========================================================= */
(function () {
  const indicator = document.getElementById("pullRefreshIndicator");
  const circle    = document.getElementById("ptrCircle");
  if (!indicator || !circle) return;

  const THRESHOLD = 250;
  const FULL_DASH = 226;
  let startY = 0, pulling = false, refreshing = false, hasPulled = false;

  function canPull() {
    const appEl = document.getElementById("app");
    if (appEl.scrollTop > 0) return false;
    const activeView = document.querySelector(".view.active");
    if (activeView && activeView.scrollTop > 0) return false;
    return true;
  }

  window.addEventListener("touchstart", (e) => {
    if (refreshing || !canPull()) return;
    startY = e.touches[0].clientY;
    pulling = true;
    hasPulled = false;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pulling || refreshing) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY <= 0) {
      if (hasPulled) e.preventDefault();
      indicator.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform = "translateY(-60px)";
      circle.style.strokeDashoffset = FULL_DASH;
      return;
    }
    hasPulled = true;
    e.preventDefault();
    const damped = Math.min(deltaY * 0.45, 100);
    const raw = Math.min(deltaY / THRESHOLD, 1);
    const progress = Math.pow(raw, 1.4);
    indicator.style.transition = "none";
    indicator.style.transform = `translateY(${damped - 70}px)`;
    circle.style.strokeDashoffset = FULL_DASH - FULL_DASH * progress;
  }, { passive: false });

  window.addEventListener("touchend", (e) => {
    if (!pulling || refreshing) return;
    pulling = false;
    hasPulled = false;
    const deltaY = e.changedTouches[0].clientY - startY;
    if (deltaY >= THRESHOLD) {
      refreshing = true;
      indicator.style.transition = "transform 0.3s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform = "translateY(4px)";
      indicator.classList.add("ptr-loading");
      setTimeout(() => {
        lazyInitView(window.currentView, true);
        setTimeout(() => {
          indicator.style.transition = "transform 0.4s cubic-bezier(0.25,1,0.5,1)";
          indicator.style.transform = "translateY(-60px)";
          indicator.classList.remove("ptr-loading");
          circle.style.strokeDashoffset = FULL_DASH;
          setTimeout(() => { indicator.style.transition = "none"; refreshing = false; }, 400);
        }, 600);
      }, 800);
    } else {
      indicator.style.transition = "transform 0.35s cubic-bezier(0.25,1,0.5,1)";
      indicator.style.transform = "translateY(-60px)";
      circle.style.strokeDashoffset = FULL_DASH;
      setTimeout(() => { indicator.style.transition = "none"; }, 350);
    }
  }, { passive: true });
})();

/* DISABLE double-tap zoom */
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, false);
document.addEventListener("gesturestart", (e) => e.preventDefault());

// CROP FOTO ENGINE
(function initCropEngine() {
  if (window._cropEngineReady) return;
  window._cropEngineReady = true;
  const LS_KEY = 'ttn_cover_photo';
  const state = {
    imgRect : { x: 0, y: 0, w: 0, h: 0 },
    box     : { x: 0, y: 0, w: 0, h: 0 },
    drag    : null,
  };

  function getImgRect() {
    const ws  = document.getElementById('cropWorkspace');
    const img = document.getElementById('cropImg');
    if (!ws || !img) return state.imgRect;

    const cw = ws.offsetWidth;
    const ch = ws.offsetHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return { x: 0, y: 0, w: cw, h: ch };

    const cRatio = cw / ch;
    const iRatio = iw / ih;
    let rw, rh, rx, ry;

    if (iRatio > cRatio) {
      rw = cw; rh = cw / iRatio;
      rx = 0;  ry = (ch - rh) / 2;
    } else {
      rh = ch; rw = ch * iRatio;
      ry = 0;  rx = (cw - rw) / 2;
    }
    return { x: rx, y: ry, w: rw, h: rh };
  }

  function applyBox() {
    const el = document.getElementById('cropBox');
    if (!el) return;
    el.style.left   = state.box.x + 'px';
    el.style.top    = state.box.y + 'px';
    el.style.width  = state.box.w + 'px';
    el.style.height = state.box.h + 'px';

    const img = document.getElementById('cropImg');
    if (img && img.naturalWidth) {
      const ir     = state.imgRect;
      const scaleX = img.naturalWidth  / ir.w;
      const scaleY = img.naturalHeight / ir.h;
      const realW  = Math.round(state.box.w * scaleX);
      const realH  = Math.round(state.box.h * scaleY);
      const info   = document.getElementById('cropSizeInfo');
      if (info) info.textContent = `${realW} × ${realH} px`;
    }
  }
  function clampBox(b, ir) {
    const MIN = 40;
    let { x, y, w, h } = b;
    w = Math.max(MIN, w);
    h = Math.max(MIN, h);
    x = Math.max(ir.x, Math.min(x, ir.x + ir.w - w));
    y = Math.max(ir.y, Math.min(y, ir.y + ir.h - h));
    if (x + w > ir.x + ir.w) w = ir.x + ir.w - x;
    if (y + h > ir.y + ir.h) h = ir.y + ir.h - y;
    return { x, y, w, h };
  }
  function getLocal(e) {
    const ws   = document.getElementById('cropWorkspace');
    const rect = ws.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function onDown(e) {
    e.preventDefault();
    const { x, y }  = getLocal(e);
    const handle     = e.target.dataset?.handle;
    const onBox      = e.target.id === 'cropBox' || e.target.closest?.('#cropBox');

    if (handle) {
      state.drag = { type: 'resize', handle, sx: x, sy: y, sb: { ...state.box } };
    } else if (onBox) {
      state.drag = { type: 'move', sx: x, sy: y, sb: { ...state.box } };
    } else {
      const ir = state.imgRect;
      const cx = Math.max(ir.x, Math.min(x, ir.x + ir.w));
      const cy = Math.max(ir.y, Math.min(y, ir.y + ir.h));
      state.box  = { x: cx, y: cy, w: 1, h: 1 };
      state.drag = { type: 'new', sx: cx, sy: cy };
      applyBox();
    }
  }
  function onMove(e) {
    if (!state.drag) return;
    e.preventDefault();
    const { x, y } = getLocal(e);
    const ir = state.imgRect;
    const sb = state.drag.sb;
    const dx = x - state.drag.sx;
    const dy = y - state.drag.sy;
    const MIN = 40;
    let nb;

    if (state.drag.type === 'move') {
      nb = clampBox({ x: sb.x + dx, y: sb.y + dy, w: sb.w, h: sb.h }, ir);
    } else if (state.drag.type === 'resize') {
      const h = state.drag.handle;
      let { x: bx, y: by, w: bw, h: bh } = sb;
      const RATIO = 14 / 9;
      if (h === 'br') { bw = Math.max(MIN, bw + dx); bh = bw / RATIO; }
      if (h === 'bl') { const nw = Math.max(MIN, bw - dx); bx = bx + bw - nw; bw = nw; bh = bw / RATIO; }
      if (h === 'tr') { bw = Math.max(MIN, bw + dx); bh = bw / RATIO; by = by + sb.h - bh; }
      if (h === 'tl') { const nw = Math.max(MIN, bw - dx); bx = bx + bw - nw; bw = nw; bh = bw / RATIO; by = by + sb.h - bh; }
      nb = clampBox({ x: bx, y: by, w: bw, h: bh }, ir);
    } else if (state.drag.type === 'new') {
      const x1 = Math.max(ir.x, Math.min(state.drag.sx, ir.x + ir.w));
      const y1 = Math.max(ir.y, Math.min(state.drag.sy, ir.y + ir.h));
      const x2 = Math.max(ir.x, Math.min(x, ir.x + ir.w));
      const y2 = Math.max(ir.y, Math.min(y, ir.y + ir.h));
      nb = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 1, h: Math.abs(y2 - y1) || 1 };
    }
    if (nb) { state.box = nb; applyBox(); }
  }
  function onUp() { state.drag = null; }

  window.openCropModal = function(dataUrl) {
    const overlay = document.getElementById('cropOverlay');
    const img     = document.getElementById('cropImg');
    if (!overlay || !img) return;

    overlay.classList.add('open');
    img.src = dataUrl;

    img.onload = () => {
      state.imgRect = getImgRect();
      const ir = state.imgRect;
      const RATIO = 14 / 9;
      let bw = ir.w;
      let bh = bw / RATIO;
      if (bh > ir.h) { bh = ir.h; bw = bh * RATIO; }
      const bx = ir.x + (ir.w - bw) / 2;
      const by = ir.y + (ir.h - bh) / 2;
      state.box = { x: bx, y: by, w: bw, h: bh };
      applyBox();

      const ws = document.getElementById('cropWorkspace');
      ws.onmousedown  = onDown;
      ws.ontouchstart = onDown;
      document.onmousemove  = onMove;
      document.ontouchmove  = onMove;
      document.onmouseup    = onUp;
      document.ontouchend   = onUp;
    };
  };
  function doConfirm() {
    const img = document.getElementById('cropImg');
    if (!img) return;

    const ir     = state.imgRect;
    const box    = state.box;
    const scaleX = img.naturalWidth  / ir.w;
    const scaleY = img.naturalHeight / ir.h;

    const sx = (box.x - ir.x) * scaleX;
    const sy = (box.y - ir.y) * scaleY;
    const sw = box.w * scaleX;
    const sh = box.h * scaleY;

    const MAX_W  = 1200;
    const outW   = Math.min(Math.round(sw), MAX_W);
    const outH   = Math.round(sh * (outW / sw));

    const canvas = document.createElement('canvas');
    canvas.width  = outW;
    canvas.height = outH;
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const compressed = canvas.toDataURL('image/jpeg', 0.78);

    try {
      localStorage.setItem(LS_KEY, compressed);
      const headerHome = document.querySelector(".headerHome");
      if (headerHome) {
        headerHome.style.backgroundImage = `url(${compressed})`;
        headerHome.style.backgroundSize = "cover";
        headerHome.style.backgroundPosition = "center";
        headerHome.style.backgroundRepeat = "no-repeat";
        headerHome.classList.add("has-cover");
      }
    } catch (err) {
      alert('Gambar terlalu besar. Coba area crop lebih kecil.');
      return;
    }

    const heroBg = document.getElementById('profilHeroBg');
    if (heroBg) {
      heroBg.style.background     = `url(${compressed}) center/cover no-repeat`;
      heroBg.style.backgroundSize = 'cover';
    }

    window.showToast?.("Foto sampul berhasil diperbarui", "success");
    closeModal();
  }
  function closeModal() {
    const overlay = document.getElementById('cropOverlay');
    if (overlay) overlay.classList.remove('open');
    document.onmousemove = document.ontouchmove = null;
    document.onmouseup   = document.ontouchend  = null;
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#cropConfirm'))              doConfirm();
    if (e.target.closest('#cropCancel'))               closeModal();
    if (e.target.closest('#cropClose'))                closeModal();
    if (e.target.id === 'cropOverlay')                 closeModal();
  });
})();

/* ── DARK MODE ── */
window.applyDarkMode = function (val) {
  document.body.classList.toggle("dark-mode", !!val);
  localStorage.setItem("pref_dark", val ? "1" : "0");
};
window.isDarkMode = function () {
  return localStorage.getItem("pref_dark") === "1";
};
window.applyDarkMode(window.isDarkMode());
