// ===== 云开发初始化 (兼容 SDK 1.x 与 2.x) =====
const ENV_ID = "learning-record-2gmf3u9w968a4b6e";

// 自动识别全局变量 (1.x 常用 tcb, 2.x 常用 cloudbase)
const cloudbaseProvider = window.cloudbase || window.tcb;

if (!cloudbaseProvider) {
    console.error("SDK 未能成功加载，请检查 HTML 中的脚本链接。");
}

const tcbApp = cloudbaseProvider.init({
    env: ENV_ID
});

// 开启本地持久化，避免每次刷新都重新请求服务器
const auth = tcbApp.auth({ persistence: "local" });
let currentUserUID = null;

// ===== 常量与变量 =====
const SUBJECTS = ["math", "reading", "spelling"];
const SUBJECT_LABELS = { math: "数学", reading: "英语阅读", spelling: "英语拼写" };

let currentYear, currentMonth, selectedDateISO;
let currentSubject = "math";
let barChart;

// ===== 工具函数 =====
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function clamp01(v) {
    if (v === "" || v === null || v === undefined) return null;
    const num = Number(v);
    if (isNaN(num)) return null;
    return Math.min(100, Math.max(0, num));
}

function colorForAccuracy(acc) {
    if (acc === null) return "#e5e7eb";
    if (acc < 30) return "#7f1d1d";
    if (acc < 50) return "#b91c1c";
    if (acc < 65) return "#ef4444";
    if (acc < 80) return "#84cc16";
    if (acc < 90) return "#22c55e";
    return "#166534";
}

// ===== 本地存储管理 =====
function getHistory() { return JSON.parse(localStorage.getItem("accuracyHistory") || "{}"); }
function setHistory(hist) { localStorage.setItem("accuracyHistory", JSON.stringify(hist)); }
function getWrongBook() { return JSON.parse(localStorage.getItem("wrongBook") || "{}"); }
function setWrongBook(wb) { localStorage.setItem("wrongBook", JSON.stringify(wb)); }
function getHonorWall() { return JSON.parse(localStorage.getItem("honorWall") || "[]"); }
function setHonorWall(hw) { localStorage.setItem("honorWall", JSON.stringify(hw)); }

// ===== 云端核心功能 =====
async function syncToCloud() {
    if (!currentUserUID) return;
    const btn = document.getElementById("syncCloudBtn");
    const originalText = btn.textContent;
    btn.textContent = "⏳ 同步中...";

    try {
        const payload = {
            uid: currentUserUID,
            history: getHistory(),
            wrongBook: getWrongBook(),
            honorWall: getHonorWall()
        };

        await tcbApp.callFunction({
            name: "api",
            data: {
                path: "/api/sync",
                httpMethod: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }
        });

        btn.textContent = "✅ 已同步";
        setTimeout(() => btn.textContent = "☁️ 手动同步", 2000);
    } catch (e) {
        console.error("同步失败:", e);
        btn.textContent = "❌ 失败";
        setTimeout(() => btn.textContent = originalText, 2000);
    }
}

async function pullFromCloud() {
    if (!currentUserUID) return;
    try {
        const res = await tcbApp.callFunction({
            name: "api",
            data: {
                path: `/api/data/${currentUserUID}`,
                httpMethod: "GET"
            }
        });

        const responseData = typeof res.result.body === 'string' ? JSON.parse(res.result.body) : res.result.body;
        const cloudData = responseData.data;

        if (cloudData && Object.keys(cloudData).length > 0) {
            if (confirm("发现云端有备份记录，是否下载并覆盖本地数据？")) {
                setHistory(cloudData.history || {});
                setWrongBook(cloudData.wrongBook || {});
                setHonorWall(cloudData.honorWall || []);
                location.reload();
            }
        }
    } catch (e) {
        console.error("拉取云端数据失败:", e);
    }
}

// ===== 渲染逻辑 =====
function renderMonthLabel() {
    document.getElementById("currentMonthLabel").textContent = `${currentYear}年${String(currentMonth + 1).padStart(2, "0")}月`;
}

