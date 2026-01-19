// ===== 1. Supabase 配置 =====
const SUPABASE_URL = 'https://jzvpilyvupnichmdkizu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G3MQ5B-Mp61ecNOc3GrZRQ_S7rSK8V6';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. 全局状态 =====
let currentYear, currentMonth, selectedDateISO, currentUser;
let currentSubject = "math";
let barChart;

// 分页全局变量
let currentPage = 1;
const ITEMS_PER_PAGE = 6;

// ===== 3. 初始化入口 (增加容错保护) =====
window.addEventListener("DOMContentLoaded", async () => {
    console.log("应用启动中...");

    // 初始化基础数据
    initTime();

    // 初始化 UI 组件（带安全检查）
    if (document.getElementById("dayBarChart")) initBarChart();
    initCustomSelect();

    // 监听 Auth 状态变化
    sbClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user;
        if (currentUser) {
            showMainApp();
        } else {
            showAuthForm();
        }
    });

    bindEvents();
});

// 安全获取元素函数：防止因缺少 HTML 元素导致的脚本死机
function safeGet(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`[页面兼容性] 未找到 ID 为 "${id}" 的元素，相关功能将静默跳过。`);
    return el;
}

function initTime() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);
}

// ===== 4. 身份验证 (Auth) 函数 =====
async function handleLogin() {
    const email = safeGet("emailInput")?.value.trim();
    const password = safeGet("passwordInput")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password) { if (msg) msg.textContent = "❌ 请输入邮箱和密码"; return; }

    if (msg) msg.textContent = "⏳ 正在登录...";
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error && msg) {
        msg.textContent = "❌ " + error.message;
    }
}

async function handleRegister() {
    const email = safeGet("regEmailInput")?.value.trim();
    const password = safeGet("regPasswordInput")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password || password.length < 6) {
        if (msg) msg.textContent = "❌ 邮箱无效或密码太短 (至少6位)";
        return;
    }

    const { error } = await sbClient.auth.signUp({ email, password });
    if (msg) msg.textContent = error ? "❌ " + error.message : "✅ 注册成功！直接登录即可。";
}

async function handleLogout() {
    await sbClient.auth.signOut();
    localStorage.clear();
    location.reload();
}

function showMainApp() {
    const auth = safeGet("authContainer");
    const app = safeGet("appContainer");
    if (auth) auth.style.display = "none";
    if (app) app.style.display = "block";
    syncAllFromCloud();
}

function showAuthForm() {
    const auth = safeGet("authContainer");
    const app = safeGet("appContainer");
    if (auth) auth.style.display = "block";
    if (app) app.style.display = "none";
}

function toggleAuthMode(mode) {
    const loginF = safeGet("loginForm");
    const regF = safeGet("registerForm");
    const btnL = safeGet("showLogin");
    const btnR = safeGet("showRegister");

    if (loginF) loginF.style.display = mode === 'login' ? 'block' : 'none';
    if (regF) regF.style.display = mode === 'reg' ? 'block' : 'none';
    if (btnL) btnL.classList.toggle("active", mode === 'login');
    if (btnR) btnR.classList.toggle("active", mode === 'reg');
}

// ===== 5. 云端数据同步 =====
async function syncAllFromCloud() {
    if (!currentUser) return;
    const statusEl = safeGet("loginStatus");
    if (statusEl) statusEl.textContent = "⏳ 同步中...";

    try {
        const [recordsRes, wrongsRes, honorsRes] = await Promise.all([
            sbClient.from('learning_records').select('*'),
            sbClient.from('wrong_book').select('*'),
            sbClient.from('honor_wall').select('*')
        ]);

        if (recordsRes.data) {
            const hist = {};
            recordsRes.data.forEach(r => { hist[r.date] = { math: r.math, reading: r.reading, spelling: r.spelling }; });
            setHistory(hist);
        }
        if (wrongsRes.data) {
            const wb = {};
            wrongsRes.data.forEach(w => { if (!wb[w.date]) wb[w.date] = []; wb[w.date].push(w.content); });
            setWrongBook(wb);
        }
        if (honorsRes.data) {
            const hw = honorsRes.data.map(h => ({ date: h.date, medal: h.medal }));
            localStorage.setItem("honorWall", JSON.stringify(hw));
        }

        setSelected(selectedDateISO);
        if (statusEl) statusEl.textContent = `👤 ${currentUser.email}`;
    } catch (e) {
        console.error("同步出错:", e);
    }
}

