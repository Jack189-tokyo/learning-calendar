﻿// ===== 1. Supabase 配置 =====
const SUPABASE_URL = 'https://jzvpilyvupnichmdkizu.supabase.co';
// 注意：这里使用的是 anon (public) key，是可以暴露在前端的。
// 安全性依赖于 Supabase 数据库中必须开启 RLS (Row Level Security) 策略！
const SUPABASE_KEY = 'sb_publishable_G3MQ5B-Mp61ecNOc3GrZRQ_S7rSK8V6';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. 全局状态 =====
let currentYear, currentMonth, selectedDateISO, currentUser;
let currentSubject = "math";
let isRecoveryMode = false; // 新增：标记是否处于密码重置模式
let barChart;
let mouseX = -1000, mouseY = -1000;
let currentPage = 1;
const ITEMS_PER_PAGE = 6;

// ===== 3. 初始化入口 =====
window.addEventListener("DOMContentLoaded", async () => {
    console.log("应用启动中...");
    initTime();

    // 监听全局交互位置
    const updatePos = (e) => {
        mouseX = e.clientX || (e.touches ? e.touches[0].clientX : -1000);
        mouseY = e.clientY || (e.touches ? e.touches[0].clientY : -1000);
    };
    window.addEventListener('mousemove', updatePos);
    window.addEventListener('touchstart', updatePos, { passive: true });
    window.addEventListener('touchmove', updatePos, { passive: true });

    initMathBackground();
    if (document.getElementById("dayBarChart")) initBarChart();
    initCustomSelect();

    // 核心修复：监听 Auth 状态并在状态变化时重新绑定事件
    sbClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user;
        
        // 检测是否是点击重置密码邮件进来的
        if (event === 'PASSWORD_RECOVERY' || isRecoveryMode) {
            isRecoveryMode = true;
            showMainApp();
            updateUserProfileUI(); // 更新头像和昵称显示
            // 自动打开弹窗并提示
            const modal = safeGet("profileModal");
            if (modal) modal.style.display = "flex";
            const oldInput = safeGet("oldPasswordInput");
            if (oldInput) oldInput.style.display = "none"; // 隐藏旧密码框
            alert("正在进行密码重置，请直接输入新密码并保存");
        } else if (currentUser) {
            isRecoveryMode = false;
            const oldInput = safeGet("oldPasswordInput");
            if (oldInput) oldInput.style.display = "block"; // 恢复显示
            updateUserProfileUI();
            showMainApp();
        } else {
            showAuthForm();
        }
        // 关键：UI 切换后，必须重新运行一次绑定，否则新显示的按钮点不动
        bindEvents(); 
    });
});

// ===== 4. 动态背景 (灵动避让版) =====
function initMathBackground() {
    const bg = document.getElementById('math-bg');
    if (!bg) return;
    const symbols = ['π', 'x+y', '÷', '×', 'Σ', '∞', '△', '∠A', 'r²', 'a²+b²', 'sinθ', '10%', 'S=πr²', 'f(x)', '√', '∫'];
    const colors = ['#7b68ee', '#6a5acd', '#483d8b', '#5c4dff', '#9370db'];
    bg.innerHTML = '';
    const count = window.innerWidth < 600 ? 25 : 45;

    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'math-symbol';
        span.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        const isLarge = Math.random() > 0.6;
        const size = isLarge ? (Math.random() * 20 + 25) : (Math.random() * 10 + 15);
        Object.assign(span.style, {
            position: 'absolute', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            fontSize: `${size}px`, opacity: isLarge ? 0.2 : 0.1, color: colors[Math.floor(Math.random() * colors.length)],
            zIndex: '0', transition: 'opacity 0.3s ease', pointerEvents: 'none'
        });
        bg.appendChild(span);

        const phase = Math.random() * Math.PI * 2;
        const freq = isLarge ? 0.0008 : 0.0004;

        function animate() {
            const time = Date.now() * freq + phase;
            let driftX = Math.sin(time * 0.8) * 40;
            let driftY = Math.cos(time * 0.7) * 40;
            const rect = span.getBoundingClientRect();
            const symbolCenterX = rect.left + rect.width / 2;
            const symbolCenterY = rect.top + rect.height / 2;
            const dist = Math.hypot(mouseX - symbolCenterX, mouseY - symbolCenterY);

            if (dist < 150) {
                const angle = Math.atan2(symbolCenterY - mouseY, symbolCenterX - mouseX);
                const push = (150 - dist) / 150;
                driftX += Math.cos(angle) * push * 60;
                driftY += Math.sin(angle) * push * 60;
            }
            span.style.transform = `translate(${driftX}px, ${driftY}px) rotate(${Math.sin(time * 0.5) * 20}deg)`;
            requestAnimationFrame(animate);
        }
        animate();
    }
}