function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const hist = getHistory();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const offset = (firstDay === 0 ? 6 : firstDay - 1);
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
        dayCell.dataset.date = dateISO;
        if (dateISO === selectedDateISO) dayCell.classList.add("selected");

        const dayNumber = document.createElement("div");
        dayNumber.className = "day-number";
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        const dayData = hist[dateISO];
        const acc = dayData ? dayData[currentSubject] : null;
        dayCell.style.background = colorForAccuracy(acc);
        dayCell.style.borderColor = dayCell.style.background;

        dayCell.addEventListener("click", () => setSelected(dateISO));
        grid.appendChild(dayCell);
    }
}

function setSelected(iso) {
    selectedDateISO = iso;
    document.getElementById("selectedDateText").textContent = iso;
    document.getElementById("wrongDateText").textContent = iso;

    const hist = getHistory();
    const data = hist[iso] || {};
    document.getElementById("mathInput").value = data.math ?? "";
    document.getElementById("readingInput").value = data.reading ?? "";
    document.getElementById("spellingInput").value = data.spelling ?? "";

    renderBarForSelectedDay();
    renderWrongListForSelectedDay();
    highlightSelectedCell();
}

function highlightSelectedCell() {
    document.querySelectorAll(".day-cell").forEach(el => {
        el.classList.toggle("selected", el.dataset.date === selectedDateISO);
    });
}

function initBarChart() {
    const ctx = document.getElementById("dayBarChart").getContext("2d");
    if (!ctx) return;
    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["数学", "阅读", "拼写"],
            datasets: [{ data: [0, 0, 0], backgroundColor: ["#93c5fd", "#bbf7d0", "#fde68a"] }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: { legend: { display: false } }
        }
    });
}

function renderBarForSelectedDay() {
    if (!barChart) return;
    const hist = getHistory();
    const day = hist[selectedDateISO] || {};
    barChart.data.datasets[0].data = [day.math || 0, day.reading || 0, day.spelling || 0];
    barChart.update();
}

// ===== 交互功能 =====
function saveDayData() {
    const hist = getHistory();
    hist[selectedDateISO] = {
        math: clamp01(document.getElementById("mathInput").value),
        reading: clamp01(document.getElementById("readingInput").value),
        spelling: clamp01(document.getElementById("spellingInput").value)
    };
    setHistory(hist);
    renderCalendarGrid();
    renderBarForSelectedDay();
    checkMedalForDay();
    syncToCloud();
}

function addWrongToBook() {
    const input = document.getElementById("wrongQuestionInput");
    const val = input.value.trim();
    if (!val) return;
    const wb = getWrongBook();
    wb[selectedDateISO] = wb[selectedDateISO] || [];
    wb[selectedDateISO].push(val);
    setWrongBook(wb);
    input.value = "";
    renderWrongListForSelectedDay();
    renderWrongCalendar();
    syncToCloud();
}

