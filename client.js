// ===== 1. Supabase 配置 =====
const SUPABASE_URL = 'https://jzvpilyvupnichmdkizu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_G3MQ5B-Mp61ecNOc3GrZRQ_S7rSK8V6';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. 全局状态 =====
let currentYear, currentMonth, selectedDateISO, currentUser;
let currentSubject = "math";
let barChart;

// 交互变量：用于存储鼠标/触摸实时位置
let mouseX = -1000;
let mouseY = -1000;

// 分页全局变量
let currentPage = 1;
const ITEMS_PER_PAGE = 6;

// ===== 3. 初始化入口 =====
window.addEventListener("DOMContentLoaded", async () => {
    console.log("应用启动中...");

    initTime();

    // 监听全局交互位置 (适配 PC 和 移动端)
    const updatePos = (e) => {
        mouseX = e.clientX || (e.touches ? e.touches[0].clientX : -1000);
        mouseY = e.clientY || (e.touches ? e.touches[0].clientY : -1000);
    };
    window.addEventListener('mousemove', updatePos);
    window.addEventListener('touchstart', updatePos, { passive: true });
    window.addEventListener('touchmove', updatePos, { passive: true });

    // 初始化动态背景
    initMathBackground();

    // 初始化图表和自定义下拉框
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

// ===== 4. 动态背景生成 (灵动避让版) =====
function initMathBackground() {
    const bg = document.getElementById('math-bg');
    if (!bg) return;

    const symbols = [
        'π', 'x+y', '÷', '×', 'Σ', '∞', '△', '∠A', 'r²',
        'a²+b²', 'sinθ', '10%', 'S=πr²', 'f(x)', '√', '∫'
    ];
    const colors = ['#7b68ee', '#6a5acd', '#483d8b', '#5c4dff', '#9370db'];
    bg.innerHTML = '';

    // 移动端减少数量以保证流畅度
    const count = window.innerWidth < 600 ? 25 : 45;

    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'math-symbol';
        span.innerText = symbols[Math.floor(Math.random() * symbols.length)];

        const isLarge = Math.random() > 0.6;
        const size = isLarge ? (Math.random() * 20 + 25) : (Math.random() * 10 + 15);
        const baseOpacity = isLarge ? 0.2 : 0.1;

        const startXPercent = Math.random() * 100;
        const startYPercent = Math.random() * 100;
        const phase = Math.random() * Math.PI * 2;
        const freq = isLarge ? 0.0008 : 0.0004;
        const symbolColor = colors[Math.floor(Math.random() * colors.length)];

        Object.assign(span.style, {
            position: 'absolute',
            left: `${startXPercent}%`,
            top: `${startYPercent}%`,
            fontSize: `${size}px`,
            opacity: baseOpacity,
            color: symbolColor,
            zIndex: '0',
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none'
        });

        bg.appendChild(span);

        function animate() {
            const time = Date.now() * freq + phase;
            let driftX = Math.sin(time * 0.8) * 40;
            let driftY = Math.cos(time * 0.7) * 40;
            const rotation = Math.sin(time * 0.5) * 20;

            const rect = span.getBoundingClientRect();
            const symbolCenterX = rect.left + rect.width / 2;
            const symbolCenterY = rect.top + rect.height / 2;
            const distance = Math.hypot(mouseX - symbolCenterX, mouseY - symbolCenterY);

            let finalOpacity = baseOpacity;
            let finalScale = 1;

            // 避让算法
            if (distance < 150) {
                const angle = Math.atan2(symbolCenterY - mouseY, symbolCenterX - mouseX);
                const pushForce = (150 - distance) / 150;
                driftX += Math.cos(angle) * pushForce * 60;
                driftY += Math.sin(angle) * pushForce * 60;
                finalOpacity = baseOpacity + (0.5 * pushForce);
                finalScale = 1 + (0.3 * pushForce);
            }

            span.style.transform = `translate(${driftX}px, ${driftY}px) scale(${finalScale}) rotate(${rotation}deg)`;
            span.style.opacity = finalOpacity;
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    }
}

// ===== 5. 核心逻辑与数据处理 =====
function safeGet(id) {
    return document.getElementById(id);
}

function initTime() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// 身份验证逻辑
async function handleLogin() {
    const email = safeGet("emailInput")?.value.trim();
    const password = safeGet("passwordInput")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password) { if (msg) msg.textContent = "❌ 请输入完整信息"; return; }
    msg.textContent = "⏳ 正在登录...";
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error && msg) msg.textContent = "❌ " + error.message;
}

