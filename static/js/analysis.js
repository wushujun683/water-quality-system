// 水质分析中心 - 修复版（解决图表容器尺寸问题）
class AnalysisCenter {
    constructor() {
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('初始化水质分析中心...');
        this.setupEventListeners();
        // 只初始化第一个标签页的图表
        await this.initActiveChart();
        await this.loadOverviewData();
        await this.loadTrendData('monthly');
        console.log('水质分析中心初始化完成');
    }

    async initActiveChart() {
        // 只初始化当前活动标签页的图表
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            const chartContainer = activeTab.querySelector('.chart-container');
            if (chartContainer) {
                await this.initChart(chartContainer.id);
            }
        }
    }

    initChart(chartId) {
        return new Promise((resolve) => {
            const element = document.getElementById(chartId);
            if (element && typeof echarts !== 'undefined') {
                // 确保容器可见且有尺寸
                if (element.offsetParent !== null) {
                    this.charts[chartId] = echarts.init(element);
                    console.log(`✅ 初始化图表: ${chartId}`);
                } else {
                    console.log(`⏳ 延迟初始化图表: ${chartId} (容器不可见)`);
                }
            }
            resolve();
        });
    }

    async loadOverviewData() {
        try {
            const response = await fetch('/api/analysis/overview');
            const data = await response.json();
            if (data.success) this.updateMetrics(data.metrics);
        } catch (error) {
            console.error('概览数据加载失败:', error);
        }
    }

    async loadTrendData(granularity = 'monthly') {
        try {
            const response = await fetch(`/api/analysis/trend?granularity=${granularity}`);
            const data = await response.json();
            if (data.success) this.renderTrendChart(data.trend_data);
        } catch (error) {
            console.error('趋势数据加载失败:', error);
        }
    }

    async loadCorrelationData() {
        try {
            const response = await fetch('/api/analysis/correlation');
            const data = await response.json();
            if (data.success) this.renderCorrelationChart(data.correlation_data);
        } catch (error) {
            console.error('相关性数据加载失败:', error);
        }
    }

    async loadDistributionData() {
        try {
            const response = await fetch('/api/analysis/distribution');
            const data = await response.json();
            if (data.success) this.renderDistributionChart(data.distribution_data);
        } catch (error) {
            console.error('分布数据加载失败:', error);
        }
    }

    async loadCalendarData() {
        try {
            const response = await fetch('/api/analysis/calendar');
            const data = await response.json();
            if (data.success) this.renderCalendarChart(data.calendar_data);
        } catch (error) {
            console.error('日历数据加载失败:', error);
        }
    }

    renderTrendChart(trendData) {
        const chart = this.charts['trend-chart'];
        if (!chart) {
            console.error('趋势图表实例不存在');
            return;
        }

        const option = {
            title: { text: '水质时间趋势', left: 'center' },
            tooltip: { trigger: 'axis' },
            legend: { data: ['温度', '溶解氧', 'pH值', '浊度', '叶绿素'], top: 35 },
            grid: { left: '60px', right: '40px', bottom: '40px', top: '80px' },
            xAxis: {
                type: 'category',
                data: trendData.dates,
                axisLabel: { rotate: 45 }
            },
            yAxis: { type: 'value' },
            series: [
                {
                    name: '温度',
                    type: 'line',
                    data: trendData.temperature,
                    lineStyle: { color: '#e74c3c', width: 3 },
                    smooth: true
                },
                {
                    name: '溶解氧',
                    type: 'line',
                    data: trendData.dissolved_oxygen,
                    lineStyle: { color: '#3498db', width: 3 },
                    smooth: true
                },
                {
                    name: 'pH值',
                    type: 'line',
                    data: trendData.ph,
                    lineStyle: { color: '#2ecc71', width: 3 },
                    smooth: true
                },
                {
                    name: '浊度',
                    type: 'line',
                    data: trendData.turbidity || [],
                    lineStyle: { color: '#f39c12', width: 2 },
                    smooth: true
                },
                {
                    name: '叶绿素',
                    type: 'line',
                    data: trendData.chlorophyll || [],
                    lineStyle: { color: '#9b59b6', width: 2 },
                    smooth: true
                }
            ]
        };

        chart.setOption(option);

        // 确保图表重绘
        setTimeout(() => {
            chart.resize();
            console.log('趋势图表重绘完成');
        }, 100);
    }

    renderCorrelationChart(correlationData) {
        const chart = this.charts['correlation-chart'];
        if (!chart) {
            console.error('相关性图表实例不存在');
            return;
        }

        const option = {
            title: { text: '参数相关性分析', left: 'center' },
            tooltip: {
                formatter: params => `${params.data[0]} vs ${params.data[1]}<br/>相关性: ${params.data[2].toFixed(3)}`
            },
            grid: { left: '100px', right: '100px', bottom: '100px', top: '60px' },
            xAxis: {
                type: 'category',
                data: correlationData.parameters,
                axisLabel: { rotate: 45 }
            },
            yAxis: {
                type: 'category',
                data: correlationData.parameters
            },
            visualMap: {
                min: -1,
                max: 1,
                calculable: true,
                orient: 'vertical',
                right: '30px',
                top: 'center',
                inRange: {
                    color: ['#e74c3c', '#f8f9fc', '#2ecc71']
                }
            },
            series: [{
                type: 'heatmap',
                data: correlationData.matrix,
                label: {
                    show: true,
                    formatter: params => params.data[2].toFixed(2)
                }
            }]
        };

        chart.setOption(option);

        setTimeout(() => {
            chart.resize();
            console.log('相关性图表重绘完成');
        }, 100);
    }

    renderDistributionChart(distributionData) {
        const chart = this.charts['distribution-chart'];
        if (!chart) {
            console.error('分布图表实例不存在');
            return;
        }

        const option = {
            title: { text: '水质参数分布统计', left: 'center' },
            tooltip: { trigger: 'axis' },
            legend: { data: ['最小值', '平均值', '最大值'], top: 35 },
            grid: { left: '80px', right: '40px', bottom: '40px', top: '80px' },
            xAxis: {
                type: 'category',
                data: distributionData.categories,
                axisLabel: { rotate: 45 }
            },
            yAxis: { type: 'value' },
            series: [
                {
                    name: '最小值',
                    type: 'bar',
                    data: distributionData.min,
                    itemStyle: { color: '#3498db' }
                },
                {
                    name: '平均值',
                    type: 'bar',
                    data: distributionData.avg,
                    itemStyle: { color: '#2ecc71' }
                },
                {
                    name: '最大值',
                    type: 'bar',
                    data: distributionData.max,
                    itemStyle: { color: '#e74c3c' }
                }
            ]
        };

        chart.setOption(option);

        setTimeout(() => {
            chart.resize();
            console.log('分布图表重绘完成');
        }, 100);
    }

    renderCalendarChart(calendarData) {
        const chart = this.charts['calendar-chart'];
        if (!chart) {
            console.error('日历图表实例不存在');
            return;
        }

        const option = {
            title: {
                text: '月度平均温度分布',
                left: 'center',
                top: '10px'
            },
            visualMap: {
                type: 'continuous',
                min: 15,
                max: 30,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '20px',
                inRange: {
                    color: ['#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027']
                }
            },
            calendar: {
                top: '50px',
                left: '30px',
                right: '30px',
                bottom: '100px',
                cellSize: 15,
                range: ['2023-08', '2024-06']
            },
            tooltip: {
                formatter: params => {
                    const date = new Date(params.data[0]);
                    const monthName = date.toLocaleString('zh-CN', { year: 'numeric', month: 'long' });
                    return `${monthName}<br/>平均温度: ${params.data[1]}°C`;
                }
            },
            series: {
                type: 'heatmap',
                coordinateSystem: 'calendar',
                data: calendarData.data || []
            }
        };

        chart.setOption(option);

        setTimeout(() => {
            chart.resize();
            console.log('日历图表重绘完成');
        }, 100);
    }

    updateMetrics(metrics) {
        const elements = {
            'avg-temperature': `${metrics.avg_temperature}°C`,
            'avg-oxygen': `${metrics.avg_oxygen} mg/L`,
            'avg-ph': metrics.avg_ph,
            'total-records': metrics.total_records
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    setupEventListeners() {
        // 趋势粒度选择
        const granularitySelect = document.getElementById('trend-granularity');
        if (granularitySelect) {
            granularitySelect.addEventListener('change', (e) => this.loadTrendData(e.target.value));
        }

        // 标签页切换
        this.setupTabNavigation();

        // 窗口调整大小
        window.addEventListener('resize', () => this.resizeActiveChart());
    }

    setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                const targetTab = btn.getAttribute('data-tab');
                console.log(`点击标签: ${targetTab}`);

                // 更新按钮状态
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 更新内容显示
                tabPanes.forEach(pane => {
                    pane.style.display = 'none';
                    pane.classList.remove('active');
                });

                const targetPane = document.getElementById(targetTab);
                if (targetPane) {
                    targetPane.style.display = 'block';
                    targetPane.classList.add('active');

                    // 确保图表容器有尺寸后再初始化
                    await this.ensureChartReady(targetTab);

                    this.loadTabData(targetTab);

                    // 延迟重绘确保尺寸正确
                    setTimeout(() => {
                        this.resizeChartInTab(targetTab);
                    }, 300);
                }
            });
        });
    }

    async ensureChartReady(tabId) {
        const chartId = this.getChartIdByTab(tabId);
        if (!this.charts[chartId]) {
            console.log(`初始化图表: ${chartId}`);
            await this.initChart(chartId);
        }
    }

    getChartIdByTab(tabId) {
        const tabChartMap = {
            'trend-tab': 'trend-chart',
            'correlation-tab': 'correlation-chart',
            'distribution-tab': 'distribution-chart',
            'calendar-tab': 'calendar-chart'
        };
        return tabChartMap[tabId];
    }

    loadTabData(tabId) {
        const loaders = {
            'correlation-tab': () => this.loadCorrelationData(),
            'distribution-tab': () => this.loadDistributionData(),
            'calendar-tab': () => this.loadCalendarData()
        };
        if (loaders[tabId]) loaders[tabId]();
    }

    resizeChartInTab(tabId) {
        const tabPane = document.getElementById(tabId);
        if (tabPane) {
            const chartContainer = tabPane.querySelector('.chart-container');
            if (chartContainer) {
                const chart = this.charts[chartContainer.id];
                if (chart && chart.resize) {
                    chart.resize();
                    console.log(`重绘图表: ${chartContainer.id}`);
                }
            }
        }
    }

    resizeActiveChart() {
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            const chartContainer = activeTab.querySelector('.chart-container');
            if (chartContainer) {
                const chart = this.charts[chartContainer.id];
                if (chart && chart.resize) {
                    chart.resize();
                }
            }
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.analysisCenter = new AnalysisCenter();
});