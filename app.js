// ========================================================
// KONFIGURASI FIREBASE CLOUD & GLOBAL VARS
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyCfz1UlF0HD3eZSwridBibwGMqn3-Z8Mu8", authDomain: "pratama-finance.firebaseapp.com",
  projectId: "pratama-finance", storageBucket: "pratama-finance.firebasestorage.app",
  messagingSenderId: "38799030041", appId: "1:38799030041:web:140b04b4f3a7676a547788", measurementId: "G-0Y2Q0TD0VE"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();

let currentUser = null, currentUid = null, userProfile = { fullname: '', phone: '', city: '', job: '' };
let tempSelectedSources = ['all_liquid'], currentSourceMode = 'add', editingGoalIndex = -1;
let lastBalance = null, lastWealth = null, lastDebt = null, isBalanceHidden = false;
let transactions = [], goals = [], debts = [], budgetsData = {}, assetsData = {}, assets = [];
let weddingData = { budget: [], vendors: [], guests: [] }, currentGuestSort = 'newest';

const nowDt = new Date();
const defaultYM = nowDt.getFullYear() + "-" + String(nowDt.getMonth() + 1).padStart(2, '0');
const getAssetsFor = ym => assetsData[ym] || [];
const getBudgetsFor = ym => budgetsData[ym] || [];
const formatRp = n => isBalanceHidden ? "***.***" : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// ========================================================
// FUNGSI BANTUAN & OVERRIDE
// ========================================================
window.alert = msg => {
  let lower = msg.toLowerCase(), icon = 'info';
  if(lower.includes('sukses') || lower.includes('berhasil') || lower.includes('disimpan')) icon = 'success';
  else if(lower.includes('gagal') || lower.includes('cukup') || lower.includes('valid') || lower.includes('kosong')) icon = 'error';
  else if(lower.includes('lengkapi') || lower.includes('pilih')) icon = 'warning';
  Swal.fire({ text: msg, icon, confirmButtonColor: '#3b82f6', confirmButtonText: 'Siap!', background: '#ffffff', borderRadius: '12px', customClass: { popup: 'swal2-custom-popup' }});
};

const getGreeting = () => { const h = new Date().getHours(); return h < 11 ? "Selamat Pagi" : h < 15 ? "Selamat Siang" : h < 18 ? "Selamat Sore" : "Selamat Malam"; };
const getGreetingIcon = () => { const h = new Date().getHours(); return h < 11 ? "☕" : h < 15 ? "☀️" : h < 18 ? "🌇" : "🌙"; };

// ========================================================
// AUTENTIKASI & INIT
// ========================================================
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user.displayName || user.email.split('@')[0]; currentUid = user.uid;
    loadDataFromFirebase();
  } else {
    document.getElementById("app").innerHTML = `
      <div class="login-wrap"><div class="login-container"><div class="login-left">
      <img src="logo.png" style="width:75px; height:75px; border-radius:18px; margin-bottom:25px; box-shadow:0 4px 10px rgba(0,0,0,0.08);">
      <h1 style="margin:0 0 10px 0; color:#1e293b; font-size:2.2rem; line-height:1.2;">Pro-Tama Finance</h1>
      <p style="color:#64748b; font-size:1.05rem; margin-bottom:20px; line-height:1.5;">Platform manajemen keuangan & aset yang terintegrasi.</p>
      <div class="login-features">
        <div class="feature-item"><i class="fas fa-chart-pie"></i> <span>Pantau Cashflow & Aset Real-time</span></div>
        <div class="feature-item"><i class="fas fa-ring" style="color:#ec4899; background:#fdf2f8;"></i> <span>Wedding Planner Terintegrasi</span></div>
        <div class="feature-item"><i class="fas fa-calculator" style="color:#8b5cf6; background:#f5f3ff;"></i> <span>Kalkulator Saham Pintar</span></div>
      </div></div>
      <div class="login-right"><h2 style="margin:0 0 8px 0; color:#1e293b; font-size:1.8rem;">Selamat Datang! 👋</h2>
      <p style="color:#64748b; margin-bottom:40px;">Silakan masuk untuk mengakses dashboard.</p>
      <button class="login-btn-google" onclick="login()"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:24px;"> Lanjutkan dengan Google</button>
      <div style="margin-top:40px; color:#94a3b8; font-size:0.8rem; display:flex; align-items:center; gap:6px;"><i class="fas fa-shield-alt"></i> Secured by Google Firebase</div>
      </div></div></div>`;
  }
});

const login = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => alert("Gagal login: " + e.message));
const logout = () => auth.signOut().then(() => location.reload());

function loadDataFromFirebase() {
  db.collection("usersData").doc(currentUid).get().then(doc => {
    if (doc.exists) {
      let d = doc.data(); transactions = d.transactions || []; goals = d.goals || []; debts = d.debts || [];
      budgetsData = d.budgetsData || {}; assetsData = d.assetsData || {}; weddingData = d.weddingData || { budget: [], vendors: [], guests: [] }; userProfile = d.userProfile || { fullname: '', phone: '', city: '', job: '' };
    }
    assets = getAssetsFor(defaultYM); document.getElementById("app").innerHTML = mainApp();
    setTimeout(() => { showPage('dashboard'); update(); }, 100);
  }).catch(() => alert("Gagal narik data dari server bro!"));
}

