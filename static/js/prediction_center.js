// 全局变量
let currentPredictions = {};
let singleChart = null;
let multiChart = null;
let selectedSingleParameter = null;
let selectedMultiParameters = new Set();

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    checkDataStatus();
    loadParameters();
    setupEventListeners();
    setupModelDescription();
});

// 数据状态检查
async function checkDataStatus() {
    try {
        const response = await fetch('/api/prediction/status');
        const data = await response.json();
        if (response.ok && data.status === 'success') {
            showSuccess(`数据加载成功: ${data.data_shape[0]} 条记录`);
        }
    } catch (error) {
        showError('无法连接到数据服务');
    }
}

// 重新加载数据
async function reloadData() {
    try {
        const response = await fetch('/api/prediction/reload', {method: 'POST'});
        const data = await response.json();
        if (response.ok && data.success) {
            showSuccess(data.message);
            await loadParameters();
        }
    } catch (error) {
        showError('重新加载数据失败');
    }
}

// 加载参数列表
async function loadParameters() {
    try {
        const response = await fetch('/api/prediction/parameters');
        const data = await response.json();
        if (response.ok) renderParameterLists(data);
    } catch (error) {
        showError('加载参数列表失败');
    }
}

// 渲染参数列表
function renderParameterLists(parameters) {
    const singleList = document.getElementById('parameterList');
    const multiList = document.getElementById('multiParameterList');

    singleList.innerHTML = '';
    multiList.innerHTML = '';

    parameters.forEach(param => {
        singleList.appendChild(createParameterBadge(param, 'single'));
        multiList.appendChild(createParameterBadge(param, 'multi'));
    });
}

// 创建参数徽章
function createParameterBadge(param, type) {
    const badge = document.createElement('div');
    badge.className = 'parameter-badge';
    badge.textContent = param.name;
    badge.dataset.id = param.id;
    badge.title = `${param.name} (${param.unit})`;

    badge.addEventListener('click', () => {
        type === 'single'
            ? selectSingleParameter(param.id, param.name, badge)
            : toggleMultiParameter(param.id, param.name, badge);
    });

    return badge;
}

// 选择单参数
function selectSingleParameter(paramId, paramName, element) {
    selectedSingleParameter = paramId;
    document.querySelectorAll('#parameterList .parameter-badge').forEach(badge => {
        badge.classList.remove('selected');
    });
    element.classList.add('selected');
    document.getElementById('currentParameter').textContent = `当前参数: ${paramName}`;
}

// 切换多参数选择
function toggleMultiParameter(paramId, paramName, element) {
    if (selectedMultiParameters.has(paramId)) {
        selectedMultiParameters.delete(paramId);
        element.classList.remove('selected');
    } else {
        selectedMultiParameters.add(paramId);
        element.classList.add('selected');
    }
    updateMultiSelectionCount();
}

// 更新多选计数
function updateMultiSelectionCount() {
    const count = selectedMultiParameters.size;
    const multiTab = document.getElementById('multi-tab');
    multiTab.innerHTML = `<i class="fas fa-chart-pie me-2"></i>多变量联合预测${count > 0 ? ` <span class="badge bg-primary">${count}</span>` : ''}`;
}

// 设置事件监听器
function setupEventListeners() {
    document.getElementById('singlePredictBtn').addEventListener('click', () => performPrediction('single'));
    document.getElementById('multiPredictBtn').addEventListener('click', () => performPrediction('multi'));
    document.getElementById('exportBtn').addEventListener('click', exportPredictions);
    document.getElementById('modelSelect').addEventListener('change', updateModelDescription);
}

// 设置模型说明
function setupModelDescription() {
    updateModelDescription();
}

// 更新模型说明
function updateModelDescription() {
    const modelSelect = document.getElementById('modelSelect');
    const description = document.getElementById('modelDescription');
    description.textContent = modelSelect.value === 'linear'
        ? '线性回归：适用于线性趋势预测，计算速度快，适合初步分析'
        : '随机森林：适用于复杂非线性关系，预测精度高，适合精细分析';
}

