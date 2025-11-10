// 仪表盘功能 - 集成数据流版本（修正版）
class DataStream {
    constructor() {
        this.isPlaying = true;
        this.data = [];
        this.currentIndex = 0;
    }

    async init() {
        console.log('🚀 初始化数据流...');
        await this.loadData();
        this.renderData();
        this.setSlowSpeed(); // 关键：初始化时设置速度
        this.startAutoScroll();
        this.updateStats();
        console.log('✅ 数据流初始化完成');
    }

    setSlowSpeed() {
        const streamElement = document.getElementById('dataStream');
        if (streamElement) {
            streamElement.style.animation = 'scrollUp 150s linear infinite';
            console.log('🎯 数据流速度已设置为150秒');
        }
    }

    async loadData() {
        try {
            // 从API获取数据
            const response = await fetch('/api/dashboard/stream-data');
            const result = await response.json();

            if (result.success) {
                this.data = result.data;
                console.log(`📊 加载了 ${this.data.length} 条数据记录`);
            } else {
                console.warn('❌ 数据加载失败，使用模拟数据');
                this.generateSampleData();
            }
        } catch (error) {
            console.error('❌ 数据加载错误:', error);
            this.generateSampleData();
        }
    }

    generateSampleData() {
        // 基于你的真实数据时间范围生成示例数据
        const startDate = new Date('2023-08-04');
        const endDate = new Date('2024-06-27');
        const parameters = ['温度', '溶解氧', 'pH值', '浊度', '叶绿素'];

        this.data = [];
        for (let i = 0; i < 50; i++) {
            const randomDays = Math.random() * (endDate - startDate);
            const timestamp = new Date(startDate.getTime() + randomDays);
            const param = parameters[Math.floor(Math.random() * parameters.length)];

            this.data.push({
                timestamp: timestamp.toISOString(),
                parameter: param,
                value: this.generateValue(param),
                status: Math.random() > 0.1 ? 'normal' : 'warning'
            });
        }

        // 按时间排序
        this.data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateValue(parameter) {
        const ranges = {
            '温度': { min: 15, max: 30 },
            '溶解氧': { min: 4, max: 12 },
            'pH值': { min: 6.5, max: 8.5 },
            '浊度': { min: 0.5, max: 8 },
            '叶绿素': { min: 0.1, max: 5 }
        };

        const range = ranges[parameter] || { min: 0, max: 10 };
        return (Math.random() * (range.max - range.min) + range.min).toFixed(1);
    }

    renderData() {
        const streamElement = document.getElementById('dataStream');
        if (!streamElement) return;

        let html = '';
        this.data.forEach(item => {
            const time = new Date(item.timestamp).toLocaleString('zh-CN');
            const statusClass = item.status === 'warning' ? 'style="border-left: 3px solid #f39c12;"' : '';

            html += `
                <div class="data-item" ${statusClass}>
                    <div class="data-header">
                        <span class="data-time">${time}</span>
                        <span class="data-type">${item.parameter}</span>
                    </div>
                    <div class="data-content">
                        ${item.parameter}: ${item.value}${this.getUnit(item.parameter)} | 状态: ${this.getStatusText(item.status)}
                    </div>
                </div>
            `;
        });

        streamElement.innerHTML = html;
    }

    getUnit(parameter) {
        const units = {
            '温度': '°C',
            '溶解氧': 'mg/L',
            'pH值': '',
            '浊度': 'NTU',
            '叶绿素': 'μg/L'
        };
        return units[parameter] || '';
    }

    getStatusText(status) {
        return status === 'warning' ? '需关注' : '正常';
    }

    startAutoScroll() {
        const streamElement = document.getElementById('dataStream');
        if (streamElement) {
            // 移除直接样式设置，改用CSS类
            streamElement.style.animation = ''; // 清除直接样式
            streamElement.classList.remove('paused');
            console.log('🎯 数据流动画已启动');
        }
    }

    togglePlay() {
        const streamElement = document.getElementById('dataStream');
        const playButton = document.querySelector('.control-btn');

        if (!playButton || !streamElement) return;

        if (this.isPlaying) {
            // 暂停动画 - 添加暂停类
            streamElement.classList.add('paused');
            playButton.innerHTML = '<i class="fas fa-play"></i> 播放';
            playButton.style.background = '#27ae60';
            playButton.style.borderColor = '#27ae60';
            console.log('⏸️ 数据流已暂停');
        } else {
            // 播放动画 - 移除暂停类
            streamElement.classList.remove('paused');
            playButton.innerHTML = '<i class="fas fa-pause"></i> 暂停';
            playButton.style.background = '';
            playButton.style.borderColor = '#3498db';
            console.log('▶️ 数据流已播放');
        }

        this.isPlaying = !this.isPlaying;
    }
    async refreshData() {
        console.log('🔄 刷新数据...');
        await this.loadData();
        this.renderData();
        this.setSlowSpeed();
        this.updateStats();
    }

    updateStats() {
        const totalRecords = document.getElementById('totalRecords');
        const latestUpdate = document.getElementById('latestUpdate');
        const dataStatus = document.getElementById('dataStatus');

        if (totalRecords) totalRecords.textContent = this.data.length;
        if (latestUpdate) latestUpdate.textContent = '刚刚';
        if (dataStatus) dataStatus.textContent = '在线';
    }
}

class Dashboard {
    constructor() {
        this.dataStream = new DataStream();
        this.init();
    }

    init() {
        console.log('🚀 初始化清新仪表盘...');
        this.createFloatingElements();
        this.setupSmoothAnimations();
        this.dataStream.init(); // 初始化数据流
        console.log('✅ 清新仪表盘初始化完成');
    }

    createFloatingElements() {
        const container = document.createElement('div');
        container.className = 'floating-elements';

        // 创建3个简约的浮动元素
        for (let i = 0; i < 3; i++) {
            const element = document.createElement('div');
            element.className = 'floating-element';
            container.appendChild(element);
        }

        document.body.appendChild(container);
    }

    setupSmoothAnimations() {
        // 页面进入动画
        const elements = document.querySelectorAll('.welcome-banner, .quick-nav, .data-stream-section');
        elements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';

            setTimeout(() => {
                element.style.transition = 'all 0.6s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 150);
        });

        // 导航按钮的延迟动画
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach((button, index) => {
            button.style.opacity = '0';
            button.style.transform = 'translateX(-15px)';

            setTimeout(() => {
                button.style.transition = 'all 0.4s ease';
                button.style.opacity = '1';
                button.style.transform = 'translateX(0)';
            }, 600 + (index * 80));
        });
    }

    destroy() {
        console.log('🧹 清理仪表盘资源');
    }
}

// 全局函数供HTML按钮调用
function toggleDataStream() {
    if (window.dashboard && window.dashboard.dataStream) {
        window.dashboard.dataStream.togglePlay();
    } else {
        console.warn('数据流未初始化');
    }
}

function refreshDataStream() {
    if (window.dashboard && window.dashboard.dataStream) {
        window.dashboard.dataStream.refreshData();
    } else {
        console.warn('数据流未初始化');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new Dashboard();
});

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});

// 添加页面加载动画
window.addEventListener('load', function() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';

    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});