const save = () => currentUid && db.collection("usersData").doc(currentUid).set({ transactions, goals, debts, budgetsData, assetsData, weddingData, userProfile, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

// ========================================================
// RENDER HTML UTAMA
// ========================================================
function mainApp() {
return `
<div class="main-content" style="position: relative; width: 100%; max-width: 100%; margin-left: 0 !important; padding-bottom: 50px;">

<style>@media (max-width: 768px) { #logout-kiri-bawah { display: none !important; opacity: 0 !important; pointer-events: none !important; z-index: -9999 !important; visibility: hidden !important; } }</style>
<button id="logout-kiri-bawah" onclick="logout()" style="position:fixed; bottom:25px; left:25px; background:white; color:#ef4444; border:1px solid #fecaca; padding:12px 20px; border-radius:12px; font-weight:700; cursor:pointer; box-shadow:0 4px 15px rgba(239, 68, 68, 0.12); z-index:9999; display:flex; align-items:center; gap:10px; transition:0.2s ease;" onmouseover="this.style.background='#fef2f2'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='white'; this.style.transform='translateY(0)';"><i class="fas fa-sign-out-alt" style="font-size:1.2rem;"></i> Logout Akun</button>

<div id="notifPanel" class="notif-panel"><div class="notif-header"><span><i class="fas fa-bell" style="color:var(--warning);"></i> Notifikasi</span><i class="fas fa-times" style="color:#94a3b8; cursor:pointer;" onclick="toggleNotif()"></i></div><div id="notifBody" class="notif-body"></div></div>

<div class="mobile-only-header">
   <div style="display:flex; align-items:center; gap:10px;"><img src="logo.png" style="width:35px; height:35px; border-radius:8px; object-fit:cover;"><strong style="font-size:1.2rem; color:#1e293b;">Pro-Tama Apps</strong></div>
   <i class="fas fa-bell" style="font-size:1.4rem; color:#64748b; cursor:pointer;" onclick="toggleNotif()"></i>
</div>

<div class="desktop-global-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid #e2e8f0;">
     <div style="display:flex; align-items:center; gap:15px;">
         <img src="logo.png" style="width:40px; height:40px; border-radius:8px; object-fit:cover; box-shadow:0 2px 4px rgba(0,0,0,0.08);">
         <div onclick="showPage('profil')" style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); cursor:pointer; border:1px solid #e2e8f0; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'"><i class="fas fa-user-circle" style="font-size:1.5rem; color:var(--primary);"></i></div>
         <h2 id="headerGreeting" class="header-title" style="margin:0; font-size:1.4rem; color:#1e293b; display:block;">${getGreeting()}, ${userProfile.fullname || currentUser}! ${getGreetingIcon()}</h2>
     </div>
     <div style="display:flex; align-items:center; gap:12px;">
        <button id="globalBackBtn" onclick="showPage('dashboard')" style="display:none; background:#3b82f6; color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:600; cursor:pointer; transition:0.2s; align-items:center; gap:8px; font-size:0.95rem; box-shadow:0 4px 10px rgba(59, 130, 246, 0.3);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'"><i class="fas fa-chevron-left" style="font-size:0.8rem;"></i> Dashboard</button>
        <div onclick="toggleHideBalance()" style="display:flex; align-items:center; justify-content:center; background:white; padding:10px 14px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); cursor:pointer; border:1px solid #e2e8f0; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'"><i class="fas fa-eye toggle-eye-icon" style="font-size:1.2rem; color:#94a3b8;"></i></div>
        <div class="desktop-bell" onclick="toggleNotif()" style="display:flex; align-items:center; gap:10px; background:white; padding:10px 16px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05); cursor:pointer; border:1px solid #e2e8f0; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'"><i class="fas fa-bell" style="font-size:1.2rem; color:var(--warning);"></i><span style="font-size:0.85rem; font-weight:700; color:#475569;">Notifikasi</span></div>
     </div>
</div>

<div id="dashboard" class="page">
  <div class="mobile-banner"><img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"><div class="mobile-banner-text">Dashboard Pro-Tama Finance</div></div>
  <div class="mobile-menu-grid">
     ${['aset:home:Asetku:#e0f2fe:#0284c7', 'anggaran:file-invoice-dollar:Anggaran:#dcfce7:#16a34a', 'transaksi:exchange-alt:Mutasi:#fef9c3:#ca8a04', 'target:bullseye:Target:#f3e8ff:#9333ea', 'wedding:ring:Wedding:#fce7f3:#db2777', 'hutang:hand-holding-usd:Hutang:#fee2e2:#dc2626', 'kalkulator:calculator:Saham:#e0e7ff:#7c3aed', 'laporan:chart-line:Laporan:#ccfbf1:#0d9488'].map(m => { let [p,i,t,bg,c] = m.split(':'); return `<div class="menu-btn" onclick="showPage('${p}')"><div class="icon-box" style="background:${bg}; color:${c};"><i class="fas fa-${i}"></i></div><span>${t}</span></div>`}).join('')}
  </div>
  <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0; font-size:1.1rem; color:#1e293b;">Ringkasan Keuangan</h3><span style="font-size:0.8rem; color:var(--primary); font-weight:700; cursor:pointer;" onclick="update()">Refresh</span></div>
  <div id="debtReminderContainer"></div>
  <div class="grid-3">
    <div class="card" style="position:relative;"><h3><i class="fas fa-wallet text-primary"></i> Saldo Kas (Liquid)</h3><h2 style="position:relative;">Rp <span id="balance">0</span> <span id="balanceAnim" class="anim-float" style="right:20px; top:25px;"></span></h2></div>
    <div class="card" style="position:relative;"><h3><i class="fas fa-gem text-success"></i> Total Kekayaan Bersih</h3><h2 style="position:relative;">Rp <span id="wealth">0</span> <span id="wealthAnim" class="anim-float" style="right:20px; top:25px;"></span></h2></div>
    <div class="card" style="position:relative;"><h3><i class="fas fa-file-invoice-dollar text-danger"></i> Total Hutang</h3><h2 style="position:relative;">Rp <span id="totalDebtDisplay">0</span> <span id="debtAnim" class="anim-float" style="right:20px; top:25px;"></span></h2></div>
  </div>
  <div class="grid-2">
    <div class="card"><h3>Arus Kas Bulanan</h3><div class="chart-controls"><button onclick="renderMonthlyChart(3)">3 Bulan</button><button onclick="renderMonthlyChart(6)">6 Bulan</button><button onclick="renderMonthlyChart(12)" class="active">1 Tahun</button></div><div class="chart-container"><canvas id="barChart"></canvas></div></div>
    <div class="card"><h3>Alokasi Aset</h3><div class="chart-container" style="display:flex; justify-content:center;"><canvas id="donutChart"></canvas></div></div>
  </div>
</div>

<div id="profil" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Profil Saya</h2></div>
  <div class="card" style="max-width:600px; margin:0 auto;">
    <div style="text-align:center; margin-bottom:30px;"><i class="fas fa-user-circle" style="font-size:5rem; color:#cbd5e1; margin-bottom:10px;"></i><h3 style="margin:0; color:#1e293b;">${currentUser}</h3><p style="color:#64748b; font-size:0.9rem; margin-top:5px;">Akun Google Tertaut</p></div>
    <div class="form-group" style="flex-direction:column; align-items:stretch; gap:15px;">
        ${[['profName','Nama Lengkap','nama lengkap...',userProfile.fullname],['profPhone','No. WhatsApp','0812xxxxxx',userProfile.phone],['profCity','Domisili','Serang, Bekasi...',userProfile.city],['profJob','Instansi/Satker','tempat kerja...',userProfile.job]].map(f => `<div style="display:flex; flex-direction:column; gap:5px;"><label style="font-size:0.85rem; font-weight:700; color:#475569; text-transform:uppercase;">${f[1]}</label><input type="text" id="${f[0]}" placeholder="Masukkan ${f[2]}" value="${f[3] || ''}"></div>`).join('')}
        <button class="action" style="margin-top:15px;" onclick="saveProfile()"><i class="fas fa-save"></i> Simpan Profil</button>
    </div>
  </div>
</div>

<div id="kalkulator" class="page" style="display:none;">
    <div class="card" style="max-width:800px; margin:0 auto; background:#f8fafc; padding:25px;">
      <h3 style="color:#0ea5e9; margin-top:0; margin-bottom:25px; display:flex; align-items:center; gap:10px;"><i class="fas fa-calculator"></i> Average Down Calculator</h3>
      <div style="display:flex; gap:30px; flex-wrap:wrap;">
        <div style="flex:1; min-width:250px; display:flex; flex-direction:column; gap:15px;">
          <div style="background:white; padding:15px; border-radius:8px; border:1px solid #cbd5e1;"><label style="font-size:0.8rem; font-weight:700; color:#64748b;">POSISI AWAL SAAT INI</label><div style="display:flex; gap:10px; margin-top:10px;"><input type="number" id="calcLot1" placeholder="Jumlah Lot" style="flex:1;"><input type="number" id="calcPrice1" placeholder="Harga Beli (Rp)" style="flex:1;"></div></div>
          <div style="background:white; padding:15px; border-radius:8px; border:1px solid #cbd5e1;"><label style="font-size:0.8rem; font-weight:700; color:#64748b;">RENCANA TOP UP</label><div style="display:flex; gap:10px; margin-top:10px;"><input type="number" id="calcLot2" placeholder="Jumlah Lot" style="flex:1;"><input type="number" id="calcPrice2" placeholder="Harga Target (Rp)" style="flex:1;"></div></div>
          <button class="action" onclick="calculateAvg()" style="width:100%; justify-content:center; padding:12px; margin-top:5px;"><i class="fas fa-magic"></i> Hitung Sekarang</button>
        </div>
        <div style="flex:1; min-width:250px; background:#ffffff; padding:25px; border-radius:12px; border:1px solid #cbd5e1; display:flex; flex-direction:column; justify-content:center; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
          <span style="font-size:0.85rem; color:#64748b; font-weight:700; text-transform:uppercase;">Average Baru Anda</span><h2 id="resAvg" style="color:#0ea5e9; font-size:2.4rem; margin:5px 0 25px 0;">Rp 0</h2>
          <div style="display:flex; justify-content:space-between; border-top:1px solid #f1f5f9; padding-top:15px;">
              <div><span style="font-size:0.75rem; color:#64748b; font-weight:600;">TOTAL LOT</span><div id="resLot" style="font-weight:bold; font-size:1.1rem; color:#1e293b; margin-top:4px;">0 Lot</div></div>
              <div style="text-align:right;"><span style="font-size:0.75rem; color:#64748b; font-weight:600;">MODAL TAMBAHAN</span><div id="resFunds" style="color:#ef4444; font-weight:bold; font-size:1.1rem; margin-top:4px;">Rp 0</div></div>
          </div>
        </div>
      </div>
    </div>
</div>

<div id="laporan" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Laporan Analytics</h2><div class="month-picker-capsule" onclick="try{document.getElementById('lapMonthFilter').showPicker()}catch(e){}"><i class="fas fa-calendar-alt"></i> <span id="lapMonthLabel">Pilih Bulan</span><input type="month" id="lapMonthFilter" onchange="renderLaporan()" oninput="renderLaporan()"></div></div>
  <div class="grid-3" id="laporanSummary"></div>
  <div class="card" style="margin-top:20px;"><h3 style="margin-bottom:15px; color:#475569;">Top 5 Pengeluaran Terbesar</h3><div id="topExpenses" style="display:flex; flex-direction:column; gap:10px;"></div></div>
</div>

<div id="transaksi" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Mutasi Keuangan</h2></div>
  <div class="card">
    <div class="form-group">
      <select id="type" style="flex:0.5; min-width:180px;" onchange="handleTypeChange()"><option value="income">Pemasukan 📈</option><option value="expense">Pengeluaran 📉</option><option value="beli_aset">Beli Saham/Aset 🛒</option><option value="jual_aset">Jual Saham/Aset 💰</option><option value="transfer">Transfer Bank 🔄</option></select>
      <select id="walletSelect" style="flex:1;"><option value="">-- Rekening Sumber --</option></select>
      <select id="assetTargetSelect" style="flex:1; display:none;"><option value="">-- Target Aset --</option></select>
      <select id="trxCategory" style="flex:1;" onchange="handleTrxCategoryChange()"></select>
      <select id="trxSubCategory" style="flex:1; display:none;"></select>
      <input type="text" id="customTrxCategory" placeholder="Ketik kategori baru..." style="flex:1; display:none;">
      <input type="number" id="amount" placeholder="Nominal (Rp)">
      <input type="text" id="desc" placeholder="Keterangan">
      <input type="date" id="date" onchange="updateDropdowns()">
      <button class="action" onclick="addTransaction()"><i class="fas fa-plus"></i> Proses</button>
    </div>
  </div>
  <div class="card" style="overflow-x:auto;"><table style="min-width:100%;"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Nominal</th><th style="width:80px; text-align:center;">Aksi</th></tr></thead><tbody id="trxList"></tbody></table></div>
</div>

<div id="anggaran" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Anggaran Bulanan</h2><div class="month-picker-capsule" onclick="try{document.getElementById('budgetMonthFilter').showPicker()}catch(e){}"><i class="fas fa-calendar-alt"></i> <span id="budgetMonthLabel">Pilih Bulan</span><input type="month" id="budgetMonthFilter" onchange="update()" oninput="update()"></div></div>
  <div id="budgetStatusCard" class="card" style="background:#f0f9ff; border:1px solid #bae6fd; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
    <div style="flex:1; min-width:250px;"><h3 id="budgetCardTitle" style="color:var(--primary-dark); margin-bottom:5px;">Budgeting</h3><p style="margin:0; font-size:0.9rem; color:#64748b;">Target yang belum dibayar vs Saldo Kas saat ini.</p></div>
    <div style="text-align:right; background:white; padding:10px 20px; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);"><h2 id="budgetVsLiquid" style="margin:0; font-size:1.8rem;">Rp 0 / Rp 0</h2></div>
  </div>
  <div class="card"><div class="form-group"><select id="budgetCategory" style="flex:1;" onchange="handleBudgetCategoryChange()"></select><input type="text" id="customBudgetCategory" placeholder="Ketik kategori baru..." style="flex:1; display:none;"><input type="number" id="budgetAmount" placeholder="Batas Maksimal (Rp)" style="flex:1;"><button class="action" onclick="addBudget()"><i class="fas fa-plus"></i> Set Anggaran</button></div></div>
  <div class="grid-2" id="budgetList"></div>
</div>

<div id="aset" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Detail Aset & Portofolio</h2><div class="month-picker-capsule" onclick="try{document.getElementById('assetMonthFilter').showPicker()}catch(e){}"><i class="fas fa-calendar-alt"></i> <span id="assetMonthLabel">Pilih Bulan</span><input type="month" id="assetMonthFilter" onchange="update()" oninput="update()"></div></div>
  <div class="card"><div class="form-group"><select id="assetType" style="flex:0.5; min-width:200px;" onchange="handleAssetTypeChange()"><option value="rekening">Rekening Bank/RDN 💳</option><option value="saham">Saham 📈</option><option value="emas">Emas 🏅</option><option value="bergerak">Aset Bergerak 🚗</option><option value="nonbergerak">Aset Tetap 🏠</option></select><input id="assetName" placeholder="Nama (Misal: Saham INET)"><input type="number" id="assetLot" placeholder="Jml Lot" style="display:none; flex:0.5;"><input type="number" id="assetAvg" placeholder="Avg Beli (Rp)" step="any" style="display:none; flex:0.5;"><input type="number" id="assetValue" placeholder="Nilai Awal / Saldo (Rp)" step="any"><button class="action" onclick="addAsset()"><i class="fas fa-plus"></i> Tambah Aset</button></div></div>
  <h3 style="margin-bottom:15px; color:#475569; font-size:1.1rem; padding:0 10px;">Daftar Aset & Portofolio</h3><div id="assetListContainer"></div>
</div>

<div id="target" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Target & Impian</h2></div>
  <div class="card"><div class="form-group"><input id="goalName" placeholder="Nama Target" style="flex:1;"><input type="number" id="goalValue" placeholder="Nominal (Rp)" style="flex:1;"><button id="btnSelectSource" class="action" style="flex:1; background:#f8fafc; color:#1e293b; border:1px solid #cbd5e1; box-shadow:none;" onclick="openSourceModal('add')"><i class="fas fa-layer-group"></i> Semua Saldo Kas</button><button class="action" onclick="addGoal()"><i class="fas fa-plus"></i> Simpan Target</button></div></div>
  <div class="grid-2" id="goalList"></div>
</div>

<div id="wedding" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title" style="display:flex; align-items:center; gap:10px;"><i class="fas fa-ring" style="color:#f472b6;"></i> Wedding Planner</h2></div>
  <div class="wedding-tab"><button id="wed-tab-budget" class="active" onclick="switchWedTab('budget')">Budgeting</button><button id="wed-tab-vendor" onclick="switchWedTab('vendor')">Vendor Tracker</button><button id="wed-tab-guest" onclick="switchWedTab('guest')">Guest List</button></div>
  <div id="wed-content-budget" class="wed-content">
      <div class="card" style="background:#eff6ff; border-color:#bfdbfe; margin-bottom:15px;"><h3 style="margin:0; color:#1d4ed8; display:flex; justify-content:space-between; align-items:center;"><span><i class="fas fa-bullseye"></i> Patokan Maksimal:</span><strong id="wedMaxBudget" style="font-size:1.5rem;">Rp 0</strong></h3></div>
      <div class="card"><div class="form-group"><input id="wedBudgetItem" placeholder="Item (Catering, dll)" style="flex:1;"><input type="number" id="wedBudgetTarget" placeholder="Alokasi (Rp)" style="flex:1;"><input id="wedBudgetNotes" placeholder="Keterangan / Link Toko" style="flex:1.5;"><button class="action" onclick="addWedBudget()"><i class="fas fa-plus"></i> Tambah</button></div></div>
      <div id="wedBudgetContainer"></div>
  </div>
  <div id="wed-content-vendor" class="wed-content" style="display:none;">
      <div class="card"><div class="form-group"><input id="wedVendorName" placeholder="Nama Vendor" style="flex:1;"><input id="wedVendorService" placeholder="Layanan" style="flex:1;"><select id="wedVendorStatus" style="flex:0.5;"><option value="Tanya">Baru Nanya/Survei</option><option value="DP">Sudah DP</option><option value="Lunas">Lunas</option></select><button class="action" onclick="addWedVendor()"><i class="fas fa-plus"></i> Tambah Vendor</button></div></div>
      <div class="card" style="overflow-x:auto;"><table style="min-width:100%;"><thead><tr><th>Nama Vendor</th><th>Layanan</th><th>Status</th><th style="width:100px; text-align:center;">Aksi</th></tr></thead><tbody id="wedVendorTbody"></tbody></table></div>
  </div>
  <div id="wed-content-guest" class="wed-content" style="display:none;">
      <div class="card" style="background:#f0fdf4; border-color:#bbf7d0; margin-bottom:15px;"><h3 style="margin:0; color:#15803d; display:flex; justify-content:space-between; align-items:center;"><span>Total Tamu Diundang:</span><div style="text-align:right;"><strong id="wedTotalGuests" style="font-size:1.5rem;">0 Orang</strong><div style="margin-top:8px;"><button class="btn-success" onclick="exportGuestsToCSV()" style="font-size:0.8rem; padding:6px 12px;"><i class="fas fa-file-excel"></i> Download Excel</button></div></div></h3></div>
      <div class="card"><div class="form-group"><input id="wedGuestName" placeholder="Nama Tamu" style="flex:1.5;"><input id="wedGuestCity" placeholder="Kota" style="flex:1;"><select id="wedGuestType" style="flex:0.5;"><option value="Keluarga Pria">Keluarga Pria</option><option value="Keluarga Wanita">Keluarga Wanita</option><option value="VIP">VIP</option><option value="Reguler">Reguler</option></select><input type="number" id="wedGuestCount" placeholder="Jml Orang" style="flex:0.5;" value="1"><button class="action" onclick="addWedGuest()"><i class="fas fa-plus"></i> Tambah Tamu</button></div></div>
      <div style="display:flex; justify-content:flex-end; margin-bottom:15px;"><select id="guestSortSelect" onchange="changeGuestSort(this.value)" style="padding:8px 15px; border-radius:8px; border:1px solid #cbd5e1; background:white; font-weight:600;"><option value="newest">Urutkan: Paling Baru</option><option value="name">Urutkan: Abjad (A-Z)</option><option value="city">Urutkan: Kota (A-Z)</option></select></div>
      ${[['Pria','#3b82f6','mars'],['Wanita','#ec4899','venus'],['VIP','#eab308','star'],['Reguler','#94a3b8','users']].map(t => `<div class="card" style="overflow-x:auto; margin-bottom:20px; border-top:4px solid ${t[1]};"><h4 style="margin-top:0; display:flex; align-items:center; gap:8px; color:${t[1]}"><i class="fas fa-${t[2]}"></i> Daftar Tamu ${t[0]}</h4><table style="min-width:100%;"><thead><tr><th>Nama Tamu</th><th>Kota</th><th>Jumlah (Pax)</th><th>Undangan</th><th>Kehadiran</th><th style="text-align:center;">Aksi</th></tr></thead><tbody id="wedGuestTbody${t[0]}"></tbody></table></div>`).join('')}
  </div>
</div>

<div id="hutang" class="page" style="display:none;">
  <div class="header-with-picker"><h2 class="header-title">Manajemen Hutang & Cicilan</h2></div>
  <div class="card"><div class="form-group"><input id="debtName" placeholder="Nama Hutang" style="flex:1.5;"><input type="number" id="debtAmount" placeholder="Total Hutang (Rp)" style="flex:1;"><div style="display:flex; align-items:center; border:1px solid #cbd5e1; border-radius:8px; background:white; padding-right:10px; flex:1;"><input type="date" id="debtDate" title="Jatuh Tempo per Bulan" style="border:none; width:100%;"></div><button class="action" onclick="addDebt()"><i class="fas fa-plus"></i> Catat Hutang</button></div></div>
  <div class="card" style="overflow-x:auto;"><table style="min-width:100%;"><thead><tr><th>Nama/Keterangan</th><th>Total Pinjaman</th><th>Sisa Tagihan</th><th style="width:150px; text-align:center;">Aksi</th></tr></thead><tbody id="debtList"></tbody></table></div>
</div>

<div id="sourceModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
  <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:450px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h3 style="margin:0; font-size:1.3rem;">Pilih Sumber Dana</h3><button onclick="closeSourceModal()" style="background:none; border:none; font-size:1.2rem; color:#94a3b8; cursor:pointer;"><i class="fas fa-times"></i></button></div>
    <label style="display:flex; align-items:center; gap:12px; margin-bottom:20px; font-weight:700; padding:15px; border-radius:8px; background:#f0f9ff; border:1px solid #bae6fd; cursor:pointer;"><input type="checkbox" id="selectAllSources" style="width:20px; height:20px; cursor:pointer;" onchange="toggleSelectAllSources()"><span style="color:var(--primary-dark); font-size:1.05rem;">Pilih Semua Aset</span></label>
    <div id="sourceCheckboxes" style="overflow-y:auto; flex:1; padding-right:5px; display:flex; flex-direction:column; gap:10px;"></div>
    <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:25px; padding-top:20px; border-top:1px solid var(--border);"><button class="btn-danger" style="padding:12px 24px; font-weight:600;" onclick="closeSourceModal()">Batal</button><button class="btn-success" style="padding:12px 24px; font-weight:600; background:var(--primary);" onclick="saveSourceSelection()">Simpan Pilihan</button></div>
  </div>
</div>
</div>

<div class="bottom-nav">
  <div class="nav-item active" id="botnav-dashboard" onclick="showPage('dashboard')"><i class="fas fa-home"></i><span>Beranda</span></div>
  <div class="nav-item" id="botnav-transaksi" onclick="showPage('transaksi')"><i class="fas fa-file-invoice"></i><span>Transaksi</span></div>
  <div class="nav-item" id="botnav-profil" onclick="showPage('profil')"><i class="fas fa-user-circle"></i><span>Profil</span></div>
</div>`;
}

// ========================================================
// NAVIGASI, UI & UPDATE
// ========================================================
function showPage(p){
  document.querySelectorAll(".page").forEach(x => x.style.display="none"); document.getElementById(p).style.display="block";
  document.querySelectorAll(".bottom-nav .nav-item").forEach(btn => btn.classList.remove("active"));
  if(document.getElementById("botnav-" + p)) document.getElementById("botnav-" + p).classList.add("active");
  let bb = document.getElementById("globalBackBtn"), ht = document.getElementById("headerGreeting");
  if(bb && ht) { bb.style.display = p === 'dashboard' ? 'none' : 'flex'; ht.style.display = p === 'dashboard' ? 'block' : 'none'; }
  if (p === 'wedding') renderWedding(); if (p === 'laporan') renderLaporan();
  update();
}

function saveProfile() {
    ['fullname','phone','city','job'].forEach(k => userProfile[k] = document.getElementById(k === 'fullname' ? 'profName' : 'prof' + k.charAt(0).toUpperCase() + k.slice(1)).value);
    save(); alert('Profil berhasil disimpan!');
    const h2 = document.getElementById('headerGreeting'); if(h2) h2.innerHTML = `${getGreeting()}, ${userProfile.fullname || currentUser}! ${getGreetingIcon()}`;
}

const toggleHideBalance = () => { isBalanceHidden = !isBalanceHidden; document.querySelectorAll(".toggle-eye-icon").forEach(i => { i.className = isBalanceHidden ? "fas fa-eye-slash toggle-eye-icon" : "fas fa-eye toggle-eye-icon"; i.style.color = isBalanceHidden ? "#3b82f6" : "#94a3b8"; }); update(); };
const toggleNotif = () => { const el = document.getElementById('notifPanel'); if(el.style.display === 'block') el.style.display = 'none'; else { renderNotifs(); el.style.display = 'block'; } };

function renderNotifs() {
    let html = "", today = new Date(), ym = defaultYM;
    let recInc = transactions.filter(t => t.type === 'income' && t.date.startsWith(ym)).sort((a,b) => new Date(b.date) - new Date(a.date));
    if(recInc.length) html += `<div class="notif-item success"><i class="fas fa-check-circle" style="color:#22c55e;"></i><div><strong>Pemasukan Masuk!</strong><br><span style="color:#64748b;">${recInc[0].desc} (${formatRp(recInc[0].amount)})</span></div></div>`;
    debts.filter(d => d.remaining > 0).forEach(d => {
        let diff = parseInt(d.date.split('-')[2]) - today.getDate();
        if(!isNaN(diff) && !transactions.some(t => t.type === 'expense' && t.desc.toLowerCase().includes(d.name.toLowerCase()) && t.date.startsWith(ym))) {
            if(diff <= 0) html += `<div class="notif-item danger"><i class="fas fa-exclamation-circle" style="color:#ef4444;"></i><div><strong>Cicilan Jatuh Tempo!</strong><br><span style="color:#64748b;">Bayar ${d.name} (${formatRp(d.remaining)}).</span></div></div>`;
            else if(diff <= 5) html += `<div class="notif-item warning"><i class="fas fa-clock" style="color:#eab308;"></i><div><strong>H-${diff} Jatuh Tempo</strong><br><span style="color:#64748b;">Siapin dana buat ${d.name}.</span></div></div>`;
        }
    });
    getBudgetsFor(ym).forEach(b => {
        let pct = (transactions.filter(t => t.date.startsWith(ym) && t.type === 'expense' && t.category === b.category).reduce((a,c)=>a+c.amount,0) / b.amount) * 100;
        if(pct >= 100) html += `<div class="notif-item danger"><i class="fas fa-times-circle" style="color:#ef4444;"></i><div><strong>Overbudget: ${b.category}</strong><br><span style="color:#64748b;">Tembus 100%!</span></div></div>`;
        else if(pct >= 80) html += `<div class="notif-item warning"><i class="fas fa-exclamation-triangle" style="color:#eab308;"></i><div><strong>Warning Budget: ${b.category}</strong><br><span style="color:#64748b;">Udah ${pct.toFixed(0)}%.</span></div></div>`;
    });
    document.getElementById('notifBody').innerHTML = html || `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.85rem;">Belum ada notifikasi baru bro. ☕</div>`;
}

// ========================================================
// CORE LOGIC: TRANSACTIONS, ASSETS, BUDGETS
// ========================================================
function handleTypeChange() {
  let type = document.getElementById("type").value, ast = document.getElementById("assetTargetSelect"), tCat = document.getElementById("trxCategory"), cCat = document.getElementById("customTrxCategory");
  ast.style.display = ['beli_aset','jual_aset','transfer'].includes(type) ? "block" : "none"; tCat.style.display = ['income','expense'].includes(type) ? "block" : "none";
  if (!['income','expense'].includes(type)) cCat.style.display = "none"; else handleTrxCategoryChange(); updateDropdowns();
}
function handleTrxCategoryChange() {
  let val = document.getElementById("trxCategory").value, cCat = document.getElementById("customTrxCategory"), subSel = document.getElementById("trxSubCategory");
  cCat.style.display = val === 'Lainnya' ? 'block' : 'none'; subSel.style.display = 'none';
  if(val !== 'Lainnya' && document.getElementById("type").value === 'expense') {
      let b = getBudgetsFor((document.getElementById("date").value || defaultYM).substring(0,7)).find(b => b.category === val);
      if(b && b.subBudgets?.length) { subSel.innerHTML='<option value="">-- Pilih Sub (Opsional) --</option>'+b.subBudgets.map(s=>`<option value="${s.name}">${s.name}</option>`).join(''); subSel.style.display='block'; }
  }
}
const handleBudgetCategoryChange = () => document.getElementById("customBudgetCategory").style.display = document.getElementById("budgetCategory").value === 'Lainnya' ? 'block' : 'none';
function handleAssetTypeChange() {
  let type = document.getElementById("assetType").value, lot = document.getElementById("assetLot"), avg = document.getElementById("assetAvg"), val = document.getElementById("assetValue");
  lot.style.display = avg.style.display = type === 'saham' ? "block" : "none"; val.placeholder = type === 'saham' ? "Harga Saat Ini/Lembar" : "Nilai Awal/Saldo";
}

function updateDropdowns() {
  let type = document.getElementById("type")?.value, ws = document.getElementById("walletSelect"), as = document.getElementById("assetTargetSelect");
  let ym = (document.getElementById("date")?.value || defaultYM).substring(0, 7), tA = getAssetsFor(ym);
  if(ws && as && type) {
    ws.innerHTML = `<option value="">-- Sumber Dana (${ym}) --</option>`; as.innerHTML = `<option value="">-- Ke ${type==='transfer'?'Rekening':'Aset'} --</option>`;
    tA.forEach((a, i) => { if(a.type==='rekening'){ ws.innerHTML+=`<option value="${i}">${a.name} (${formatRp(a.value)})</option>`; if(type==='transfer')as.innerHTML+=`<option value="${i}">${a.name}</option>`; } else if(type!=='transfer') as.innerHTML+=`<option value="${i}">${a.name}</option>`; });
  }
  let defExp = ["Kebutuhan Pokok", "Transportasi", "Cicilan / Tagihan", "Hiburan / Ngedate"], defInc = ["Gaji Pokok", "Tunjangan / Bonus", "Dividen", "Jual Aset", "Lainnya"], exExp = [], exInc = [];
  transactions.forEach(t => { if(t.category && !["Tanpa Kategori","Lainnya"].includes(t.category)) { if(t.type==='expense'&&!defExp.includes(t.category)&&!exExp.includes(t.category))exExp.push(t.category); else if(t.type==='income'&&!defInc.includes(t.category)&&!exInc.includes(t.category))exInc.push(t.category); }});
  Object.values(budgetsData).forEach(m => m.forEach(b => { if(!defExp.includes(b.category) && !exExp.includes(b.category)) exExp.push(b.category); }));
  
  let tc = document.getElementById("trxCategory"); if(tc && type) { let c=tc.value; tc.innerHTML = '<option value="Tanpa Kategori">-- Pilih Kategori --</option>'+ (type==='income'?[...defInc,...exInc]:[...defExp,...exExp]).map(x=>`<option value="${x}">${x}</option>`).join('')+'<option value="Lainnya">Lainnya (Ketik Sendiri)</option>'; if(Array.from(tc.options).map(o=>o.value).includes(c)) tc.value=c; }
  let bc = document.getElementById("budgetCategory"); if(bc) { let c=bc.value; bc.innerHTML = [...defExp,...exExp].map(x=>`<option value="${x}">${x}</option>`).join('')+'<option value="Lainnya">Lainnya (Ketik Sendiri)</option>'; if(Array.from(bc.options).map(o=>o.value).includes(c)) bc.value=c; }
  handleTrxCategoryChange();
}

function addTransaction(){
  let amt = parseInt(document.getElementById("amount").value), desc = document.getElementById("desc").value, date = document.getElementById("date").value || new Date().toISOString().split('T')[0];
  let type = document.getElementById("type").value, wIdx = document.getElementById("walletSelect").value, aIdx = document.getElementById("assetTargetSelect").value;
  let cat = document.getElementById("trxCategory").value; if(cat==='Lainnya') { cat=document.getElementById("customTrxCategory").value; if(!cat) return alert("Isi kategori baru!"); }
  let subE = document.getElementById("trxSubCategory"), sub = (subE.style.display!=='none' && subE.value!=="") ? subE.value : null;
  if(!amt || !desc || wIdx==="") return alert("Lengkapi data!");
  wIdx=parseInt(wIdx); let ym = date.substring(0,7), tA = assetsData[ym]; if(!tA) return alert("Aset kosong bulan ini. Salin dulu di menu Aset!");
  
  if(type==="income") tA[wIdx].value += amt;
  else if(type==="expense") { if(tA[wIdx].value<amt) return alert("Saldo ga cukup!"); tA[wIdx].value -= amt; }
  else {
      if(aIdx==="") return alert("Pilih target!"); aIdx=parseInt(aIdx);
      if(type==="beli_aset"||type==="transfer") { if(tA[wIdx].value<amt) return alert("Saldo kas ga cukup!"); tA[wIdx].value-=amt; tA[aIdx].value+=amt; }
      else if(type==="jual_aset") { tA[aIdx].value-=amt; tA[wIdx].value+=amt; }
  }
  transactions.push({ id:Date.now(), amount:amt, desc, date, type, walletName:tA[wIdx].name, category: ['expense','income'].includes(type)?cat:null, subCategory:sub });
  ['amount','desc','customTrxCategory','trxSubCategory'].forEach(id => document.getElementById(id).value = ""); document.getElementById("customTrxCategory").style.display = "none"; document.getElementById("trxSubCategory").style.display = "none";
  save(); update();
}
const deleteTransaction = i => { if(confirm("Hapus? Aset revisi manual!")) { transactions.splice(i,1); save(); update(); }};

// --- ASET ---
function addAsset(){
  let n = document.getElementById("assetName").value, v = parseFloat(document.getElementById("assetValue").value), t = document.getElementById("assetType").value, nd = {name:n, value:v, type:t};
  if(!n || isNaN(v)) return alert("Isi nama & nominal!");
  if(t==='saham') { let l=parseInt(document.getElementById("assetLot").value), a=parseFloat(document.getElementById("assetAvg").value); if(isNaN(l)||isNaN(a)) return alert("Isi Lot & Avg!"); nd.lot=l; nd.avg=a; nd.value=v*l*100; }
  let ym = document.getElementById("assetMonthFilter")?.value || defaultYM; if(!assetsData[ym]) assetsData[ym] = []; assetsData[ym].push(nd);
  ['assetName','assetValue','assetLot','assetAvg'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value=""; }); save(); update();
}
function updateStockValue(i) {
  let ym = document.getElementById("assetMonthFilter")?.value || defaultYM, a = assetsData[ym][i];
  if(a.type==='saham' && a.lot) {
      let p = prompt(`Harga saham ${a.name}/lembar.\nSekarang: Rp ${a.value/(a.lot*100)}\nLot: ${a.lot}\nAvg: Rp ${a.avg||0}`, a.value/(a.lot*100));
      if(p) { p=parseFloat(p.replace(/,/g,'.')); if(p>=0) { a.value=p*a.lot*100; save(); update(); }}
  } else {
      let v = prompt(`Update nominal ${a.name}:`, a.value);
      if(v) { v=parseFloat(v.replace(/,/g,'.')); if(v>=0) { a.value=v; save(); update(); }}
  }
}
const deleteAsset = i => { if(confirm("Hapus aset?")) { let ym=document.getElementById("assetMonthFilter")?.value||defaultYM; assetsData[ym].splice(i,1); save(); update(); }};
const copyPreviousMonthAssets = () => { let ym=document.getElementById("assetMonthFilter")?.value||defaultYM, pM=Object.keys(assetsData).sort().filter(m=>m<ym); if(!pM.length) return alert("Data kosong!"); assetsData[ym]=JSON.parse(JSON.stringify(assetsData[pM[pM.length-1]])); save(); update(); };

// --- HUTANG & BUDGET ---
const addDebt = () => { let n=document.getElementById("debtName").value, a=parseInt(document.getElementById("debtAmount").value), d=document.getElementById("debtDate").value||new Date().toISOString().split('T')[0]; if(!n||isNaN(a)) return alert("Isi data!"); debts.push({name:n,total:a,remaining:a,date:d}); ['debtName','debtAmount'].forEach(id=>document.getElementById(id).value=""); save(); update(); };
const deleteDebt = i => { if(confirm("Hapus?")) { debts.splice(i,1); save(); update(); }};
function payDebt(i) {
  let rks = getAssetsFor(defaultYM).map((a,idx)=>a.type==='rekening'?{idx,n:a.name,v:a.value}:null).filter(Boolean); if(!rks.length) return alert("Buat Rekening dulu!");
  let amt = prompt(`Sisa hutang: ${formatRp(debts[i].remaining)}. Bayar berapa?`); if(!amt) return; amt = parseInt(amt.replace(/\D/g,'')); if(isNaN(amt)) return; amt=Math.min(amt, debts[i].remaining);
  let c = prompt(`Pilih rek (angka):\n`+rks.map((r,x)=>`${x+1}. ${r.n} (${formatRp(r.v)})`).join('\n'), "1"); if(!c) return; c=parseInt(c); if(c<1||c>rks.length) return;
  let sel = rks[c-1].idx; if(getAssetsFor(defaultYM)[sel].value < amt) return alert("Saldo ga cukup!");
  getAssetsFor(defaultYM)[sel].value -= amt; debts[i].remaining -= amt;
  transactions.push({ id:Date.now(), amount:amt, desc:"Bayar: "+debts[i].name, date:new Date().toISOString().split('T')[0], type:"expense", walletName:getAssetsFor(defaultYM)[sel].name, category:"Cicilan / Tagihan" });
  alert(`Sukses bayar Rp ${amt.toLocaleString('id-ID')} dari ${getAssetsFor(defaultYM)[sel].name}`); save(); update();
}

const addBudget = () => { let c=document.getElementById("budgetCategory").value; if(c==='Lainnya'){c=document.getElementById("customBudgetCategory").value; if(!c)return alert("Isi kategori!");} let a=parseInt(document.getElementById("budgetAmount").value); if(isNaN(a))return alert("Isi batas!"); let ym=document.getElementById("budgetMonthFilter")?.value||defaultYM; if(!budgetsData[ym]) budgetsData[ym]=[]; let ex=budgetsData[ym].findIndex(b=>b.category===c); if(ex>-1)budgetsData[ym][ex].amount=a; else budgetsData[ym].push({category:c,amount:a}); document.getElementById("budgetAmount").value=""; document.getElementById("customBudgetCategory").style.display="none"; save(); update();};
const deleteBudget = (ym,i) => { if(confirm("Hapus?")) { budgetsData[ym].splice(i,1); save(); update(); }};
const copyPreviousMonthBudgets = () => { let ym=document.getElementById("budgetMonthFilter")?.value||defaultYM, pM=Object.keys(budgetsData).sort().filter(m=>m<ym); if(!pM.length) return alert("Kosong!"); budgetsData[ym]=JSON.parse(JSON.stringify(budgetsData[pM[pM.length-1]])); save(); update(); };
const addSubBudget = (ym,i) => { let n=prompt("Sub kategori:"); if(!n)return; let a=parseInt((prompt(`Batas untuk ${n} (Rp):`)||'').replace(/\D/g,'')); if(isNaN(a)||a<=0)return; if(!budgetsData[ym][i].subBudgets)budgetsData[ym][i].subBudgets=[]; if(budgetsData[ym][i].subBudgets.reduce((s,c)=>s+c.amount,0)+a>budgetsData[ym][i].amount) return alert("Melebihi batas induk!"); budgetsData[ym][i].subBudgets.push({name:n,amount:a}); save(); update();};
const deleteSubBudget = (ym,bi,si) => { if(confirm("Hapus sub?")){budgetsData[ym][bi].subBudgets.splice(si,1); save(); update();} };

// --- TARGET & MODAL ---
const openSourceModal = (m,i) => { currentSourceMode=m; editingGoalIndex=i; let cb=document.getElementById("sourceCheckboxes"), sel=m==='add'?tempSelectedSources:(goals[i].source||['all_liquid']), all=sel.includes('all_liquid'), cAll=true; cb.innerHTML=''; getAssetsFor(defaultYM).forEach(a=>{let chk=all?(a.type==='rekening'):sel.includes(a.name); if(!chk)cAll=false; cb.innerHTML+=`<label style="display:flex; gap:15px; padding:12px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer;"><input type="checkbox" class="source-cb" value="${a.name}" ${chk?'checked':''} onchange="checkIndividualSource()"> <div style="flex:1; display:flex; justify-content:space-between;"><strong>${a.name}</strong><span>${formatRp(a.value)}</span></div></label>`;}); document.getElementById("selectAllSources").checked=cAll&&getAssetsFor(defaultYM).length>0; document.getElementById("sourceModal").style.display="flex";};
const toggleSelectAllSources = () => { let c=document.getElementById("selectAllSources").checked; document.querySelectorAll(".source-cb").forEach(cb=>cb.checked=c); };
const checkIndividualSource = () => document.getElementById("selectAllSources").checked = Array.from(document.querySelectorAll(".source-cb")).every(cb=>cb.checked);
const closeSourceModal = () => document.getElementById("sourceModal").style.display="none";
const saveSourceSelection = () => { let s=Array.from(document.querySelectorAll(".source-cb:checked")).map(cb=>cb.value); if(!s.length) return alert("Pilih minimal 1!"); if(currentSourceMode==='add'){tempSelectedSources=s; document.getElementById("btnSelectSource").innerHTML=`<i class="fas fa-layer-group"></i> ${s.length===getAssetsFor(defaultYM).length?'Semua Saldo':s.length+' Sumber'}`;}else{goals[editingGoalIndex].source=s; save(); update();} closeSourceModal();};
const addGoal = () => { let n=document.getElementById("goalName").value, v=parseInt(document.getElementById("goalValue").value); if(!n||isNaN(v))return alert("Isi data!"); goals.push({name:n,target:v,source:tempSelectedSources}); document.getElementById("goalName").value=""; document.getElementById("goalValue").value=""; tempSelectedSources=['all_liquid']; document.getElementById("btnSelectSource").innerHTML='<i class="fas fa-layer-group"></i> Semua Kas'; save(); update();};
const deleteGoal = i => { if(confirm("Hapus?")){goals.splice(i,1); save(); update();} };
const editGoal = i => { let n=prompt("Ubah nama:",goals[i].name); if(!n)return; let v=parseInt(prompt("Ubah nominal:",goals[i].target)); if(v>0){goals[i].name=n; goals[i].target=v; save(); update();}};

// --- WEDDING PLANNER ---
const switchWedTab = t => { document.querySelectorAll('.wedding-tab button').forEach(b=>b.classList.remove('active')); document.getElementById('wed-tab-'+t).classList.add('active'); document.querySelectorAll('.wed-content').forEach(c=>c.style.display='none'); document.getElementById('wed-content-'+t).style.display='block'; };
const addWedBudget = () => { let n=document.getElementById("wedBudgetItem").value, t=parseInt(document.getElementById("wedBudgetTarget").value), nt=document.getElementById("wedBudgetNotes").value, g=goals.find(x=>x.name.toLowerCase().includes('nikah')), max=g?g.target:0; if(!n||isNaN(t))return alert("Isi data!"); if(max>0 && weddingData.budget.reduce((s,b)=>s+b.target,0)+t>max) return alert("Melebihi Patokan Impian!"); weddingData.budget.push({id:Date.now(),name:n,target:t,real:0,notes:nt,subItems:[]}); ['wedBudgetItem','wedBudgetTarget','wedBudgetNotes'].forEach(id=>document.getElementById(id).value=""); save(); renderWedding();};
const deleteWedBudget = id => { if(confirm("Hapus?")) { weddingData.budget=weddingData.budget.filter(b=>b.id!==id); save(); renderWedding(); }};
const updateWedBudgetReal = id => { let i=weddingData.budget.find(b=>b.id===id); if(i.subItems?.length) return alert("Update via Sub-Item!"); let r=prompt("Realisasi (Rp):",i.real); if(r){r=parseInt(r.replace(/\D/g,'')); if(!isNaN(r)){i.real=r; save(); renderWedding();}}};
const addWedSubItem = id => { let i=weddingData.budget.find(b=>b.id===id), n=prompt("Nama Sub:"); if(!n)return; let t=parseInt((prompt("Alokasi (Rp):")||'').replace(/\D/g,'')); if(!t)return; if(!i.subItems)i.subItems=[]; if(i.subItems.reduce((s,x)=>s+x.target,0)+t>i.target) return alert("Lebih dari Induk!"); i.subItems.push({id:Date.now(),name:n,target:t,real:0,notes:prompt("Keterangan/Link:")||""}); save(); renderWedding();};
const updateWedSubItemReal = (id,sId) => { let i=weddingData.budget.find(b=>b.id===id), s=i.subItems.find(x=>x.id===sId), r=prompt("Realisasi (Rp):",s.real||0); if(r){r=parseInt(r.replace(/\D/g,'')); if(!isNaN(r)){s.real=r; i.real=i.subItems.reduce((a,c)=>a+(c.real||0),0); save(); renderWedding();}}};
const deleteWedSubItem = (id,sId) => { if(confirm("Hapus sub?")) { let i=weddingData.budget.find(b=>b.id===id); i.subItems=i.subItems.filter(s=>s.id!==sId); i.real=i.subItems.reduce((a,c)=>a+(c.real||0),0); save(); renderWedding(); }};
const addWedVendor = () => { let n=document.getElementById('wedVendorName').value, s=document.getElementById('wedVendorService').value, st=document.getElementById('wedVendorStatus').value; if(!n||!s)return; weddingData.vendors.push({id:Date.now(),name:n,service:s,status:st}); ['wedVendorName','wedVendorService'].forEach(id=>document.getElementById(id).value=""); save(); renderWedding();};
const deleteWedVendor = id => { if(confirm("Hapus?")) { weddingData.vendors=weddingData.vendors.filter(v=>v.id!==id); save(); renderWedding(); }};
const toggleWedVendorStatus = id => { let v=weddingData.vendors.find(x=>x.id===id); v.status = v.status==='Tanya'?'DP':v.status==='DP'?'Lunas':'Tanya'; save(); renderWedding(); };
const addWedGuest = () => { let n=document.getElementById('wedGuestName').value, c=document.getElementById('wedGuestCity').value||'-', t=document.getElementById('wedGuestType').value, cnt=parseInt(document.getElementById('wedGuestCount').value); if(!n||isNaN(cnt))return; weddingData.guests.push({id:Date.now(),name:n,city:c,type:t,count:cnt,isInvited:false,isAttending:true}); ['wedGuestName','wedGuestCity'].forEach(id=>document.getElementById(id).value=""); document.getElementById('wedGuestCount').value="1"; save(); renderWedding();};
const deleteWedGuest = id => { if(confirm("Hapus tamu?")) { weddingData.guests=weddingData.guests.filter(g=>g.id!==id); save(); renderWedding(); }};
const toggleWedGuestInvite = id => { let g=weddingData.guests.find(x=>x.id===id); g.isInvited=!g.isInvited; save(); renderWedding();};
const toggleWedGuestAttend = id => { let g=weddingData.guests.find(x=>x.id===id); g.isAttending=!g.isAttending; save(); renderWedding();};
const changeGuestSort = v => { currentGuestSort=v; renderWedding(); };

// ========================================================
// RENDERERS (UPDATE, CHARTS, WEDDING)
// ========================================================
function update() {
  updateDropdowns();
  let rHtml="", activeD=debts.filter(d=>d.remaining>0), td=new Date(), pfx=td.getFullYear()+"-"+String(td.getMonth()+1).padStart(2,'0');
  if(activeD.length) {
      rHtml=`<div class="reminder-card"><div class="reminder-title"><i class="fas fa-bell" style="color:var(--warning);"></i> Cicilan Bulanan</div>`;
      activeD.forEach(d=>{
          let due=parseInt(d.date.split('-')[2]), pd=transactions.some(t=>t.type==='expense'&&t.desc.toLowerCase().includes(d.name.toLowerCase())&&t.date.startsWith(pfx)), txt="", diff=due-td.getDate();
          if(pd) txt=`<span style="color:var(--success); font-size:0.8rem; margin-left:10px;">(Udah Dibayar ✓)</span>`;
          else if(!isNaN(due)) txt=`<span style="color:${diff<=0?'var(--danger)':'var(--primary)'}; font-weight:700; font-size:0.8rem; margin-left:10px;">(${diff<=0?'JATUH TEMPO!':`H-${diff}`})</span>`;
          rHtml+=`<div class="reminder-item"><i class="fas fa-chevron-right"></i> <span><strong>${d.name}</strong> - Tgl <strong>${isNaN(due)?'-':due}</strong> ${txt}</span></div>`;
      }); rHtml+=`</div>`;
  }
  let rd=document.getElementById("debtReminderContainer"); if(rd) rd.innerHTML=rHtml;

  let bYM=document.getElementById("budgetMonthFilter")?.value||defaultYM, aYM=document.getElementById("assetMonthFilter")?.value||defaultYM;
  let tA=getAssetsFor(aYM), cA=getAssetsFor(defaultYM), cB=getBudgetsFor(bYM);
  let bal=0, totA=0, mNames=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  
  if(document.getElementById("budgetMonthLabel")) document.getElementById("budgetMonthLabel").innerText = `${mNames[new Date(bYM+"-01").getMonth()]} ${bYM.split('-')[0]}`;
  if(document.getElementById("assetMonthLabel")) document.getElementById("assetMonthLabel").innerText = `${mNames[new Date(aYM+"-01").getMonth()]} ${aYM.split('-')[0]}`;

  cA.forEach(a=>{ if(a.type==='rekening') bal+=a.value; else totA+=a.value; });
  let totD=debts.reduce((s,d)=>s+d.remaining,0), wlth=bal+totA-totD;
  ['balance','wealth','totalDebtDisplay'].forEach((id,i)=> { let e=document.getElementById(id); if(e) e.innerText=formatRp([bal,wlth,totD][i]); });
  
  let tL=document.getElementById("trxList"); if(tL) {
      tL.innerHTML = [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,15).map(t=>{
          let i=transactions.findIndex(x=>x.id===t.id), ic=t.type==='income'?'down text-success':t.type==='expense'?'up text-danger':'exchange-alt text-primary';
          return `<tr><td style="color:#64748b;">${t.date}</td><td><i class="fas fa-arrow-${ic}"></i></td><td><strong>${t.desc}</strong><br><small>${t.walletName}</small></td><td style="font-weight:600;">${formatRp(t.amount)}</td><td style="text-align:center;"><button class="btn-danger" padding="4px" onclick="deleteTransaction(${i})"><i class="fas fa-trash"></i></button></td></tr>`;
      }).join('');
  }

  // Budget & Target & Debt list renders... (Simplified map/joins)
  let bl=document.getElementById("budgetList"); if(bl){
      let cash=cA.filter(a=>a.type==='rekening').reduce((s,a)=>s+a.value,0), sTM={};
      transactions.filter(t=>t.date.startsWith(bYM)&&t.type==='expense').forEach(t=>sTM[t.category]=(sTM[t.category]||0)+t.amount);
      let rmT=0; bl.innerHTML = cB.length ? cB.map((b,i) => {
          let sp=sTM[b.category]||0, pt=Math.min((sp/b.amount)*100,100).toFixed(1), cL=sp>=b.amount?'var(--success)':pt>80?'var(--warning)':'var(--primary)';
          rmT+=Math.max(0,b.amount-sp);
          return `<div class="card" style="margin-bottom:0; border-left:4px solid ${cL}"><strong>${b.category}</strong> <small style="float:right; color:${cL}">${pt}%</small><div class="progress" style="margin:8px 0;"><div class="progress-bar" style="width:${pt}%; background:${cL}"></div></div><small>${formatRp(sp)} / ${formatRp(b.amount)}</small></div>`;
      }).join('') : '<p>Belum ada anggaran.</p>';
      let bvl=document.getElementById("budgetVsLiquid"); if(bvl) bvl.innerHTML=`<span style="color:${rmT>cash?'var(--danger)':'var(--success)'}">${formatRp(rmT)}</span> <small>/ ${formatRp(cash)}</small>`;
  }

  let gl=document.getElementById("goalList"); if(gl) {
      gl.innerHTML = goals.map((g,i) => {
          let src=Array.isArray(g.source)?g.source:['all_liquid'], cA_Amt=src.includes('all_liquid')?bal:src.reduce((s,n)=>{let a=cA.find(x=>x.name===n); return s+(a?a.value:0);},0);
          let pt=Math.min((cA_Amt/g.target)*100,100).toFixed(1), cL=cA_Amt>=g.target?'var(--success)':'var(--primary)';
          return `<div class="card" style="margin-bottom:0;"><strong>${g.name}</strong> <button class="btn-danger" style="float:right; padding:4px;" onclick="deleteGoal(${i})"><i class="fas fa-trash"></i></button><div class="progress" style="margin:8px 0;"><div class="progress-bar" style="width:${pt}%; background:${cL}"></div></div><small>${formatRp(cA_Amt)} / ${formatRp(g.target)}</small></div>`;
      }).join('');
  }

  // Render Charts
  if(document.getElementById("donutChart")) {
      let d=[0,0,0,0,0], m={rekening:0, saham:1, emas:2, bergerak:3, nonbergerak:4}; cA.forEach(a=> d[m[a.type]]+=a.value);
      if(donutChart) donutChart.destroy();
      donutChart = new Chart(document.getElementById("donutChart"),{ type:'doughnut', data:{labels:['Kas','Saham','Emas','Bergerak','Tetap'], datasets:[{data:d, backgroundColor:['#0ea5e9','#3b82f6','#10b981','#f59e0b','#8b5cf6']}]}, options:{maintainAspectRatio:false, cutout:'70%', plugins:{legend:{position:'right'}}} });
      if(!barChart) renderMonthlyChart(12);
  }
}

function renderLaporan() {
    let ym=document.getElementById("lapMonthFilter")?.value||defaultYM, i=0, e=0, ex={};
    transactions.filter(t=>t.date.startsWith(ym)).forEach(t=>{if(t.type==='income')i+=t.amount; else if(t.type==='expense'){e+=t.amount; ex[t.category||'Lain']=(ex[t.category||'Lain']||0)+t.amount;}});
    document.getElementById("laporanSummary").innerHTML=`<div class="card"><h3>Pemasukan</h3><h2>${formatRp(i)}</h2></div><div class="card"><h3>Pengeluaran</h3><h2>${formatRp(e)}</h2></div><div class="card"><h3>Net</h3><h2 style="color:${i>=e?'var(--success)':'var(--danger)'}">${formatRp(i-e)}</h2></div>`;
    document.getElementById("topExpenses").innerHTML=Object.entries(ex).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<div style="display:flex; justify-content:space-between; padding:10px; background:#f8fafc; border-bottom:1px solid #eee;"><span>${k}</span><strong>${formatRp(v)}</strong></div>`).join('')||'<p>Kosong</p>';
}

function renderWedding() {
    let wg=goals.find(g=>g.name.toLowerCase().includes('nikah')), max=wg?wg.target:0, eM=document.getElementById('wedMaxBudget'); if(eM)eM.innerText=formatRp(max);
    let bc=document.getElementById('wedBudgetContainer'); if(bc) bc.innerHTML = weddingData.budget.map(b=>`<div class="card" style="margin-bottom:10px; padding:15px; border-left:4px solid #3b82f6;"><div style="display:flex; justify-content:space-between;"><strong>${b.name}</strong><span>${formatRp(b.real)} / ${formatRp(b.target)}</span></div><button onclick="deleteWedBudget(${b.id})" class="btn-danger" style="margin-top:10px; font-size:0.75rem;">Hapus</button></div>`).join('');
    let vc=document.getElementById('wedVendorTbody'); if(vc) vc.innerHTML = weddingData.vendors.map(v=>`<tr><td>${v.name}</td><td>${v.service}</td><td><button onclick="toggleWedVendorStatus(${v.id})" class="${v.status==='Lunas'?'btn-success':'btn-warning'}" style="padding:4px 8px;">${v.status}</button></td><td><button onclick="deleteWedVendor(${v.id})" class="btn-danger" style="padding:4px"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    ['Pria','Wanita','VIP','Reguler'].forEach(t => {
        let tc=document.getElementById(`wedGuestTbody${t}`), dt=weddingData.guests.filter(g=>g.type.includes(t));
        if(tc) tc.innerHTML = dt.length ? dt.map(g=>`<tr><td>${g.name}</td><td>${g.city}</td><td>${g.count}</td><td><input type="checkbox" ${g.isInvited?'checked':''} onchange="toggleWedGuestInvite(${g.id})"></td><td><input type="checkbox" ${g.isAttending?'checked':''} onchange="toggleWedGuestAttend(${g.id})"></td><td><button onclick="deleteWedGuest(${g.id})" class="btn-danger" style="padding:4px;"><i class="fas fa-trash"></i></button></td></tr>`).join('') : `<tr><td colspan="6" style="text-align:center;">Kosong</td></tr>`;
    });
}

function renderMonthlyChart(r){
  let d={}, mN=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  for(let i=r-1;i>=0;i--){ let d1=new Date(new Date().getFullYear(),new Date().getMonth()-i,1); d[`${mN[d1.getMonth()]} ${d1.getFullYear()}`]={i:0,e:0}; }
  transactions.forEach(t=>{ let dt=new Date(t.date), k=`${mN[dt.getMonth()]} ${dt.getFullYear()}`; if(d[k]) { if(t.type==='income')d[k].i+=t.amount; else if(t.type==='expense')d[k].e+=t.amount; }});
  if(barChart) barChart.destroy();
  barChart=new Chart(document.getElementById("barChart"),{type:'bar',data:{labels:Object.keys(d),datasets:[{label:'Pemasukan',data:Object.values(d).map(x=>x.i),backgroundColor:'#10b981'},{label:'Pengeluaran',data:Object.values(d).map(x=>x.e),backgroundColor:'#ef4444'}]},options:{maintainAspectRatio:false}});
}
if(document.getElementById("barChart")) setTimeout(update, 100);