// ===== 5. 核心逻辑与数据处理 =====
function safeGet(id) { return document.getElementById(id); }

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

async function handleLogin() {
    const email = safeGet("emailInput")?.value.trim() || safeGet("authEmail")?.value.trim();
    const password = safeGet("passwordInput")?.value || safeGet("authPassword")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password) { if (msg) msg.textContent = "❌ 请输入完整信息"; return; }
    if (msg) msg.textContent = "⏳ 正在登录...";
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error && msg) msg.textContent = "❌ " + error.message;
}

// 修改：处理忘记密码 - 切换到 OTP 登录界面
function handleForgotPassword() {
    safeGet("loginForm").style.display = "none";
    safeGet("otpLoginForm").style.display = "block";
    safeGet("authMsg").textContent = "";
    // 预填邮箱
    const loginEmail = safeGet("emailInput")?.value.trim();
    if (loginEmail) safeGet("otpEmailInput").value = loginEmail;
}

function handleBackToLogin() {
    safeGet("otpLoginForm").style.display = "none";
    safeGet("loginForm").style.display = "block";
    safeGet("authMsg").textContent = "";
}

async function handleSendOtp() {
    const email = safeGet("otpEmailInput")?.value.trim();
    const msg = safeGet("authMsg");
    const btn = safeGet("sendOtpBtn");

    if (!email) { if (msg) msg.textContent = "❌ 请输入邮箱"; return; }
    
    if (btn) { btn.disabled = true; btn.textContent = "发送中..."; }
    if (msg) msg.textContent = "⏳ 正在发送验证码...";

    // 发送 OTP (Magic Link 也会作为验证码发送)
    const { error } = await sbClient.auth.signInWithOtp({ email });

    if (error) {
        if (btn) { btn.disabled = false; btn.textContent = "获取验证码"; }
        if (msg) msg.textContent = "❌ " + error.message;
    } else {
        if (msg) msg.textContent = "✅ 验证码已发送，请查收邮件";
        safeGet("otpCodeInput")?.focus();
        if (btn) {
            let count = 60;
            btn.textContent = `${count}s`;
            const timer = setInterval(() => {
                count--;
                if (count <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = "获取验证码";
                } else {
                    btn.textContent = `${count}s`;
                }
            }, 1000);
        }
    }
}

async function handleOtpLogin() {
    const email = safeGet("otpEmailInput")?.value.trim();
    const token = safeGet("otpCodeInput")?.value.trim();
    const msg = safeGet("authMsg");

    if (!email || !token) { if (msg) msg.textContent = "❌ 请输入邮箱和验证码"; return; }
    if (msg) msg.textContent = "⏳ 正在验证...";

    // 验证 OTP 并登录
    const { data, error } = await sbClient.auth.verifyOtp({ email, token, type: 'email' });

    if (error) { if (msg) msg.textContent = "❌ " + error.message; }
    else {
        isRecoveryMode = true; // 标记为恢复模式
        // 手动触发弹窗，确保在 Auth 状态变化前或后都能正确打开
        const modal = safeGet("profileModal");
        if (modal) modal.style.display = "flex";
        const oldInput = safeGet("oldPasswordInput");
        if (oldInput) oldInput.style.display = "none";
        alert("验证成功！请设置新密码");
    }
}

