// 初始化图表函数
function createChart(ctxId, label) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['正确率', '错误率'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#4CAF50', '#F44336']
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: label
                }
            }
        }
    });
}

// 创建三个图表
let charts = {
    math: createChart('mathChart', '数学正确率'),
    reading: createChart('readingChart', '英语阅读正确率'),
    spelling: createChart('spellingChart', '英语拼写正确率')
};

// 更新正确率
function updateAccuracy(subject) {
    let inputId = subject + 'Input';
    let value = document.getElementById(inputId).value;
    if (value < 0 || value > 100) {
        alert("请输入0-100之间的数值");
        return;
    }
    localStorage.setItem(subject + 'Accuracy', value);
    charts[subject].data.datasets[0].data = [value, 100 - value];
    charts[subject].update();
}

// 错题本功能
function addWrong() {
    let question = document.getElementById('wrongQuestion').value;
    if (!question) return;
    let list = document.getElementById('wrongList');
    let li = document.createElement('li');
    li.textContent = question;
    list.appendChild(li);

    // 保存到 localStorage
    let wrongs = JSON.parse(localStorage.getItem('wrongs') || '[]');
    wrongs.push(question);
    localStorage.setItem('wrongs', JSON.stringify(wrongs));

    document.getElementById('wrongQuestion').value = "";
}

// 页面加载时恢复数据
window.onload = () => {
    ['math', 'reading', 'spelling'].forEach(subject => {
        let saved = localStorage.getItem(subject + 'Accuracy');
        if (saved) {
            charts[subject].data.datasets[0].data = [saved, 100 - saved];
            charts[subject].update();
        }
    });

    let wrongs = JSON.parse(localStorage.getItem('wrongs') || '[]');
    wrongs.forEach(q => {
        let li = document.createElement('li');
        li.textContent = q;
        document.getElementById('wrongList').appendChild(li);
    });
};
