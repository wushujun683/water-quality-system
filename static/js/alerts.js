// 预警监控中心 - 修复完整版
class AlertsCenter {
    constructor() {
        this.alerts = [];
        this.alertRules = {};
        this.isLoading = false;
        this.refreshInterval = null;
        this.filteredAlerts = [];
        this.isFiltered = false;
        this.currentFilter = {};
        this.init();
    }

    async init() {
        console.log('🚀 初始化预警监控中心...');
        this.setupEventListeners();
        await this.loadAlertRules();
        await this.loadHistoricalAlerts();
        this.initCharts();
        this.setupAutoRefresh();
        console.log('✅ 预警监控中心初始化完成');
    }

    async loadAlertRules() {
        try {
            const response = await fetch('/api/alerts/rules');
            const data = await response.json();
            if (data.success) {
                this.alertRules = data.rules;
                this.renderRules();
            }
        } catch (error) {
            console.error('❌ 加载预警规则失败:', error);
        }
    }

    async loadHistoricalAlerts() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const response = await fetch('/api/alerts/historical');
            const data = await response.json();
            if (data.success) {
                this.alerts = data.alerts || [];
                this.updateAlertOverview();
                this.renderAlertsList();
                this.updateCharts();
            }
        } catch (error) {
            console.error('❌ 加载历史预警失败:', error);
        } finally {
            this.isLoading = false;
        }
    }

    initCharts() {
        const trendChartEl = document.getElementById('alert-trend-chart');
        const distributionChartEl = document.getElementById('parameter-distribution-chart');

        if (trendChartEl) this.trendChart = echarts.init(trendChartEl);
        if (distributionChartEl) this.distributionChart = echarts.init(distributionChartEl);
    }

    setupEventListeners() {
        const refreshBtn = document.querySelector('.btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefresh());
        }
    }

    setupAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => this.loadHistoricalAlerts(), 30000);
    }

    updateAlertOverview() {
        try {
            const alertsToCount = this.isFiltered ? this.filteredAlerts : this.alerts;

            const criticalCount = alertsToCount.filter(a => a.level === 'critical' && a.status === 'active').length;
            const warningCount = alertsToCount.filter(a => a.level === 'warning' && a.status === 'active').length;
            const attentionCount = alertsToCount.filter(a => a.level === 'attention' && a.status === 'active').length;
            const resolvedCount = alertsToCount.filter(a => a.status === 'resolved').length;

            this.safeUpdateElement('critical-count', criticalCount);
            this.safeUpdateElement('warning-count', warningCount);
            this.safeUpdateElement('attention-count', attentionCount);
            this.safeUpdateElement('resolved-count', resolvedCount);

        } catch (error) {
            console.error('❌ 更新预警概览失败:', error);
        }
    }

    safeUpdateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`⚠️ 元素 #${elementId} 未找到`);
        }
    }

    renderAlertsList() {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) return;

        let alertsToShow = this.isFiltered ? this.filteredAlerts : this.alerts;
        alertsToShow = alertsToShow
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);

        if (alertsToShow.length === 0) {
            alertsList.innerHTML = this.getNoAlertsHTML();
            return;
        }

        let alertsHTML = this.isFiltered ? this.getFilterStatusHTML() : '';
        alertsToShow.forEach(alert => {
            alertsHTML += this.getAlertItemHTML(alert);
        });

        alertsList.innerHTML = alertsHTML;
    }

    getNoAlertsHTML() {
        if (this.isFiltered) {
            const startStr = this.currentFilter.start || '最早';
            const endStr = this.currentFilter.end || '最新';
            return `
                <div class="no-alerts">
                    <i class="fas fa-search"></i>
                    <p>在 ${startStr} 至 ${endStr} 时间段内未找到预警记录</p>
                </div>
            `;
        } else {
            return `
                <div class="no-alerts">
                    <i class="fas fa-check-circle"></i>
                    <p>当前无预警信息</p>
                </div>
            `;
        }
    }

    getFilterStatusHTML() {
        const count = this.filteredAlerts.length;
        const startStr = this.currentFilter.start || '最早';
        const endStr = this.currentFilter.end || '最新';

        const criticalCount = this.filteredAlerts.filter(a => a.level === 'critical').length;
        const warningCount = this.filteredAlerts.filter(a => a.level === 'warning').length;
        const attentionCount = this.filteredAlerts.filter(a => a.level === 'attention').length;

        return `
            <div class="filter-status">
                <i class="fas fa-filter"></i>
                显示 ${startStr} 至 ${endStr} 的预警 (${count}条)
                <span style="margin-left: 10px;">
                    严重: ${criticalCount} | 警告: ${warningCount} | 关注: ${attentionCount}
                </span>
                <button class="btn-reset" onclick="resetFilter()">
                    <i class="fas fa-times"></i> 清除筛选
                </button>
            </div>
        `;
    }

    getAlertItemHTML(alert) {
        const time = new Date(alert.timestamp).toLocaleString('zh-CN');
        const statusBadge = alert.status === 'active' ?
            '<span style="color: #e74c3c; font-size: 0.8em;">● 活跃</span>' :
            '<span style="color: #7f8c8d; font-size: 0.8em;">○ 已处理</span>';

        return `
            <div class="alert-item ${alert.level}">
                <div class="alert-icon-small">
                    <i class="fas fa-${this.getAlertIcon(alert.level)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-message">
                        ${alert.message}
                        ${statusBadge}
                    </div>
                    <div class="alert-details">
                        <span class="alert-parameter">${this.getParameterName(alert.parameter)}</span>
                        <span class="alert-value">${alert.current_value} ${alert.unit}</span>
                        <span class="alert-time">${time}</span>
                    </div>
                </div>
            </div>
        `;
    }

    filterAlerts() {
        const startDateInput = document.getElementById('start-date').value;
        const endDateInput = document.getElementById('end-date').value;

        if (!startDateInput && !endDateInput) {
            this.resetFilter();
            return;
        }

        this.currentFilter = { start: startDateInput, end: endDateInput };
        this.isFiltered = true;

        this.filteredAlerts = this.alerts.filter(alert => {
            const alertDate = new Date(alert.timestamp).toISOString().split('T')[0];
            let valid = true;
            if (startDateInput) valid = valid && alertDate >= startDateInput;
            if (endDateInput) valid = valid && alertDate <= endDateInput;
            return valid;
        });

        this.updateAlertOverview();
        this.updateCharts();
        this.renderAlertsList();
    }

    resetFilter() {
        document.getElementById('start-date').value = '';
        document.getElementById('end-date').value = '';
        this.isFiltered = false;
        this.currentFilter = {};
        this.updateCharts();
        this.renderAlertsList();
    }

    renderRules() {
        const rulesContent = document.getElementById('rules-content');
        if (!rulesContent) return;

        let rulesHTML = '';
        Object.entries(this.alertRules).forEach(([parameter, rules]) => {
            Object.entries(rules).forEach(([level, threshold]) => {
                rulesHTML += this.getRuleItemHTML(parameter, level, threshold);
            });
        });

        rulesContent.innerHTML = rulesHTML || `
            <div class="no-alerts">
                <i class="fas fa-cogs"></i>
                <p>暂无预警规则配置</p>
            </div>
        `;
    }

    getRuleItemHTML(parameter, level, threshold) {
        const hasMin = threshold.min !== undefined;
        const hasMax = threshold.max !== undefined;

        return `
            <div class="rule-item ${level}">
                <div class="rule-header">
                    <div class="rule-title">
                        <i class="fas fa-${this.getParameterIcon(parameter)}"></i>
                        ${this.getParameterName(parameter)} ${this.getLevelName(level)}预警
                    </div>
                    <div class="rule-level ${level}">
                        <i class="fas fa-${this.getAlertIcon(level)}"></i>
                        ${this.getLevelName(level)}
                    </div>
                </div>
                <div class="rule-thresholds">
                    ${hasMin ? `
                        <div class="threshold-item">
                            <div class="threshold-label">最低阈值</div>
                            <div class="threshold-value">${threshold.min} ${this.getParameterUnit(parameter)}</div>
                        </div>
                    ` : ''}
                    ${hasMax ? `
                        <div class="threshold-item">
                            <div class="threshold-label">最高阈值</div>
                            <div class="threshold-value">${threshold.max} ${this.getParameterUnit(parameter)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    updateCharts() {
        this.renderTrendChart();
        this.renderDistributionChart();
    }

    renderTrendChart() {
        if (!this.trendChart) return;

        try {
            const alertsToUse = this.isFiltered ? this.filteredAlerts : this.alerts;
            const dateRange = this.isFiltered && this.currentFilter.start && this.currentFilter.end ?
                this.getFilterDateRange() : this.getLast30Days();

            const dailyData = this.calculateDailyAlertCounts(alertsToUse, dateRange);
            const option = this.getTrendChartOption(dailyData, dateRange);

            this.trendChart.setOption(option);
        } catch (error) {
            console.error('❌ 渲染趋势图表失败:', error);
        }
    }

    renderDistributionChart() {
        if (!this.distributionChart) return;

        try {
            const alertsToUse = this.isFiltered ? this.filteredAlerts : this.alerts;
            const parameterDistribution = this.calculateParameterDistribution(alertsToUse);
            const option = this.getDistributionChartOption(parameterDistribution);

            this.distributionChart.setOption(option);
        } catch (error) {
            console.error('❌ 渲染分布图表失败:', error);
        }
    }

    // ========== 缺失的工具方法 ==========
    getLast30Days() {
        const dataEnd = new Date('2024-06-27'); // 你的数据结束时间
        const dates = [];

        for (let i = 29; i >= 0; i--) {
            const date = new Date(dataEnd);
            date.setDate(dataEnd.getDate() - i);

            // 只添加在数据范围内的日期
            if (date >= new Date('2023-08-04')) {
                dates.push(date.toISOString().split('T')[0]);
            }
        }

        return dates;
    }

    getFilterDateRange() {
        const dates = [];
        if (this.currentFilter.start && this.currentFilter.end) {
            const start = new Date(this.currentFilter.start);
            const end = new Date(this.currentFilter.end);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

            for (let i = 0; i <= days; i++) {
                const date = new Date(start);
                date.setDate(start.getDate() + i);
                dates.push(date.toLocaleDateString('zh-CN'));
            }
        }
        return dates;
    }

    calculateDailyAlertCounts(alerts, dateRange) {
        const dailyData = {};
        dateRange.forEach(date => {
            dailyData[date] = { critical: 0, warning: 0, attention: 0 };
        });

        alerts.forEach(alert => {
            const date = new Date(alert.timestamp).toLocaleDateString('zh-CN');
            if (dailyData[date]) {
                dailyData[date][alert.level]++;
            }
        });

        return dailyData;
    }

    calculateParameterDistribution(alerts) {
        const parameterDistribution = {};
        alerts.forEach(alert => {
            if (!parameterDistribution[alert.parameter]) {
                parameterDistribution[alert.parameter] = { critical: 0, warning: 0, attention: 0 };
            }
            parameterDistribution[alert.parameter][alert.level]++;
        });

        const data = Object.entries(parameterDistribution).map(([param, counts]) => ({
            name: this.getParameterName(param),
            value: counts.critical + counts.warning + counts.attention,
            itemStyle: { color: this.getParameterColor(param) }
        }));

        return data;
    }

    getTrendChartOption(dailyData, dateRange) {
        const dates = dateRange.map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        const criticalData = dateRange.map(date => dailyData[date].critical);
        const warningData = dateRange.map(date => dailyData[date].warning);
        const attentionData = dateRange.map(date => dailyData[date].attention);

        const titleText = this.isFiltered ?
            `预警趋势 (${this.currentFilter.start} 至 ${this.currentFilter.end})` :
            '预警趋势';

        return {
            title: { text: titleText, left: 'center' },
            tooltip: { trigger: 'axis' },
            legend: { data: ['严重预警', '警告预警', '关注预警'], top: 35 },
            grid: { left: '50px', right: '30px', bottom: '30px', top: '70px' },
            xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45 } },
            yAxis: { type: 'value' },
            series: [
                { name: '严重预警', type: 'line', data: criticalData, itemStyle: { color: '#e74c3c' } },
                { name: '警告预警', type: 'line', data: warningData, itemStyle: { color: '#f39c12' } },
                { name: '关注预警', type: 'line', data: attentionData, itemStyle: { color: '#27ae60' } }
            ]
        };
    }

    getDistributionChartOption(data) {
        const titleText = this.isFiltered ? '预警参数分布 (筛选后)' : '预警参数分布';

        return {
            title: { text: titleText, left: 'center' },
            tooltip: { trigger: 'item' },
            legend: { orient: 'vertical', left: 'left', top: 'center' },
            series: [{
                name: '预警分布',
                type: 'pie',
                radius: ['45%', '70%'],
                center: ['60%', '50%'],
                data: data.sort((a, b) => b.value - a.value),
                emphasis: { itemStyle: { shadowBlur: 10 } },
                label: { formatter: '{b}: {c} ({d}%)' }
            }]
        };
    }

    getParameterColor(parameter) {
        const colors = {
            'temperature': '#e74c3c',
            'dissolved_oxygen': '#3498db',
            'ph': '#9b59b6',
            'turbidity': '#f39c12',
            'chlorophyll': '#27ae60'
        };
        return colors[parameter] || '#95a5a6';
    }
    // ========== 工具方法结束 ==========

    getAlertIcon(level) {
        const icons = { 'critical': 'exclamation-triangle', 'warning': 'exclamation-circle', 'attention': 'info-circle' };
        return icons[level] || 'info-circle';
    }

    getParameterIcon(parameter) {
        const icons = { 'temperature': 'thermometer-half', 'dissolved_oxygen': 'wind', 'ph': 'vial', 'turbidity': 'tint' };
        return icons[parameter] || 'cog';
    }

    getParameterName(parameter) {
        const names = { 'temperature': '温度', 'dissolved_oxygen': '溶解氧', 'ph': 'pH值', 'turbidity': '浊度' ,'chlorophyll': '叶绿素'};
        return names[parameter] || parameter;
    }

    getLevelName(level) {
        const names = { 'critical': '严重', 'warning': '警告', 'attention': '关注' };
        return names[level] || level;
    }

    getParameterUnit(parameter) {
        const units = { 'temperature': '°C', 'dissolved_oxygen': 'mg/L', 'ph': '', 'turbidity': 'NTU' };
        return units[parameter] || '';
    }

    handleRefresh() {
        this.loadHistoricalAlerts();
    }

    destroy() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.trendChart) this.trendChart.dispose();
        if (this.distributionChart) this.distributionChart.dispose();
    }
}

// 全局函数
function refreshAlerts() {
    if (window.alertsCenter) window.alertsCenter.handleRefresh();
}

function filterAlerts() {
    if (window.alertsCenter) window.alertsCenter.filterAlerts();
}

function resetFilter() {
    if (window.alertsCenter) window.alertsCenter.resetFilter();
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    window.alertsCenter = new AlertsCenter();
});

window.addEventListener('beforeunload', function() {
    if (window.alertsCenter) window.alertsCenter.destroy();
});