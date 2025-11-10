// 实时时间更新
function updateCurrentTime() {
    const now = new Date();
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = now.toLocaleDateString('zh-CN', options);
    }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('水质监测系统初始化...');

    // 更新时间
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // 添加浮动气泡动画
    createFloatingBubbles();

    // 表单交互动画
    initFormInteractions();

    // 卡片悬停效果
    initCardHoverEffects();
});

// 创建浮动气泡
function createFloatingBubbles() {
    const container = document.querySelector('.auth-background');
    if (!container) return;

    // 清除现有气泡
    const existingBubbles = container.querySelectorAll('.floating-bubble');
    existingBubbles.forEach(bubble => bubble.remove());

    for (let i = 0; i < 8; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'floating-bubble';
        const size = Math.random() * 80 + 30;
        bubble.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, ${Math.random() * 0.08 + 0.02});
            animation: float ${Math.random() * 8 + 6}s ease-in-out infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(bubble);
    }
}

// 初始化表单交互
function initFormInteractions() {
    const inputs = document.querySelectorAll('.form-control');
    inputs.forEach(input => {
        // 聚焦效果
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.borderColor = '#4e73df';
        });

        // 失去焦点效果
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
            if (!this.value) {
                this.parentElement.style.borderColor = '#e2e8f0';
            }
        });

        // 输入验证
        input.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                this.style.backgroundColor = '#f7fafc';
            } else {
                this.style.backgroundColor = '#fff';
            }
        });
    });
}

// 卡片悬停效果
function initCardHoverEffects() {
    const cards = document.querySelectorAll('.feature-card, .metric-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
            this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.15)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
        });
    });
}

// 通知提醒功能
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // 3秒后自动消失
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// 加载状态指示器
function showLoading(show = true) {
    let loader = document.getElementById('global-loader');

    if (show && !loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
        `;
        loader.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
        `;
        document.body.appendChild(loader);
    } else if (!show && loader) {
        loader.remove();
    }
}

// 表单提交处理
function handleFormSubmit(formId, callback) {
    const form = document.getElementById(formId);
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            showLoading(true);

            // 模拟异步提交
            setTimeout(() => {
                showLoading(false);
                if (callback) callback();
            }, 1500);
        });
    }
}

// 响应式导航菜单
function initResponsiveNav() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (!sidebar || !mainContent) return;

    // 移动端菜单切换
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    toggleBtn.className = 'sidebar-toggle d-md-none';
    toggleBtn.style.cssText = `
        position: fixed;
        top: 15px;
        left: 15px;
        z-index: 1000;
        background: #4e73df;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px;
        font-size: 1.2rem;
    `;

    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('mobile-open');
        mainContent.classList.toggle('mobile-open');
    });
}

// 数据统计更新
function updateStatistics() {
    // 模拟实时数据更新
    setInterval(() => {
        const metrics = document.querySelectorAll('.metric-value');
        metrics.forEach(metric => {
            const currentValue = parseFloat(metric.textContent);
            if (!isNaN(currentValue)) {
                const change = (Math.random() - 0.5) * 0.5;
                const newValue = currentValue + change;
                metric.textContent = newValue.toFixed(1);

                // 更新趋势指示器
                const trend = metric.nextElementSibling;
                if (trend && trend.classList.contains('metric-trend')) {
                    trend.textContent = change >= 0 ? `+${change.toFixed(1)}` : `${change.toFixed(1)}`;
                    trend.className = `metric-trend ${change > 0 ? 'up' : change < 0 ? 'down' : 'stable'}`;
                }
            }
        });
    }, 5000);
}

// 键盘快捷键
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl + D 跳转到仪表盘
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            window.location.href = '/dashboard';
        }

        // Ctrl + L 退出登录
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            window.location.href = '/logout';
        }

        // ESC 关闭所有弹窗
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                const bootstrapModal = bootstrap.Modal.getInstance(modal);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                }
            });
        }
    });
}

// 初始化所有功能
function initAll() {
    updateCurrentTime();
    createFloatingBubbles();
    initFormInteractions();
    initCardHoverEffects();
    initResponsiveNav();
    updateStatistics();
    initKeyboardShortcuts();
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateCurrentTime,
        showNotification,
        showLoading,
        initAll
    };
}