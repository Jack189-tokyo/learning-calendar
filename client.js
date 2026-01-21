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

// ===== 3. 初始化入口 =====
window.addEventListener("DOMContentLoaded", async () => {
    console.log("应用启动中...");

    initTime();
    // 初始化动态背景
    initMathBackground();

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

// ===== 4. 增强版：动态数学背景逻辑 (加入景深模糊与随机动效) =====
function initMathBackground() {
    const bg = document.getElementById('math-bg');
    if (!bg) return;

    const symbols = [
        'π', 'x + y = ?', '÷', '×', '123', '½', '∑', '∞',
        '△', '□', '∠A', 'r²', '99×9', '5+7=12', 'V=sh', 'a²+b²',
        'y=kx+b', 'sinθ', '6÷2=3', '10%', 'S=πr²', '>', '<', '='
    ];

    const createSymbol = () => {
        const span = document.createElement('span');
        span.className = 'math-symbol';

        // 1. 随机内容
        span.innerText = symbols[Math.floor(Math.random() * symbols.length)];

        // 2. 随机样式参数
        const startX = Math.random() * 100;
        const size = Math.random() * (65 - 20) + 20; // 尺寸 20px - 65px
        const duration = Math.random() * (30 - 20) + 20; // 较慢的浮动速度，减少视觉干扰
        const delay = Math.random() * 5;
        const rotate = Math.random() * 60 - 30; // 初始旋转角度

        // --- 核心优化：随机模糊度 (景深效果) ---
        // 30% 的概率产生模糊效果，模拟背景深度
        const blurVal = Math.random() > 0.7 ? (Math.random() * 2.5) : 0;

        // 3. 应用样式
        span.style.left = `${startX}%`;
        span.style.bottom = `-100px`; // 从屏幕下方更远处开始，避免突兀出现
        span.style.fontSize = `${size}px`;
        span.style.filter = `blur(${blurVal}px)`; // 应用景深模糊
        span.style.transform = `rotate(${rotate}deg)`;

        // 配合 CSS 变量：颜色使用深紫色，较低不透明度
        span.style.color = "rgba(107, 70, 193, 0.22)";
        span.style.fontWeight = "900";
        span.style.fontFamily = "'Comic Sans MS', 'Chalkboard SE', 'Quicksand', sans-serif";

        // 应用 CSS 动画
        span.style.animation = `floatAnimation ${duration}s ease-in-out ${delay}s infinite`;

        bg.appendChild(span);

        // 4. 定期清理并重绘，保持性能
        setTimeout(() => {
            if (span.parentNode) {
                span.remove();
                createSymbol();
            }
        }, (duration + delay) * 1000);
    };

    // 初始生成数量调至 12-15 个
    // 符号变大后，数量不需要太多，以免背景显得杂乱
    for (let i = 0; i < 14; i++) {
        setTimeout(createSymbol, i * 800);
    }
}

// ===== 5. 安全获取元素函数 =====
function safeGet(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`[页面兼容性] 未找到 ID 为 "${id}" 的元素。`);
    return el;
}

function initTime() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);
}

// ===== 6. 身份验证 (Auth) 函数 =====
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

// ===== 7. 云端数据同步 =====
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

// ===== 8. 下拉菜单逻辑 =====
function initCustomSelect() {
    const trigger = safeGet('selectTrigger');
    const optionsContainer = safeGet('customOptions');
    const optionItems = document.querySelectorAll('.custom-option');
    const selectedText = safeGet('selectedOptionText');

    if (!trigger || !optionsContainer) return;

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = optionsContainer.classList.contains('show');
        document.querySelectorAll('.custom-options').forEach(el => el.classList.remove('show'));
        if (!isOpen) optionsContainer.classList.add('show');
    };

    optionItems.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();
            currentSubject = this.getAttribute('data-value');
            if (selectedText) selectedText.innerText = this.innerText;
            optionItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            optionsContainer.classList.remove('show');
            renderCalendarGrid();
        };
    });

    document.addEventListener('click', () => {
        if (optionsContainer) optionsContainer.classList.remove('show');
    });
}

// ===== 9. 渲染函数汇总 =====
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

        const data = hist[dateISO];
        const acc = data ? data[currentSubject] : null;

        dayCell.classList.add(levelClassForAccuracy(acc));
        if (dateISO === selectedDateISO) dayCell.classList.add("selected");
        dayCell.onclick = () => setSelected(dateISO);

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