async function handleRegister() {
    const email = safeGet("regEmailInput")?.value.trim();
    const password = safeGet("regPasswordInput")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password || password.length < 6) {
        if (msg) msg.textContent = "❌ 邮箱无效或密码太短"; return;
    }
    const { error } = await sbClient.auth.signUp({ email, password });
    if (msg) msg.textContent = error ? "❌ " + error.message : "✅ 注册成功！请登录";
}

async function handleLogout() {
    await sbClient.auth.signOut();
    localStorage.clear();
    location.reload();
}

function showMainApp() {
    safeGet("authContainer").style.display = "none";
    safeGet("appContainer").style.display = "block";
    syncAllFromCloud();
}

function showAuthForm() {
    safeGet("authContainer").style.display = "block";
    safeGet("appContainer").style.display = "none";
}

function toggleAuthMode(mode) {
    safeGet("loginForm").style.display = mode === 'login' ? 'block' : 'none';
    safeGet("registerForm").style.display = mode === 'reg' ? 'block' : 'none';
    safeGet("showLogin").classList.toggle("active", mode === 'login');
    safeGet("showRegister").classList.toggle("active", mode === 'reg');
}

// ===== 6. 云端数据同步 =====
async function syncAllFromCloud() {
    if (!currentUser) return;
    const statusEl = safeGet("loginStatus");
    if (statusEl) statusEl.textContent = "⏳ 同步中...";

    try {
        const [recordsRes, wrongsRes, honorsRes] = await Promise.all([
            sbClient.from('learning_records').select('*').eq('user_id', currentUser.id),
            sbClient.from('wrong_book').select('*').eq('user_id', currentUser.id),
            sbClient.from('honor_wall').select('*').eq('user_id', currentUser.id)
        ]);

        if (recordsRes.data) {
            const hist = {};
            recordsRes.data.forEach(r => { hist[r.date] = { math: r.math, reading: r.reading, spelling: r.spelling }; });
            localStorage.setItem("accuracyHistory", JSON.stringify(hist));
        }
        if (wrongsRes.data) {
            const wb = {};
            wrongsRes.data.forEach(w => { if (!wb[w.date]) wb[w.date] = []; wb[w.date].push(w.content); });
            localStorage.setItem("wrongBook", JSON.stringify(wb));
        }
        if (honorsRes.data) {
            const hw = honorsRes.data.map(h => ({ date: h.date, medal: h.medal }));
            localStorage.setItem("honorWall", JSON.stringify(hw));
        }

        setSelected(selectedDateISO);
        if (statusEl) statusEl.textContent = `👤 ${currentUser.email}`;
    } catch (e) {
        console.error("同步失败:", e);
    }
}

// ===== 7. UI 渲染渲染汇总 =====
function renderCalendarGrid() {
    const grid = safeGet("calendarGrid");
    const label = safeGet("currentMonthLabel");
    if (!grid) return;
    grid.innerHTML = "";
    label.textContent = `${currentYear}年${currentMonth + 1}月`;

    const hist = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
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

        // 渲染正确率等级颜色
        if (acc !== null && acc !== "") {
            const val = Number(acc);
            if (val < 30) dayCell.classList.add("level-1");
            else if (val < 60) dayCell.classList.add("level-2");
            else if (val < 90) dayCell.classList.add("level-3");
            else dayCell.classList.add("level-4");
        }

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
    const data = JSON.parse(localStorage.getItem("accuracyHistory") || "{}")[selectedDateISO] || {};
    if (barChart) {
        barChart.data.datasets[0].data = [data.math || 0, data.reading || 0, data.spelling || 0];
        barChart.update();
    }
}