function renderWrongListForSelectedDay() {
    const list = document.getElementById("wrongList");
    if (!list) return;
    list.innerHTML = "";
    const arr = getWrongBook()[selectedDateISO] || [];
    arr.forEach((q, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${q}</span><button onclick="deleteWrong(${idx})">删除</button>`;
        list.appendChild(li);
    });
}

window.deleteWrong = (idx) => {
    const wb = getWrongBook();
    wb[selectedDateISO].splice(idx, 1);
    setWrongBook(wb);
    renderWrongListForSelectedDay();
    renderWrongCalendar();
    syncToCloud();
};

function renderWrongCalendar() {
    const container = document.getElementById("wrongCalendar");
    if (!container) return;
    container.innerHTML = "";
    const wb = getWrongBook();
    Object.keys(wb).sort().forEach(date => {
        if (wb[date].length === 0) return;
        const btn = document.createElement("button");
        btn.textContent = date;
        btn.className = "wrong-date-btn has-wrong";
        btn.onclick = () => setSelected(date);
        container.appendChild(btn);
    });
}

function checkMedalForDay() {
    const day = getHistory()[selectedDateISO] || {};
    const scores = [day.math, day.reading, day.spelling].filter(v => v !== null && v >= 90);
    let medal = scores.length === 3 ? "🥇 金牌" : scores.length === 2 ? "🥈 银牌" : scores.length === 1 ? "🥉 铜牌" : null;
    if (medal) {
        const pop = document.getElementById("medalPopup");
        if (pop) {
            pop.textContent = medal; pop.style.display = "block";
            setTimeout(() => pop.style.display = "none", 3000);
        }
        const hw = getHonorWall();
        hw.push({ date: selectedDateISO, medal });
        setHonorWall(hw);
        renderHonorWall();
    }
}

function renderHonorWall() {
    const wall = document.getElementById("honorWall");
    if (!wall) return;
    wall.innerHTML = getHonorWall().map(i => `<div class="honor-item">${i.date} ${i.medal}</div>`).join("");
}

// ===== 初始化入口 =====
window.addEventListener("DOMContentLoaded", async () => {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);

    renderMonthLabel();
    renderCalendarGrid();
    initBarChart();
    setSelected(selectedDateISO);
    renderWrongCalendar();
    renderHonorWall();

    // 尝试登录云端
    try {
        console.log("正在准备登录...");
        const statusEl = document.getElementById("loginStatus");
        statusEl.textContent = "⏳ 正在验证身份...";

        // 1. 获取现有登录态
        let loginState = await auth.getLoginState();
        console.log("初始登录状态:", loginState);

        // 2. 如果未登录，执行账号密码登录
        if (!loginState) {
            console.log("未检测到登录态，尝试 signInWithPassword...");
            loginState = await auth.signInWithPassword("Jack", "ABCabc123123.");
            console.log("登录接口响应:", loginState);
        }

        // 3. 提取 UID 并更新 UI
        if (loginState && loginState.user) {
            currentUserUID = loginState.user.uid;
            console.log("登录成功，UID:", currentUserUID);

            const displayId = currentUserUID ? String(currentUserUID).slice(0, 6) : "Guest";
            statusEl.innerHTML = `✅ 已连接 (账号: Jack) <small>ID: ${displayId}</small>`;
            statusEl.style.color = "#059669";

            const syncBtn = document.getElementById("syncCloudBtn");
            if (syncBtn) syncBtn.style.display = "block";

            pullFromCloud();
        } else {
            throw new Error("未能获取用户信息，请检查控制台账号设置");
        }
    } catch (e) {
        console.error("云端登录详细错误:", e);
        const statusEl = document.getElementById("loginStatus");
        statusEl.textContent = "❌ 登录失败: " + (e.message || "账号验证未通过");
        statusEl.style.color = "#dc2626";
    }

    // 绑定基础事件
    document.getElementById("prevMonthBtn").onclick = () => { if (currentMonth === 0) { currentMonth = 11; currentYear--; } else { currentMonth--; } renderMonthLabel(); renderCalendarGrid(); highlightSelectedCell(); };
    document.getElementById("nextMonthBtn").onclick = () => { if (currentMonth === 11) { currentMonth = 0; currentYear++; } else { currentMonth++; } renderMonthLabel(); renderCalendarGrid(); highlightSelectedCell(); };
    document.getElementById("todayBtn").onclick = () => { const t = new Date(); currentYear = t.getFullYear(); currentMonth = t.getMonth(); setSelected(formatDate(t)); renderMonthLabel(); renderCalendarGrid(); };
    document.getElementById("saveDayBtn").onclick = saveDayData;
    document.getElementById("addWrongBtn").onclick = addWrongToBook;
    document.getElementById("syncCloudBtn").onclick = syncToCloud;

    const subjectSelect = document.getElementById("subjectSelect");
    if (subjectSelect) {
        subjectSelect.onchange = (e) => { currentSubject = e.target.value; renderCalendarGrid(); renderBarForSelectedDay(); };
    }
});