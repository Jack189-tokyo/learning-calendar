// ===== 1. Supabase 配置 =====
const SUPABASE_URL = 'https://jzvpilyvupnichmdkizu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G3MQ5B-Mp61ecNOc3GrZRQ_S7rSK8V6';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. 全局状态 =====
let currentYear, currentMonth, selectedDateISO, currentUser;
let currentSubject = "math";
let barChart;

// ===== 3. 初始化入口 =====
window.addEventListener("DOMContentLoaded", async () => {
    initTime();
    initBarChart();

    // 监听 Auth 状态变化
    sbClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            currentUser = session?.user;
            if (currentUser) {
                showMainApp();
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthForm();
        }
    });

    bindEvents();
});

function initTime() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);
}

// ===== 4. 身份验证 (Auth) 核心函数 =====

async function handleLogin() {
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const msg = document.getElementById("authMsg");

    if (!email || !password) {
        msg.textContent = "❌ 请输入邮箱和密码";
        return;
    }

    msg.textContent = "⏳ 正在登录...";
    // 执行登录请求
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login Error:", error);
        // 专门处理未验证邮箱的情况
        if (error.message.includes("Email not confirmed")) {
            msg.textContent = "❌ 请先去邮箱验证确认链接，或在后台关闭 Email Confirmation。";
        } else {
            msg.textContent = "❌ 登录失败: " + error.message;
        }
        msg.style.color = "#dc2626";
    } else {
        currentUser = data.user;
        msg.textContent = "✅ 登录成功！";
        msg.style.color = "#059669";
        showMainApp(); // 确保界面切换
    }
}

async function handleRegister() {
    const email = document.getElementById("regEmailInput").value.trim();
    const password = document.getElementById("regPasswordInput").value;
    const msg = document.getElementById("authMsg");

    if (!email || password.length < 6) {
        msg.textContent = "❌ 邮箱无效或密码太短（最少6位）";
        return;
    }

    const { data, error } = await sbClient.auth.signUp({ email, password });
    if (error) {
        msg.textContent = "❌ 注册失败: " + error.message;
        msg.style.color = "#dc2626";
    } else {
        msg.textContent = "✅ 注册成功！请登录（若需验证请查收邮件）。";
        msg.style.color = "#059669";
    }
}

async function handleLogout() {
    const { error } = await sbClient.auth.signOut();
    if (!error) {
        localStorage.clear();
        location.reload();
    }
}

function showMainApp() {
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
    syncAllFromCloud();
}

function showAuthForm() {
    document.getElementById("authContainer").style.display = "block";
    document.getElementById("appContainer").style.display = "none";
}

function toggleAuthMode(mode) {
    document.getElementById("loginForm").style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById("registerForm").style.display = mode === 'reg' ? 'block' : 'none';
    document.getElementById("showLogin").classList.toggle("active", mode === 'login');
    document.getElementById("showRegister").classList.toggle("active", mode === 'reg');
}

// ===== 5. 云端同步 =====

async function syncAllFromCloud() {
    if (!currentUser) return;
    const statusEl = document.getElementById("loginStatus");
    statusEl.textContent = "⏳ 同步中...";

    try {
        const [recordsRes, wrongsRes, honorsRes] = await Promise.all([
            sbClient.from('learning_records').select('*'),
            sbClient.from('wrong_book').select('*'),
            sbClient.from('honor_wall').select('*')
        ]);

        if (recordsRes.data) {
            const hist = {};
            recordsRes.data.forEach(r => {
                hist[r.date] = { math: r.math, reading: r.reading, spelling: r.spelling };
            });
            setHistory(hist);
        }

        if (wrongsRes.data) {
            const wb = {};
            wrongsRes.data.forEach(w => {
                if (!wb[w.date]) wb[w.date] = [];
                wb[w.date].push(w.content);
            });
            setWrongBook(wb);
        }

        if (honorsRes.data) {
            const hw = honorsRes.data.map(h => ({ date: h.date, medal: h.medal }));
            localStorage.setItem("honorWall", JSON.stringify(hw));
        }

        refreshUI();
        statusEl.textContent = `👤 ${currentUser.email}`;
    } catch (e) {
        console.error("同步出错:", e);
    }
}

// ===== 6. 核心业务逻辑 =====

async function saveDayData() {
    const mathVal = clamp01(document.getElementById("mathInput").value);
    const readingVal = clamp01(document.getElementById("readingInput").value);
    const spellingVal = clamp01(document.getElementById("spellingInput").value);

    const hist = getHistory();
    hist[selectedDateISO] = { math: mathVal, reading: readingVal, spelling: spellingVal };
    setHistory(hist);

    if (currentUser) {
        await sbClient.from('learning_records').upsert({
            user_id: currentUser.id,
            date: selectedDateISO,
            math: mathVal, reading: readingVal, spelling: spellingVal
        });
    }
    refreshUI();
    checkMedalForDay();
}

