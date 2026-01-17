// ===== 1. Supabase 核心配置 (已整合你的真实参数) =====
const SUPABASE_URL = 'https://jzvpilyvupnichmdkizu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G3MQ5B-Mp61ecNOc3GrZRQ_S7rSK8V6';

// 使用 sbClient 命名，彻底避开 Identifier 'supabase' has already been declared 报错
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let selectedDateISO = new Date().toISOString().split('T')[0];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

// ===== 2. 初始化逻辑：自动登录与云端拉取 =====
async function initApp() {
    const statusEl = document.getElementById("loginStatus");

    try {
        // 检查持久化登录状态
        let { data: { user } } = await sbClient.auth.getUser();

        if (!user) {
            statusEl.textContent = "⏳ 正在连接并自动登录...";
            // 💡 重要：请确保你在 Supabase 控制台 Authentication -> Users 里手动创建了这个账号
            const { data, error } = await sbClient.auth.signInWithPassword({
                email: 'jack@example.com',
                password: 'ABCabc123123.'
            });
            if (error) throw error;
            user = data.user;
        }

        currentUser = user;
        statusEl.textContent = `✅ 云端已同步: ${user.email}`;
        statusEl.style.color = "#059669";

        // 登录成功后，立即拉取历史记录覆盖本地缓存
        await loadDataFromCloud();

    } catch (e) {
        console.error("初始化失败:", e);
        statusEl.textContent = "❌ 连接失败: " + e.message;
        statusEl.style.color = "#dc2626";
    }
}

// ===== 3. 云端同步核心函数 =====

// 【同步：将今日数据推送到云端】
async function saveToCloud() {
    if (!currentUser) return alert("同步失败：用户尚未连接到云端");

    const m = parseInt(document.getElementById("mathInput").value) || 0;
    const r = parseInt(document.getElementById("readingInput").value) || 0;
    const s = parseInt(document.getElementById("spellingInput").value) || 0;

    const btn = document.getElementById("saveDayBtn");
    btn.textContent = "⏳ 正在同步...";
    btn.disabled = true;

    // upsert 逻辑：如果该日期已存在则更新，不存在则插入
    const { error } = await sbClient
        .from('learning_records')
        .upsert({
            user_id: currentUser.id,
            date: selectedDateISO,
            math: m,
            reading: r,
            spelling: s
        });

    btn.disabled = false;
    if (error) {
        alert("同步到云端失败: " + error.message);
        btn.textContent = "❌ 重试";
    } else {
        // 更新本地 localStorage 以保持 UI 响应
        updateLocalStorage(selectedDateISO, { math: m, reading: r, spelling: s });
        btn.textContent = "✅ 同步成功";
        setTimeout(() => btn.textContent = "💾 保存并同步到云端", 1500);
        renderCalendar();
    }
}

// 【拉取：从云端下载所有历史记录】
async function loadDataFromCloud() {
    if (!currentUser) return;

    const { data, error } = await sbClient
        .from('learning_records')
        .select('*');

    if (error) {
        console.error("数据下载失败:", error);
        return;
    }

    // 将数据库数组结构转换为本地对象结构
    const history = {};
    data.forEach(item => {
        history[item.date] = {
            math: item.math,
            reading: item.reading,
            spelling: item.spelling
        };
    });
    localStorage.setItem("accuracyHistory", JSON.stringify(history));
    renderUI();
}

// ===== 4. UI 渲染辅助函数 =====

function updateLocalStorage(date, data) {
    const history = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    history[date] = data;
    localStorage.setItem("accuracyHistory", JSON.stringify(history));
}

function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const history = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    document.getElementById("currentMonthLabel").textContent = `${currentYear}年${currentMonth + 1}月`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = document.createElement("div");
        cell.className = "day-cell";
        cell.textContent = d;

        const data = history[dateStr];
        if (data) {
            const avg = (data.math + data.reading + data.spelling) / 3;
            cell.style.background = avg > 80 ? "#bbf7d0" : (avg > 0 ? "#fecaca" : "");
        }

        if (dateStr === selectedDateISO) cell.classList.add("selected");
        cell.onclick = () => { selectedDateISO = dateStr; renderUI(); };
        grid.appendChild(cell);
    }
}

function renderUI() {
    document.getElementById("selectedDateText").textContent = `日期: ${selectedDateISO}`;
    const history = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    const data = history[selectedDateISO] || { math: "", reading: "", spelling: "" };

    document.getElementById("mathInput").value = data.math;
    document.getElementById("readingInput").value = data.reading;
    document.getElementById("spellingInput").value = data.spelling;
    renderCalendar();
}

// ===== 5. 启动绑定 =====
document.addEventListener("DOMContentLoaded", () => {
    initApp();

    const saveBtn = document.getElementById("saveDayBtn");
    if (saveBtn) saveBtn.onclick = saveToCloud;

    document.getElementById("prevMonthBtn").onclick = () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    };
    document.getElementById("nextMonthBtn").onclick = () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    };
});