function renderWrongListForSelectedDay() {
    const list = safeGet("wrongList");
    if (!list) return;
    const arr = JSON.parse(localStorage.getItem("wrongBook") || "{}")[selectedDateISO] || [];
    if (arr.length === 0) {
        list.innerHTML = `<li style="color:#ccc; font-size:12px; text-align:center; padding:10px;">本日无错题</li>`;
        return;
    }
    list.innerHTML = arr.map((q, i) => `
        <li class="wrong-item">
            <span class="wrong-text">${q}</span>
            <button class="delete-btn" onclick="deleteWrong(${i}, '${q}')">删除</button>
        </li>
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

    const sorted = allHonors.sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
    const paged = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const container = safeGet("honorWall");
    if (paged.length === 0) {
        container.innerHTML = `<div style="grid-column: span 2; color:#ccc; text-align:center; padding:20px;">暂无勋章</div>`;
    } else {
        container.innerHTML = paged.map(item => `
            <div class="honor-item">
                <span style="font-size: 11px; color: #8a87b8;">${item.date}</span>
                <div style="font-size: 15px; margin-top:5px; font-weight:bold;">${item.medal}</div>
            </div>
        `).join("");
    }
    if (safeGet("pageIndicator")) safeGet("pageIndicator").textContent = `第 ${currentPage} / ${totalPages} 页`;
}

// ===== 8. 功能操作函数 =====
function setSelected(iso) {
    selectedDateISO = iso;
    const parts = iso.split("-");
    currentYear = parseInt(parts[0]);
    currentMonth = parseInt(parts[1]) - 1;
    if (safeGet("selectedDateText")) safeGet("selectedDateText").textContent = iso;

    const data = JSON.parse(localStorage.getItem("accuracyHistory") || "{}")[iso] || {};
    if (safeGet("mathInput")) safeGet("mathInput").value = data.math ?? "";
    if (safeGet("readingInput")) safeGet("readingInput").value = data.reading ?? "";
    if (safeGet("spellingInput")) safeGet("spellingInput").value = data.spelling ?? "";

    refreshUI();
}

function refreshUI() {
    renderCalendarGrid();
    renderBarForSelectedDay();
    renderWrongListForSelectedDay();
    renderHonorWall();
    // 错题库历史滑块
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    const container = safeGet("wrongCalendar");
    if (container) {
        const dates = Object.keys(wb).filter(d => wb[d].length > 0).sort((a, b) => new Date(b) - new Date(a));
        container.innerHTML = dates.length ? dates.map(d => `<button class="history-date-badge" onclick="setSelected('${d}')">${d}</button>`).join("") : "暂无历史";
    }
}

async function saveDayData() {
    const btn = safeGet("saveDayBtn");
    const m = Math.min(100, Math.max(0, Number(safeGet("mathInput").value || 0)));
    const r = Math.min(100, Math.max(0, Number(safeGet("readingInput").value || 0)));
    const s = Math.min(100, Math.max(0, Number(safeGet("spellingInput").value || 0)));

    const hist = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    hist[selectedDateISO] = { math: m, reading: r, spelling: s };
    localStorage.setItem("accuracyHistory", JSON.stringify(hist));

    if (currentUser) {
        btn.textContent = "⏳ 同步中...";
        await sbClient.from('learning_records').upsert({
            user_id: currentUser.id, date: selectedDateISO, math: m, reading: r, spelling: s
        }, { onConflict: 'user_id,date' });
        btn.textContent = "✅ 保存成功";
        setTimeout(() => btn.textContent = "保存本日记录", 1500);
    }
    refreshUI();
    checkMedalForDay();
}

async function addWrongToBook() {
    const input = safeGet("wrongQuestionInput");
    const val = input.value.trim();
    if (!val) return;
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    wb[selectedDateISO] = wb[selectedDateISO] || [];
    wb[selectedDateISO].push(val);
    localStorage.setItem("wrongBook", JSON.stringify(wb));
    if (currentUser) {
        await sbClient.from('wrong_book').insert({ user_id: currentUser.id, date: selectedDateISO, content: val });
    }
    input.value = "";
    refreshUI();
}

async function deleteWrong(index, content) {
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    wb[selectedDateISO].splice(index, 1);
    localStorage.setItem("wrongBook", JSON.stringify(wb));
    if (currentUser) {
        await sbClient.from('wrong_book').delete().match({ user_id: currentUser.id, date: selectedDateISO, content: content });
    }
    refreshUI();
}

// ===== 9. 勋章逻辑 (核心修改点) =====
function checkMedalForDay() {
    const data = JSON.parse(localStorage.getItem("accuracyHistory") || "{}")[selectedDateISO] || {};
    const scores = [data.math, data.reading, data.spelling];

    // 必须三个科目都填了数据才触发
    if (scores.some(v => v === undefined || v === null || v === "")) return;

    const count90 = scores.filter(v => Number(v) >= 90).length;
    let medalEmoji = "";
    let medalName = "";

    if (count90 === 3) { medalEmoji = "🥇"; medalName = "🥇 金牌"; }
    else if (count90 === 2) { medalEmoji = "🥈"; medalName = "🥈 银牌"; }
    else if (count90 === 1) { medalEmoji = "🥉"; medalName = "🥉 铜牌"; }

    if (medalEmoji) {
        const popup = safeGet("medalPopup");
        if (popup) {
            popup.innerHTML = `<span>${medalEmoji}</span>`;
            popup.style.display = "flex";
            popup.style.opacity = "1";

            // 手机端震动
            if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 100]);

            setTimeout(() => {
                popup.style.transition = "opacity 1s ease";
                popup.style.opacity = "0";
                setTimeout(() => { popup.style.display = "none"; }, 1000);
            }, 2000);
        }
        addMedalToHonorWall(selectedDateISO, medalName);
    }
}

async function addMedalToHonorWall(date, medal) {
    const honor = JSON.parse(localStorage.getItem("honorWall") || "[]");
    if (honor.some(h => h.date === date && h.medal === medal)) return;
    honor.push({ date, medal });
    localStorage.setItem("honorWall", JSON.stringify(honor));
    if (currentUser) {
        await sbClient.from('honor_wall').insert({ user_id: currentUser.id, date, medal });
    }
    renderHonorWall();
}

// ===== 10. 初始化辅助函数 =====
function initCustomSelect() {
    const trigger = safeGet('selectTrigger');
    const optionsContainer = safeGet('customOptions');
    if (!trigger) return;

    trigger.onclick = (e) => {
        e.stopPropagation();
        optionsContainer.classList.toggle('show');
    };

    document.querySelectorAll('.custom-option').forEach(item => {
        item.onclick = function () {
            currentSubject = this.dataset.value;
            safeGet('selectedOptionText').innerText = this.innerText;
            optionsContainer.classList.remove('show');
            renderCalendarGrid();
        };
    });
    document.addEventListener('click', () => optionsContainer?.classList.remove('show'));
}

function initBarChart() {
    const ctx = safeGet("dayBarChart").getContext("2d");
    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["数学", "阅读", "拼写"],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ["#7b68ee", "#84cc16", "#facc15"],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: { legend: { display: false } }
        }
    });
}

function bindEvents() {
    safeGet("prevMonthBtn").onclick = () => { if (--currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendarGrid(); };
    safeGet("nextMonthBtn").onclick = () => { if (++currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendarGrid(); };
    safeGet("saveDayBtn").onclick = saveDayData;
    safeGet("addWrongBtn").onclick = addWrongToBook;
    safeGet("prevPageBtn").onclick = () => { if (currentPage > 1) { currentPage--; renderHonorWall(); } };
    safeGet("nextPageBtn").onclick = () => {
        const total = Math.ceil(JSON.parse(localStorage.getItem("honorWall") || "[]").length / ITEMS_PER_PAGE);
        if (currentPage < total) { currentPage++; renderHonorWall(); }
    };
}