async function handleRegister() {
    const email = safeGet("regEmailInput")?.value.trim() || safeGet("authEmail")?.value.trim();
    const password = safeGet("regPasswordInput")?.value || safeGet("authPassword")?.value;
    const msg = safeGet("authMsg");
    if (!email || !password || password.length < 6) { if (msg) msg.textContent = "❌ 邮箱无效或密码需至少6位"; return; }
    if (msg) msg.textContent = "⏳ 正在注册...";
    const { error } = await sbClient.auth.signUp({ email, password });
    if (error && msg) msg.textContent = "❌ " + error.message;
    else if (msg) {
        msg.textContent = "✅ 注册成功！请登录";
        setTimeout(() => toggleAuthMode('login'), 1500);
    }
}

// 彻底修复退出逻辑
async function handleLogout() {
    console.log("执行退出...");
    try {
        await sbClient.auth.signOut();
        localStorage.clear();
        window.location.replace(window.location.origin + window.location.pathname);
    } catch (e) {
        localStorage.clear();
        location.reload();
    }
}

function showMainApp() {
    if (safeGet("authContainer")) safeGet("authContainer").style.display = "none";
    if (safeGet("appContainer")) safeGet("appContainer").style.display = "block";
    syncAllFromCloud();
}

function showAuthForm() {
    if (safeGet("authContainer")) safeGet("authContainer").style.display = "block";
    if (safeGet("appContainer")) safeGet("appContainer").style.display = "none";
}

function toggleAuthMode(mode) {
    if (safeGet("loginForm")) safeGet("loginForm").style.display = mode === 'login' ? 'block' : 'none';
    if (safeGet("registerForm")) safeGet("registerForm").style.display = mode === 'reg' ? 'block' : 'none';
    safeGet("showLogin")?.classList.toggle("active", mode === 'login');
    safeGet("showRegister")?.classList.toggle("active", mode === 'reg');
    if (safeGet("authMsg")) safeGet("authMsg").textContent = "";
}

// ===== 6. 云端数据同步 =====
async function syncAllFromCloud() {
    if (!currentUser) return;
    try {
        const [recordsRes, wrongsRes, honorsRes] = await Promise.all([
            sbClient.from('learning_records').select('*').eq('user_id', currentUser.id),
            sbClient.from('wrong_book').select('*').eq('user_id', currentUser.id),
            sbClient.from('honor_wall').select('*').eq('user_id', currentUser.id)
        ]);

        if (recordsRes.data) {
            const hist = {};
            recordsRes.data.forEach(r => hist[r.date] = { math: r.math, reading: r.reading, spelling: r.spelling });
            localStorage.setItem("accuracyHistory", JSON.stringify(hist));
        }
        if (wrongsRes.data) {
            const wb = {};
            wrongsRes.data.forEach(w => { if (!wb[w.date]) wb[w.date] = []; wb[w.date].push(w.content); });
            localStorage.setItem("wrongBook", JSON.stringify(wb));
        }
        if (honorsRes.data) {
            localStorage.setItem("honorWall", JSON.stringify(honorsRes.data.map(h => ({ date: h.date, medal: h.medal }))));
        }
        setSelected(selectedDateISO);
    } catch (e) { console.error("同步失败:", e); }
}