// ===== 6. 自定义下拉菜单核心逻辑 =====
function initCustomSelect() {
    const trigger = safeGet('selectTrigger');
    const optionsContainer = safeGet('customOptions');
    const optionItems = document.querySelectorAll('.custom-option');
    const selectedText = safeGet('selectedOptionText');

    if (!trigger || !optionsContainer) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsContainer.classList.toggle('show');
    });

    optionItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            const val = this.getAttribute('data-value');
            const text = this.innerText;

            currentSubject = val;
            if (selectedText) selectedText.innerText = text;

            optionItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            optionsContainer.classList.remove('show');
            renderCalendarGrid();
        });
    });

    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target)) {
            optionsContainer.classList.remove('show');
        }
    });
}

// ===== 7. 渲染函数汇总 (包含美化适配) =====
function renderCalendarGrid() {
    const grid = safeGet("calendarGrid");
    const label = safeGet("currentMonthLabel");
    if (!grid) return;
    grid.innerHTML = "";
    if (label) label.textContent = `${currentYear}年${currentMonth + 1}月`;

    const hist = getHistory();
    const offset = firstDayOffset(currentYear, currentMonth);
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("div");
        blank.className = "day-cell";
        blank.style.visibility = "hidden";
        grid.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dateISO = formatDate(new Date(currentYear, currentMonth, day));
        const dayCell = document.createElement("div");
        dayCell.className = "day-cell";
        if (dateISO === selectedDateISO) dayCell.classList.add("selected");

        const data = hist[dateISO];
        const acc = data ? data[currentSubject] : null;
        dayCell.style.background = colorForAccuracy(acc);
        dayCell.addEventListener('click', () => setSelected(dateISO));

        const num = document.createElement("div");
        num.className = "day-number";
        num.textContent = day;
        dayCell.appendChild(num);
        grid.appendChild(dayCell);
    }
}

function renderBarForSelectedDay() {
    const data = getHistory()[selectedDateISO] || {};
    if (barChart) {
        barChart.data.datasets[0].data = [data.math || 0, data.reading || 0, data.spelling || 0];
        barChart.update();
    }
}

// 错题列表美化：匹配 CSS 中的 .wrong-item 和 .delete-btn
function renderWrongListForSelectedDay() {
    const list = safeGet("wrongList");
    if (!list) return;
    const arr = getWrongBook()[selectedDateISO] || [];

    if (arr.length === 0) {
        list.innerHTML = `<li style="color:#ccc; font-size:12px; text-align:center; padding:10px;">本日无错题记录</li>`;
        return;
    }

    list.innerHTML = arr.map((q, i) => `
        <li class="wrong-item">
            <span class="wrong-text">${q}</span>
            <button class="delete-btn" onclick="deleteWrong(${i}, '${q}')">删除</button>
        </li>
    `).join("");
}

async function deleteWrong(index, content) {
    const wb = getWrongBook();
    wb[selectedDateISO].splice(index, 1);
    setWrongBook(wb);
    if (currentUser) {
        await sbClient.from('wrong_book').delete().match({
            user_id: currentUser.id,
            date: selectedDateISO,
            content: content
        });
    }
    refreshUI();
}

// 历史日期胶囊美化：匹配 CSS 中的 .history-date-badge
function renderWrongCalendar() {
    const wb = getWrongBook();
    const container = safeGet("wrongCalendar");
    if (!container) return;
    const dates = Object.keys(wb).filter(d => wb[d].length > 0).sort().reverse(); // 最近的在前

    container.innerHTML = dates.map(d => `
        <button class="history-date-badge" onclick="setSelected('${d}')">${d}</button>
    `).join("");
}