// 执行预测（合并单参数和多参数）
async function performPrediction(type) {
    const isSingle = type === 'single';
    const selectedParams = isSingle ? [selectedSingleParameter] : Array.from(selectedMultiParameters);

    // 验证输入
    if (selectedParams.length === 0 || (isSingle && !selectedParams[0])) {
        showError(`请先选择要预测的${isSingle ? '参数' : '至少一个参数'}`);
        return;
    }

    const forecastHours = document.getElementById(isSingle ? 'forecastHours' : 'multiForecastHours').value;
    if (forecastHours < 1 || forecastHours > 168) {
        showError('预测时长应在1-168小时之间');
        return;
    }

    // 显示加载状态
    const loadingElement = document.getElementById(`${type}ChartLoading`);
    const predictBtn = document.getElementById(`${type}PredictBtn`);
    loadingElement.style.display = 'flex';
    predictBtn.disabled = true;

    try {
        const endpoint = isSingle ? '/api/prediction/single' : '/api/prediction/multi';
        const requestBody = isSingle ? {
            parameter: selectedParams[0],
            model: document.getElementById('modelSelect').value,
            hours: parseInt(forecastHours)
        } : {
            parameters: selectedParams,
            hours: parseInt(forecastHours)
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            currentPredictions[type] = data;
            isSingle ? renderSinglePredictionChart(data) : renderMultiPredictionChart(data);
            isSingle ? updatePerformanceMetrics(data.model_performance) : updateMultiPerformanceMetrics(data.results);
            document.getElementById('exportBtn').disabled = false;
            showSuccess(`${isSingle ? '单参数' : '多变量'}预测完成！`);
        } else {
            showError('预测失败: ' + (data.error || '未知错误'));
        }
    } catch (error) {
        showError('网络错误: ' + error.message);
    } finally {
        loadingElement.style.display = 'none';
        predictBtn.disabled = false;
    }
}

// 渲染单参数预测图表
function renderSinglePredictionChart(data) {
    const ctx = document.getElementById('singlePredictionChart').getContext('2d');
    if (singleChart) singleChart.destroy();

    const historyData = data.history.map(item => ({x: new Date(item.time), y: item.value}));
    const predictionData = data.predictions.map(item => ({x: new Date(item.time), y: item.value}));

    singleChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: '历史数据',
                    data: historyData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                },
                {
                    label: '预测数据',
                    data: predictionData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3
                }
            ]
        },
        options: getChartOptions('水质参数预测趋势分析')
    });
}

// 渲染多变量预测图表
function renderMultiPredictionChart(data) {
    const ctx = document.getElementById('multiPredictionChart').getContext('2d');
    if (multiChart) multiChart.destroy();

    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const datasets = [];

    Object.keys(data.results).forEach((param, index) => {
        datasets.push({
            label: param,
            data: data.results[param].predictions.map(item => ({
                x: new Date(item.time),
                y: item.value
            })),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            borderWidth: 2,
            tension: 0.4,
            fill: false
        });
    });

    multiChart = new Chart(ctx, {
        type: 'line',
        data: {datasets: datasets},
        options: getChartOptions('多变量预测趋势对比')
    });
}

// 获取图表配置
function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {intersect: false, mode: 'index'},
        plugins: {
            title: {display: true, text: title, font: {size: 16, weight: 'bold'}},
            tooltip: {mode: 'index', intersect: false},
            legend: {display: true, position: 'top'}
        },
        scales: {
            x: {
                type: 'time',
                time: {unit: 'hour', displayFormats: {hour: 'MM-dd HH:mm'}},
                title: {display: true, text: '时间'}
            },
            y: {
                beginAtZero: false,
                title: {display: true, text: '参数数值'}
            }
        }
    };
}

// 更新性能指标
function updatePerformanceMetrics(performance) {
    document.getElementById('r2Score').textContent = performance.r2.toFixed(4);
    document.getElementById('mseScore').textContent = performance.mse.toFixed(6);
    document.getElementById('maeScore').textContent = performance.mae.toFixed(4);

    const r2Element = document.getElementById('r2Score').parentElement;
    r2Element.className = 'performance-metric';
    if (performance.r2 > 0.7) r2Element.classList.add('bg-success');
    else if (performance.r2 > 0.5) r2Element.classList.add('bg-warning');
    else r2Element.classList.add('bg-danger');
}

// 更新多变量性能指标
function updateMultiPerformanceMetrics(results) {
    const container = document.getElementById('multiPerformanceMetrics');
    container.innerHTML = '';

    Object.keys(results).forEach(param => {
        const r2 = results[param].r2_score;
        let colorClass = r2 > 0.7 ? 'bg-success' : r2 > 0.5 ? 'bg-warning' : 'bg-danger';

        const col = document.createElement('div');
        col.className = 'col-md-4 mb-3';
        col.innerHTML = `
            <div class="performance-metric ${colorClass}">
                <div class="value">${r2.toFixed(4)}</div>
                <div class="label">${param} - R² 分数</div>
            </div>
        `;
        container.appendChild(col);
    });
}

// 导出预测结果
async function exportPredictions() {
    if (!currentPredictions.single && !currentPredictions.multi) {
        showError('没有可导出的预测结果');
        return;
    }

    try {
        const response = await fetch('/api/prediction/export', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({predictions: currentPredictions})
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `water_quality_predictions_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showSuccess('预测结果导出成功！');
        }
    } catch (error) {
        showError('导出错误: ' + error.message);
    }
}

// 消息提示函数
function showError(message) {
    showMessage(message, 'danger', 'exclamation-circle');
}

function showSuccess(message) {
    showMessage(message, 'success', 'check-circle');
}

function showMessage(message, type, icon) {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-${icon} me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    toastContainer.appendChild(toast);
    new bootstrap.Toast(toast).show();
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}