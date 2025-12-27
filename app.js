// ===== 常量与工具 =====
const SUBJECTS = ["math", "reading", "spelling"];
const SUBJECT_LABELS = { math: "数学", reading: "英语阅读", spelling: "英语拼写" };

let currentYear, currentMonth;
let selectedDateISO;
let currentSubject = "math"; // 默认着色科目

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

// ===== 本地存储 =====
function getHistory() {
    return JSON.parse(localStorage.getItem("accuracyHistory") || "{}");
}
function setHistory(hist) {
    localStorage.setItem("accuracyHistory", JSON.stringify(hist));
}
function getWrongBook() {
    return JSON.parse(localStorage.getItem("wrongBook") || "{}");
}
function setWrongBook(wb) {
    localStorage.setItem("wrongBook", JSON.stringify(wb));
}

// ===== 日期状态 =====
function setToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDateISO = formatDate(today);
}
function setSelected(iso) {
    selectedDateISO = iso;
    document.getElementById("selectedDateText").textContent = iso;
    document.getElementById("wrongDateText").textContent = iso;
    loadInputsForSelectedDay();
    renderBarForSelectedDay();
    highlightSelectedCell();
    renderWrongListForSelectedDay();
}

// ===== 日历渲染 =====
function renderMonthLabel() {
    const label = document.getElementById("currentMonthLabel");
    label.textContent = `${currentYear}年${String(currentMonth + 1).padStart(2, "0")}月`;
}
function firstDayOffset(year, month) {
    const d = new Date(year, month, 1);
    const map = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };
    return map[d.getDay()];
}
function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}
function subjectAccuracy(dayData, subject) {
    if (!dayData) return null;
    const v = dayData[subject];
    return typeof v === "number" ? v : null;
}

function renderCalendarGrid() {
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const hist = getHistory();

    const offset = firstDayOffset(currentYear, currentMonth);
    const totalDays = daysInMonth(currentYear, currentMonth);
    const cells = [];

    for (let i = 0; i < offset; i++) {
        const blank = document.createElement("div");
        blank.className = "day-cell";
        blank.style.visibility = "hidden";
        cells.push(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dateISO = formatDate(new Date(currentYear, currentMonth, day));
        const dayCell = document.createElement("div");
        dayCell.className = "day-cell";
        dayCell.dataset.date = dateISO;

        const dayNumber = document.createElement("div");
        dayNumber.className = "day-number";
        dayNumber.textContent = String(day);
        dayCell.appendChild(dayNumber);

        const acc = subjectAccuracy(hist[dateISO], currentSubject);
        dayCell.style.background = colorForAccuracy(acc);
        dayCell.style.borderColor = dayCell.style.background;

        if (dateISO === selectedDateISO) {
            dayCell.classList.add("selected");
        }

        dayCell.addEventListener("click", () => {
            setSelected(dateISO);
        });

        cells.push(dayCell);
    }

    cells.forEach(c => grid.appendChild(c));
}
function highlightSelectedCell() {
    document.querySelectorAll(".day-cell").forEach(el => {
        el.classList.remove("selected");
        if (el.dataset.date === selectedDateISO) {
            el.classList.add("selected");
        }
    });
}

// ===== 数据录入 =====
function loadInputsForSelectedDay() {
    const hist = getHistory();
    const data = hist[selectedDateISO] || {};
    document.getElementById("mathInput").value = data.math ?? "";
    document.getElementById("readingInput").value = data.reading ?? "";
    document.getElementById("spellingInput").value = data.spelling ?? "";
}
function saveDayData() {
    const mathVal = clamp01(document.getElementById("mathInput").value);
    const readingVal = clamp01(document.getElementById("readingInput").value);
    const spellingVal = clamp01(document.getElementById("spellingInput").value);

    const hist = getHistory();
    hist[selectedDateISO] = hist[selectedDateISO] || {};
    if (mathVal !== null) hist[selectedDateISO].math = mathVal;
    if (readingVal !== null) hist[selectedDateISO].reading = readingVal;
    if (spellingVal !== null) hist[selectedDateISO].spelling = spellingVal;
    setHistory(hist);

    renderCalendarGrid();
    renderBarForSelectedDay();
}
function clearDayData() {
    const hist = getHistory();
    delete hist[selectedDateISO];
    setHistory(hist);
    document.getElementById("mathInput").value = "";
    document.getElementById("readingInput").value = "";
    document.getElementById("spellingInput").value = "";
    renderCalendarGrid();
    renderBarForSelectedDay();
}

// ===== 柱状图 =====
let barChart;
function initBarChart() {
    const ctx = document.getElementById("dayBarChart").getContext("2d");
    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["数学", "英语阅读", "英语拼写"],
            datasets: [{
                label: "正确率(%)",
                data: [0, 0, 0],
                backgroundColor: ["#93c5fd", "#bbf7d0", "#fde68a"]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { stepSize: 10 } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `正确率：${ctx.parsed.y}%`
                    }
                }
            }
        }
    });
}
function renderBarForSelectedDay() {
    const hist = getHistory();
    const day = hist[selectedDateISO] || {};
    const vals = [
        typeof day.math === "number" ? day.math : 0,
        typeof day.reading === "number" ? day.reading : 0,
        typeof day.spelling === "number" ? day.spelling : 0
    ];

    const colors = ["#93c5fd", "#bbf7d0", "#fde68a"];
    const highlightColors = { math: "#2563eb", reading: "#22c55e", spelling: "#f59e0b" };
    const idx = SUBJECTS.indexOf(currentSubject);
    colors[idx] = highlightColors[currentSubject];

    barChart.data.datasets[0].data = vals;
    barChart.data.datasets[0].backgroundColor = colors;
    barChart.update();
}