// ===== 7. UI 渲染渲染汇总 =====
function renderCalendarGrid() {
    const grid = safeGet("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (safeGet("currentMonthLabel")) safeGet("currentMonthLabel").textContent = `${currentYear}年${currentMonth + 1}月`;

    const hist = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement("div"));

    for (let day = 1; day <= totalDays; day++) {
        const dateISO = formatDate(new Date(currentYear, currentMonth, day));
        const dayCell = document.createElement("div");
        dayCell.className = "day-cell" + (dateISO === selectedDateISO ? " selected" : "");

        const data = hist[dateISO];
        const acc = data ? data[currentSubject] : null;
        if (acc !== null && acc !== "") {
            const v = Number(acc);
            if (v < 30) dayCell.classList.add("level-1");
            else if (v < 60) dayCell.classList.add("level-2");
            else if (v < 90) dayCell.classList.add("level-3");
            else dayCell.classList.add("level-4");
        }
        dayCell.onclick = () => setSelected(dateISO);
        dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        grid.appendChild(dayCell);
    }
}

function renderBarForSelectedDay() {
    if (!barChart) return;
    const data = JSON.parse(localStorage.getItem("accuracyHistory") || "{}")[selectedDateISO] || {};
    barChart.data.datasets[0].data = [data.math || 0, data.reading || 0, data.spelling || 0];
    barChart.update();
}

function renderWrongListForSelectedDay() {
    const list = safeGet("wrongList");
    if (!list) return;
    const arr = JSON.parse(localStorage.getItem("wrongBook") || "{}")[selectedDateISO] || [];
    list.innerHTML = arr.length === 0 ? `<li style="color:#ccc; font-size:12px; text-align:center; padding:10px;">本日无错题</li>` :
        arr.map((q, i) => `<li class="wrong-item"><span class="wrong-text">${q}</span><button class="delete-btn" onclick="deleteWrong(${i}, '${q}')">删除</button></li>`).join("");
}

function renderHonorWall() {
    const all = JSON.parse(localStorage.getItem("honorWall") || "[]").sort((a,b) => b.date.localeCompare(a.date));
    const stats = { gold: 0, silver: 0, bronze: 0 };
    all.forEach(h => {
        if (h.medal.includes("金")) stats.gold++;
        else if (h.medal.includes("银")) stats.silver++;
        else if (h.medal.includes("铜")) stats.bronze++;
    });

    if (safeGet("goldCount")) safeGet("goldCount").textContent = stats.gold;
    if (safeGet("silverCount")) safeGet("silverCount").textContent = stats.silver;
    if (safeGet("bronzeCount")) safeGet("bronzeCount").textContent = stats.bronze;

    const totalPages = Math.max(1, Math.ceil(all.length / ITEMS_PER_PAGE));
    const paged = all.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const container = safeGet("honorWall");
    if (!container) return;
    container.innerHTML = paged.length === 0 ? `<div style="grid-column: span 2; color:#ccc; text-align:center;">暂无勋章</div>` :
        paged.map(h => `<div class="honor-item"><span style="font-size: 11px; color:#8a87b8;">${h.date}</span><div>${h.medal}</div></div>`).join("");
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
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    const container = safeGet("wrongCalendar");
    if (container) {
        const dates = Object.keys(wb).filter(d => wb[d].length > 0).sort((a, b) => b.localeCompare(a));
        container.innerHTML = dates.length ? dates.map(d => `<button class="history-date-badge" onclick="setSelected('${d}')">${d}</button>`).join("") : "暂无历史";
    }
}