async function addWrongToBook() {
    const input = document.getElementById("wrongQuestionInput");
    const val = (input.value || "").trim();
    if (!val) return;

    const wb = getWrongBook();
    wb[selectedDateISO] = wb[selectedDateISO] || [];
    wb[selectedDateISO].push(val);
    setWrongBook(wb);

    if (currentUser) {
        await sbClient.from('wrong_book').insert({
            user_id: currentUser.id,
            date: selectedDateISO,
            content: val
        });
    }
    input.value = "";
    refreshUI();
}

function refreshUI() {
    renderCalendarGrid();
    renderBarForSelectedDay();
    renderWrongListForSelectedDay();
    renderWrongCalendar(); // 这个函数现在已经在下面定义了！
    renderHonorWall();
}

// ===== 7. 渲染函数汇总 =====

function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    const label = document.getElementById("currentMonthLabel");
    if (!grid) return;
    grid.innerHTML = "";
    label.textContent = `${currentYear}年${currentMonth + 1}月`;

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
    const list = document.getElementById("wrongList");
    const arr = getWrongBook()[selectedDateISO] || [];
    list.innerHTML = arr.map((q, i) => `<li><span>${q}</span><button onclick="deleteWrong(${i}, '${q}')">删除</button></li>`).join("");
}

async function deleteWrong(index, content) {
    const wb = getWrongBook();
    wb[selectedDateISO].splice(index, 1);
    setWrongBook(wb);
    if (currentUser) {
        await sbClient.from('wrong_book').delete().match({ user_id: currentUser.id, date: selectedDateISO, content: content });
    }
    refreshUI();
}

// 补齐这个函数，解决 ReferenceError！
function renderWrongCalendar() {
    const wb = getWrongBook();
    const container = document.getElementById("wrongCalendar");
    if (!container) return;
    const dates = Object.keys(wb).filter(d => wb[d].length > 0).sort();
    container.innerHTML = dates.map(d => `<button class="wrong-date-btn has-wrong" onclick="setSelected('${d}')">${d}</button>`).join("");
}

function renderHonorWall() {
    const honor = JSON.parse(localStorage.getItem("honorWall") || "[]");
    document.getElementById("honorWall").innerHTML = honor.map(item => `<div class="honor-item">${item.date} ${item.medal}</div>`).join("");
}

// ===== 8. 工具与事件 =====

function getHistory() { return JSON.parse(localStorage.getItem("accuracyHistory") || "{}"); }
function setHistory(hist) { localStorage.setItem("accuracyHistory", JSON.stringify(hist)); }
function getWrongBook() { return JSON.parse(localStorage.getItem("wrongBook") || "{}"); }
function setWrongBook(wb) { localStorage.setItem("wrongBook", JSON.stringify(wb)); }
function formatDate(date) { return date.toISOString().split('T')[0]; }
function clamp01(v) { return v === "" ? null : Math.min(100, Math.max(0, Number(v))); }
function colorForAccuracy(acc) {
    if (acc === null) return "#e5e7eb";
    if (acc < 60) return "#ef4444";
    if (acc < 90) return "#84cc16";
    return "#166534";
}
function firstDayOffset(y, m) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

function setSelected(iso) {
    selectedDateISO = iso;
    const [y, m] = iso.split("-").map(Number);
    currentYear = y; currentMonth = m - 1;
    document.getElementById("selectedDateText").textContent = iso;
    document.getElementById("wrongDateText").textContent = iso;
    const data = getHistory()[iso] || {};
    document.getElementById("mathInput").value = data.math ?? "";
    document.getElementById("readingInput").value = data.reading ?? "";
    document.getElementById("spellingInput").value = data.spelling ?? "";
    refreshUI();
}

function bindEvents() {
    document.getElementById("showLogin").onclick = () => toggleAuthMode('login');
    document.getElementById("showRegister").onclick = () => toggleAuthMode('reg');
    document.getElementById("prevMonthBtn").onclick = () => { if (--currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendarGrid(); };
    document.getElementById("nextMonthBtn").onclick = () => { if (++currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendarGrid(); };
    document.getElementById("saveDayBtn").onclick = saveDayData;
    document.getElementById("addWrongBtn").onclick = addWrongToBook;
    document.getElementById("subjectSelect").onchange = (e) => { currentSubject = e.target.value; renderCalendarGrid(); };
}

function initBarChart() {
    const ctx = document.getElementById("dayBarChart").getContext("2d");
    barChart = new Chart(ctx, {
        type: "bar",
        data: { labels: ["数学", "阅读", "拼写"], datasets: [{ label: "正确率%", data: [0, 0, 0], backgroundColor: ["#93c5fd", "#bbf7d0", "#fde68a"] }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function checkMedalForDay() {
    const day = getHistory()[selectedDateISO] || {};
    const scores = [day.math, day.reading, day.spelling].filter(v => v !== null);
    if (scores.length < 3) return;
    const count90 = scores.filter(v => v >= 90).length;
    let medal = count90 === 3 ? "🥇 金牌" : count90 === 2 ? "🥈 银牌" : count90 === 1 ? "🥉 铜牌" : null;
    if (medal) {
        const popup = document.getElementById("medalPopup");
        popup.textContent = medal; popup.style.display = "block";
        setTimeout(() => popup.style.display = "none", 3000);
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