function renderWrongCalendar() {
    const wb = getWrongBook();
    const container = safeGet("wrongCalendar");
    if (!container) return;

    const dates = Object.keys(wb)
        .filter(d => wb[d].length > 0)
        .sort((a, b) => new Date(b) - new Date(a));

    if (dates.length === 0) {
        container.innerHTML = `<span style="color:#ccc; font-size:12px; padding:10px;">暂无历史记录</span>`;
        return;
    }

    container.innerHTML = dates.map(d => `
        <button class="history-date-badge" onclick="setSelected('${d}')">${d}</button>
    `).join("");
}

function renderHonorWall() {
    const allHonors = JSON.parse(localStorage.getItem("honorWall") || "[]");
    const stats = { gold: 0, silver: 0, bronze: 0 };
    allHonors.forEach(item => {
        if (item.medal.includes("金牌")) stats.gold++;
        else if (item.medal.includes("银牌")) stats.silver++;
        else if (item.medal.includes("铜牌")) stats.bronze++;
    });

    if (safeGet("goldCount")) safeGet("goldCount").textContent = stats.gold;
    if (safeGet("silverCount")) safeGet("silverCount").textContent = stats.silver;
    if (safeGet("bronzeCount")) safeGet("bronzeCount").textContent = stats.bronze;

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

// ===== 10. 工具函数 =====
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

function clamp01(v) {
    if (v === "" || v === null) return null;
    return Math.min(100, Math.max(0, Number(v)));
}

function levelClassForAccuracy(acc) {
    if (acc === null || acc === undefined || acc === "") return "level-0";
    const val = Number(acc);
    if (val < 30) return "level-1";
    if (val < 60) return "level-2";
    if (val < 90) return "level-3";
    return "level-4";
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
    if (safeGet("mathInput")) safeGet("mathInput").value = (data.math !== null && data.math !== undefined) ? data.math : "";
    if (safeGet("readingInput")) safeGet("readingInput").value = (data.reading !== null && data.reading !== undefined) ? data.reading : "";
    if (safeGet("spellingInput")) safeGet("spellingInput").value = (data.spelling !== null && data.spelling !== undefined) ? data.spelling : "";

    refreshUI();
}

function refreshUI() {
    renderCalendarGrid();
    renderBarForSelectedDay();
    renderWrongListForSelectedDay();
    renderWrongCalendar();
    renderHonorWall();
    const wrongCal = safeGet("wrongCalendar");
    if (wrongCal) wrongCal.scrollLeft = 0;
}

async function saveDayData() {
    const btn = safeGet("saveDayBtn");
    const originalText = btn ? btn.textContent : "保存今日记录";
    const mathVal = clamp01(safeGet("mathInput")?.value);
    const readingVal = clamp01(safeGet("readingInput")?.value);
    const spellingVal = clamp01(safeGet("spellingInput")?.value);
    const hist = getHistory();
    hist[selectedDateISO] = { math: mathVal, reading: readingVal, spelling: spellingVal };
    setHistory(hist);
    if (currentUser) {
        if (btn) btn.textContent = "⏳ 正在同步...";
        await sbClient.from('learning_records').upsert({
            user_id: currentUser.id, date: selectedDateISO,
            math: mathVal, reading: readingVal, spelling: spellingVal
        }, { onConflict: 'user_id,date' });
        if (btn) {
            btn.textContent = "✅ 保存成功";
            setTimeout(() => { btn.textContent = originalText; }, 1500);
        }
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
    const btnL = safeGet("showLogin");
    const btnR = safeGet("showRegister");
    if (btnL) btnL.onclick = () => toggleAuthMode('login');
    if (btnR) btnR.onclick = () => toggleAuthMode('reg');
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
    const prevP = safeGet("prevPageBtn");
    const nextP = safeGet("nextPageBtn");
    if (prevP) prevP.onclick = () => { if (currentPage > 1) { currentPage--; renderHonorWall(); } };
    if (nextP) nextP.onclick = () => {
        const allHonors = JSON.parse(localStorage.getItem("honorWall") || "[]");
        const totalPages = Math.ceil(allHonors.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages) { currentPage++; renderHonorWall(); }
    };
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
        data: {
            labels: ["数学", "阅读", "拼写"],
            datasets: [{
                label: "正确率%",
                data: [0, 0, 0],
                backgroundColor: ["#7b68ee", "#84cc16", "#facc15"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: "rgba(0,0,0,0.05)" } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
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