async function saveDayData() {
    const btn = safeGet("saveDayBtn");
    const m = Math.min(100, Math.max(0, Number(safeGet("mathInput")?.value || 0)));
    const r = Math.min(100, Math.max(0, Number(safeGet("readingInput")?.value || 0)));
    const s = Math.min(100, Math.max(0, Number(safeGet("spellingInput")?.value || 0)));
    const hist = JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
    hist[selectedDateISO] = { math: m, reading: r, spelling: s };
    localStorage.setItem("accuracyHistory", JSON.stringify(hist));

    if (currentUser) {
        if (btn) btn.textContent = "⏳ 同步中...";
        
        // 修复 400 错误：手动检查记录是否存在，代替 upsert (避免依赖数据库唯一约束)
        const { data: existing } = await sbClient.from('learning_records').select('id').eq('user_id', currentUser.id).eq('date', selectedDateISO);
        
        let error;
        if (existing && existing.length > 0) {
            // 存在则更新
            const res = await sbClient.from('learning_records').update({ math: m, reading: r, spelling: s }).eq('id', existing[0].id);
            error = res.error;
        } else {
            // 不存在则插入
            const res = await sbClient.from('learning_records').insert({ user_id: currentUser.id, date: selectedDateISO, math: m, reading: r, spelling: s });
            error = res.error;
        }

        if (error) { console.error("保存失败:", error); if (btn) btn.textContent = "❌ 保存失败"; }
        else if (btn) { btn.textContent = "✅ 保存成功"; setTimeout(() => btn.textContent = "保存本日记录", 1500); }
    }
    refreshUI();
    checkMedalForDay();
}

async function addWrongToBook() {
    const input = safeGet("wrongQuestionInput");
    const val = input?.value.trim();
    if (!val) return;
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    if (!wb[selectedDateISO]) wb[selectedDateISO] = [];
    wb[selectedDateISO].push(val);
    localStorage.setItem("wrongBook", JSON.stringify(wb));
    if (currentUser) await sbClient.from('wrong_book').insert({ user_id: currentUser.id, date: selectedDateISO, content: val });
    if (input) input.value = "";
    refreshUI();
}

async function deleteWrong(idx, content) {
    const wb = JSON.parse(localStorage.getItem("wrongBook") || "{}");
    wb[selectedDateISO].splice(idx, 1);
    localStorage.setItem("wrongBook", JSON.stringify(wb));
    if (currentUser) await sbClient.from('wrong_book').delete().match({ user_id: currentUser.id, date: selectedDateISO, content: content });
    refreshUI();
}