// ===== 错题本 =====
function renderWrongListForSelectedDay() {
    const wb = getWrongBook();
    const list = document.getElementById("wrongList");
    list.innerHTML = "";
    const arr = wb[selectedDateISO] || [];
    arr.forEach((q, idx) => {
        const li = document.createElement("li");
        const text = document.createElement("span");
        text.textContent = q;
        const delBtn = document.createElement("button");
        delBtn.textContent = "删除";
        delBtn.addEventListener("click", () => {
            const wbNow = getWrongBook();
            (wbNow[selectedDateISO] = wbNow[selectedDateISO] || []).splice(idx, 1);
            setWrongBook(wbNow);
            renderWrongListForSelectedDay();
        });
        li.appendChild(text);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

function addWrongToBook() {
    const input = document.getElementById("wrongQuestionInput");
    const val = (input.value || "").trim();
    if (!val) return;
    const wb = getWrongBook();
    wb[selectedDateISO] = wb[selectedDateISO] || [];
    wb[selectedDateISO].push(val);
    setWrongBook(wb);
    input.value = "";
    renderWrongListForSelectedDay();
}

function clearWrongForDay() {
    const wb = getWrongBook();
    delete wb[selectedDateISO];
    setWrongBook(wb);
    renderWrongListForSelectedDay();
}

// ===== 导出 CSV =====
function exportToCSV() {
    const hist = getHistory();
    const wb = getWrongBook();

    let csv = "日期,数学正确率,英语阅读正确率,英语拼写正确率,错题\n";
    const allDates = new Set([...Object.keys(hist), ...Object.keys(wb)]);
    const sortedDates = Array.from(allDates).sort();

    sortedDates.forEach(date => {
        const day = hist[date] || {};
        const wrongs = wb[date] ? wb[date].join("; ") : "";
        const math = day.math ?? "";
        const reading = day.reading ?? "";
        const spelling = day.spelling ?? "";
        csv += `${date},${math},${reading},${spelling},"${wrongs}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "学习成长记录.csv";
    a.click();
    URL.revokeObjectURL(url);
}

// ===== 月份切换 =====
function gotoPrevMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear -= 1;
    } else {
        currentMonth -= 1;
    }
    renderMonthLabel();
    renderCalendarGrid();
    highlightSelectedCell();
}

function gotoNextMonth() {
    if (currentMonth === 11) {
        currentMonth = 0;
        currentYear += 1;
    } else {
        currentMonth += 1;
    }
    renderMonthLabel();
    renderCalendarGrid();
    highlightSelectedCell();
}

function gotoToday() {
    setToToday();
    renderMonthLabel();
    renderCalendarGrid();
    setSelected(selectedDateISO);
}

// ===== 初始化 =====
window.addEventListener("DOMContentLoaded", () => {
    setToToday();
    renderMonthLabel();
    renderCalendarGrid();

    initBarChart();
    setSelected(selectedDateISO);

    document.getElementById("prevMonthBtn").addEventListener("click", gotoPrevMonth);
    document.getElementById("nextMonthBtn").addEventListener("click", gotoNextMonth);
    document.getElementById("todayBtn").addEventListener("click", gotoToday);

    document.getElementById("saveDayBtn").addEventListener("click", saveDayData);
    document.getElementById("clearDayBtn").addEventListener("click", clearDayData);

    document.getElementById("addWrongBtn").addEventListener("click", addWrongToBook);
    document.getElementById("clearWrongForDayBtn").addEventListener("click", clearWrongForDay);

    document.getElementById("exportCsvBtn").addEventListener("click", exportToCSV);

    document.getElementById("subjectSelect").addEventListener("change", (e) => {
        currentSubject = e.target.value;
        renderCalendarGrid();
        renderBarForSelectedDay();
    });
});