function renderHonorWall() {
    const allHonors = JSON.parse(localStorage.getItem("honorWall") || "[]");

    // 统计看板
    const stats = { gold: 0, silver: 0, bronze: 0 };
    allHonors.forEach(item => {
        if (item.medal.includes("金牌")) stats.gold++;
        else if (item.medal.includes("银牌")) stats.silver++;
        else if (item.medal.includes("铜牌")) stats.bronze++;
    });

    if (safeGet("goldCount")) safeGet("goldCount").textContent = stats.gold;
    if (safeGet("silverCount")) safeGet("silverCount").textContent = stats.silver;
    if (safeGet("bronzeCount")) safeGet("bronzeCount").textContent = stats.bronze;

    // 分页
    const sortedHonors = allHonors.sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.max(1, Math.ceil(sortedHonors.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pagedHonors = sortedHonors.slice(start, start + ITEMS_PER_PAGE);

    const container = safeGet("honorWall");
    if (!container) return;

    if (pagedHonors.length === 0) {
        container.innerHTML = `<div style="grid-column: span 2; color:#ccc; text-align:center; padding:20px;">暂无勋章</div>`;
    } else {
        container.innerHTML = pagedHonors.map(item => `
            <div class="honor-item">
                <span style="font-size: 11px; color: #8a87b8;">${item.date}</span>
                <div style="font-size: 15px; margin-top:5px; font-weight:bold;">${item.medal}</div>
            </div>
        `).join("");
    }

    if (safeGet("pageIndicator")) safeGet("pageIndicator").textContent = `第 ${currentPage} / ${totalPages} 页`;
    if (safeGet("prevPageBtn")) safeGet("prevPageBtn").disabled = (currentPage === 1);
    if (safeGet("nextPageBtn")) safeGet("nextPageBtn").disabled = (currentPage === totalPages);
}

// ===== 8. 工具函数 =====
function getHistory() { return JSON.parse(localStorage.getItem("accuracyHistory") || "{}"); }
function setHistory(hist) { localStorage.setItem("accuracyHistory", JSON.stringify(hist)); }
function getWrongBook() { return JSON.parse(localStorage.getItem("wrongBook") || "{}"); }
function setWrongBook(wb) { localStorage.setItem("wrongBook", JSON.stringify(wb)); }

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function clamp01(v) { return v === "" ? null : Math.min(100, Math.max(0, Number(v))); }
function colorForAccuracy(acc) {
    if (acc === null) return "#f3f4f6";
    if (acc < 60) return "#ef4444";
    if (acc < 90) return "#84cc16";
    return "#166534";
}
function firstDayOffset(y, m) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

function setSelected(iso) {
    selectedDateISO = iso;
    const parts = iso.split("-");
    currentYear = parseInt(parts[0]);
    currentMonth = parseInt(parts[1]) - 1;

    const dateTxt = safeGet("selectedDateText");
    if (dateTxt) dateTxt.textContent = iso;

    const data = getHistory()[iso] || {};
    if (safeGet("mathInput")) safeGet("mathInput").value = data.math ?? "";
    if (safeGet("readingInput")) safeGet("readingInput").value = data.reading ?? "";
    if (safeGet("spellingInput")) safeGet("spellingInput").value = data.spelling ?? "";

    refreshUI();
}

function refreshUI() {
    renderCalendarGrid();
    renderBarForSelectedDay();
    renderWrongListForSelectedDay();
    renderWrongCalendar();
    renderHonorWall();
}

async function saveDayData() {
    const mathVal = clamp01(safeGet("mathInput")?.value);
    const readingVal = clamp01(safeGet("readingInput")?.value);
    const spellingVal = clamp01(safeGet("spellingInput")?.value);

    const hist = getHistory();
    hist[selectedDateISO] = { math: mathVal, reading: readingVal, spelling: spellingVal };
    setHistory(hist);

    if (currentUser) {
        await sbClient.from('learning_records').upsert({
            user_id: currentUser.id, date: selectedDateISO,
            math: mathVal, reading: readingVal, spelling: spellingVal
        });
    }
    if (document.activeElement) document.activeElement.blur();
    refreshUI();
    checkMedalForDay();
}

async function addWrongToBook() {
    const input = safeGet("wrongQuestionInput");
    const val = (input?.value || "").trim();
    if (!val) return;
    const wb = getWrongBook();
    wb[selectedDateISO] = wb[selectedDateISO] || [];
    wb[selectedDateISO].push(val);
    setWrongBook(wb);
    if (currentUser) {
        await sbClient.from('wrong_book').insert({ user_id: currentUser.id, date: selectedDateISO, content: val });
    }
    if (input) input.value = "";
    if (document.activeElement) document.activeElement.blur();
    refreshUI();
}

function bindEvents() {
    // 身份切换
    const btnL = safeGet("showLogin");
    const btnR = safeGet("showRegister");
    if (btnL) btnL.onclick = () => toggleAuthMode('login');
    if (btnR) btnR.onclick = () => toggleAuthMode('reg');

    // 月份切换
    const prevM = safeGet("prevMonthBtn");
    const nextM = safeGet("nextMonthBtn");
    if (prevM) prevM.onclick = (e) => {
        e.stopPropagation();
        if (--currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendarGrid();
    };
    if (nextM) nextM.onclick = (e) => {
        e.stopPropagation();
        if (++currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendarGrid();
    };

    // 分页点击
    const prevP = safeGet("prevPageBtn");
    const nextP = safeGet("nextPageBtn");
    if (prevP) prevP.onclick = () => { if (currentPage > 1) { currentPage--; renderHonorWall(); } };
    if (nextP) nextP.onclick = () => {
        const allHonors = JSON.parse(localStorage.getItem("honorWall") || "[]");
        const totalPages = Math.ceil(allHonors.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) { currentPage++; renderHonorWall(); }
    };

    // 功能按钮
    const saveBtn = safeGet("saveDayBtn");
    const addWBtn = safeGet("addWrongBtn");
    if (saveBtn) saveBtn.onclick = saveDayData;
    if (addWBtn) addWBtn.onclick = addWrongToBook;
}

function initBarChart() {
    const canvas = safeGet("dayBarChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    barChart = new Chart(ctx, {
        type: "bar",
        data: { labels: ["数学", "阅读", "拼写"], datasets: [{ label: "正确率%", data: [0, 0, 0], backgroundColor: ["#7b68ee", "#84cc16", "#fde68a"] }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });
}

function checkMedalForDay() {
    const day = getHistory()[selectedDateISO] || {};
    const scores = [day.math, day.reading, day.spelling].filter(v => v !== null && v !== undefined);
    if (scores.length < 3) return;
    const count90 = scores.filter(v => v >= 90).length;
    let medal = count90 === 3 ? "🥇 金牌" : count90 === 2 ? "🥈 银牌" : count90 === 1 ? "🥉 铜牌" : null;
    if (medal) {
        const popup = safeGet("medalPopup");
        if (popup) {
            popup.textContent = `恭喜获得 ${medal}!`;
            popup.style.display = "block";
            setTimeout(() => popup.style.display = "none", 3000);
        }
        addMedalToHonorWall(selectedDateISO, medal);
    }
}

async function addMedalToHonorWall(date, medal) {
    const honor = JSON.parse(localStorage.getItem("honorWall") || "[]");
    if (honor.some(h => h.date === date && h.medal === medal)) return;
    honor.push({ date, medal });
    localStorage.setItem("honorWall", JSON.stringify(honor));
    if (currentUser) await sbClient.from('honor_wall').insert({ user_id: currentUser.id, date, medal });
    renderHonorWall();
}