// ===== 9. 勋章逻辑 =====
function checkMedalForDay() {
    const data = JSON.parse(localStorage.getItem("accuracyHistory") || "{}")[selectedDateISO] || {};
    const scores = [data.math, data.reading, data.spelling];
    if (scores.some(v => v === undefined || v === null || v === "")) return;
    const count90 = scores.filter(v => Number(v) >= 90).length;
    let emoji = "", name = "";
    if (count90 === 3) { emoji = "🥇"; name = "🥇 金牌"; }
    else if (count90 === 2) { emoji = "🥈"; name = "🥈 银牌"; }
    else if (count90 === 1) { emoji = "🥉"; name = "🥉 铜牌"; }

    if (emoji) {
        const p = safeGet("medalPopup");
        if (p) {
            p.innerHTML = `<span>${emoji}</span>`;
            p.style.display = "flex"; p.style.opacity = "1";
            setTimeout(() => { p.style.opacity = "0"; setTimeout(() => p.style.display = "none", 300); }, 800);
        }
        addMedalToHonorWall(selectedDateISO, name);
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

// ===== 新增：个人信息管理逻辑 =====
function updateUserProfileUI() {
    if (!currentUser) return;
    const meta = currentUser.user_metadata || {};
    // 如果没有设置昵称，显示邮箱前缀
    const displayName = meta.full_name || currentUser.email.split('@')[0];
    // 如果没有头像，使用 ui-avatars 生成一个基于名字的默认头像
    const avatarUrl = meta.avatar_url || `https://ui-avatars.com/api/?name=${displayName}&background=7b68ee&color=fff&size=128&length=1&bold=true`;

    const nameEl = safeGet("currentNickname");
    const imgEl = safeGet("currentAvatar");
    
    if (nameEl) nameEl.textContent = displayName;
    if (imgEl) {
        imgEl.src = avatarUrl;
        imgEl.style.display = "block";
    }
}

async function handleUpdateProfile() {
    const nick = safeGet("nicknameInput").value.trim();
    const fileInput = safeGet("avatarFileInput");
    const file = fileInput?.files[0];
    const btn = safeGet("saveProfileBtn");
    
    if (btn) btn.textContent = "⏳ 处理中...";
    
    let publicAvatarUrl = null;

    // 1. 如果选择了新图片，先上传到 Supabase Storage
    if (file) {
        if (btn) btn.textContent = "⏳ 上传图片...";
        try {
            const fileExt = file.name.split('.').pop();
            // 使用 用户ID/时间戳.后缀 避免文件名冲突
            const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await sbClient.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = sbClient.storage.from('avatars').getPublicUrl(filePath);
            publicAvatarUrl = data.publicUrl;
        } catch (error) {
            console.error("头像上传失败:", error);
            alert("头像上传失败: " + error.message + "\n请确保已在 Supabase 创建 'avatars' 公开存储桶。");
            if (btn) btn.textContent = "保存基本信息";
            return;
        }
    }
    
    const updates = {};
    if (nick) updates.full_name = nick;
    if (publicAvatarUrl) updates.avatar_url = publicAvatarUrl;

    // 如果没有修改任何内容
    if (Object.keys(updates).length === 0) {
        if (btn) btn.textContent = "保存基本信息";
        return;
    }

    const { data, error } = await sbClient.auth.updateUser({ data: updates });
    
    if (error) {
        alert("更新失败: " + error.message);
        if (btn) btn.textContent = "保存基本信息";
    } else {
        if (btn) btn.textContent = "✅ 保存成功";
        currentUser = data.user; // 更新本地用户对象
        updateUserProfileUI();
        // 清空文件选择
        if (fileInput) fileInput.value = "";
        setTimeout(() => {
            if (btn) btn.textContent = "保存基本信息";
            safeGet("profileModal").style.display = "none";
        }, 1000);
    }
}

async function handleUpdatePassword() {
    const oldPwd = safeGet("oldPasswordInput").value;
    const newPwd = safeGet("newPasswordInput").value;
    const confirmPwd = safeGet("confirmPasswordInput").value;
    const btn = safeGet("updatePwdBtn");
    
    if (!newPwd || newPwd.length < 6) {
        alert("新密码长度至少需要6位");
        return;
    }

    if (newPwd !== confirmPwd) {
        alert("两次输入的密码不一致，请重新输入");
        return;
    }
    
    // 只有在非重置模式下，才强制验证旧密码
    if (!isRecoveryMode) {
        if (!oldPwd) {
            alert("请输入旧密码以验证身份");
            return;
        }
        
        if (btn) btn.textContent = "⏳ 验证旧密码...";

        // 1. 尝试用旧密码重新登录以验证身份
        const { error: signInError } = await sbClient.auth.signInWithPassword({
            email: currentUser.email,
            password: oldPwd
        });

        if (signInError) {
            alert("旧密码错误，验证失败");
            if (btn) btn.textContent = "更新密码";
            return;
        }
    }
    
    // 2. 执行更新
    if (btn) btn.textContent = "⏳ 更新中...";
    const { error } = await sbClient.auth.updateUser({ password: newPwd });
    
    if (error) {
        alert("密码更新失败: " + error.message);
        if (btn) btn.textContent = "更新密码";
    } else {
        if (btn) btn.textContent = "✅ 密码已更新";
        safeGet("oldPasswordInput").value = "";
        safeGet("newPasswordInput").value = "";
        safeGet("confirmPasswordInput").value = "";
        
        // 如果是重置模式，更新成功后恢复正常模式
        if (isRecoveryMode) {
            isRecoveryMode = false;
            alert("密码重置成功！下次请使用新密码登录。");
            safeGet("profileModal").style.display = "none";
        }
        
        setTimeout(() => { if (btn) btn.textContent = "更新密码"; }, 2000);
    }
}

// ===== 10. 初始化辅助函数 =====
function initCustomSelect() {
    const trigger = safeGet('selectTrigger'), container = safeGet('customOptions');
    if (!trigger) return;
    trigger.onclick = (e) => { e.stopPropagation(); container.classList.toggle('show'); };
    document.querySelectorAll('.custom-option').forEach(item => {
        item.onclick = function() {
            currentSubject = this.dataset.value;
            safeGet('selectedOptionText').innerText = this.innerText;
            container.classList.remove('show');
            renderCalendarGrid();
        };
    });
    document.addEventListener('click', () => container?.classList.remove('show'));
}

function initBarChart() {
    const canvas = safeGet("dayBarChart");
    if (!canvas) return;
    barChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: { labels: ["数学", "阅读", "拼写"], datasets: [{ data: [0, 0, 0], backgroundColor: ["#7b68ee", "#84cc16", "#facc15"], borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });
}

function bindEvents() {
    const bind = (id, fn) => { const el = safeGet(id); if (el) el.onclick = fn; };
    
    // 导航与操作
    bind("prevMonthBtn", () => { if (--currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendarGrid(); });
    bind("nextMonthBtn", () => { if (++currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendarGrid(); });
    bind("saveDayBtn", saveDayData);
    bind("addWrongBtn", addWrongToBook);
    bind("prevPageBtn", () => { if (currentPage > 1) { currentPage--; renderHonorWall(); } });
    bind("nextPageBtn", () => {
        const total = Math.ceil(JSON.parse(localStorage.getItem("honorWall") || "[]").length / ITEMS_PER_PAGE);
        if (currentPage < total) { currentPage++; renderHonorWall(); }
    });

    // Auth 切换
    bind("showLogin", () => toggleAuthMode('login'));
    bind("showRegister", () => toggleAuthMode('reg'));

    // 核心按钮
    bind("loginBtn", handleLogin);
    bind("submitLogin", handleLogin);
    bind("signupBtn", handleRegister);
    bind("submitRegister", handleRegister);
    bind("regBtn", handleRegister);
    bind("forgotPwdBtn", handleForgotPassword); // 绑定忘记密码按钮
    bind("backToLoginBtn", handleBackToLogin);
    bind("sendOtpBtn", handleSendOtp);
    bind("otpLoginBtn", handleOtpLogin);

    // 优化验证码输入：限制数字、支持粘贴过滤
    const otpInput = safeGet("otpCodeInput");
    if (otpInput) {
        otpInput.oninput = (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        };
    }
    
    // 退出按钮 (在此处确保 ID 匹配)
    bind("logoutBtn", handleLogout);

    // 新增：个人信息相关事件
    bind("userInfoTrigger", () => {
        const modal = safeGet("profileModal");
        if (modal) {
            modal.style.display = "flex";
            // 填充当前值
            safeGet("nicknameInput").value = currentUser?.user_metadata?.full_name || "";
            
            // 设置弹窗内的预览图
            const currentUrl = currentUser?.user_metadata?.avatar_url;
            const displayName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || "U";
            const defaultUrl = `https://ui-avatars.com/api/?name=${displayName}&background=7b68ee&color=fff&size=128&length=1&bold=true`;
            
            const preview = safeGet("modalAvatarPreview");
            if (preview) preview.src = currentUrl || defaultUrl;
            
            // 清空文件输入
            const fileInput = safeGet("avatarFileInput");
            if (fileInput) {
                fileInput.value = "";
                // 绑定选择文件后的即时预览
                fileInput.onchange = (e) => {
                    const f = e.target.files[0];
                    if (f && preview) preview.src = URL.createObjectURL(f);
                };
            }
        }
    });
    bind("closeProfileBtn", () => safeGet("profileModal").style.display = "none");
    bind("saveProfileBtn", handleUpdateProfile);
    bind("updatePwdBtn", handleUpdatePassword);
}