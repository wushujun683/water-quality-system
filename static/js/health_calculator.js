// health_calculator.js
class HealthScoreCalculator {
    constructor() {
        this.scoringRules = {
            turbidity: {
                optimal: [0, 2],
                acceptable: [2, 5],
                max: 20,
                weight: 0.25,
                unit: 'NTU'
            },
            ph: {
                optimal: [6.8, 8.2],
                acceptable: [6.5, 8.5],
                max: 14,
                weight: 0.20,
                unit: ''
            },
            dissolved_oxygen: {
                optimal: [6, 9],
                acceptable: [5, 10],
                max: 15,
                weight: 0.25,
                unit: 'mg/L'
            },
            temperature: {
                optimal: [18, 25],
                acceptable: [15, 28],
                max: 40,
                weight: 0.15,
                unit: '°C'
            },
            chlorophyll: {
                optimal: [0, 2],
                acceptable: [2, 3],
                max: 10,
                weight: 0.10,
                unit: 'μg/L'
            },
            salinity: {
                optimal: [33, 37],
                acceptable: [30, 40],
                max: 50,
                weight: 0.05,
                unit: 'PSU'
            }
        };
    }

    calculateParameterScore(parameter, value) {
        const rules = this.scoringRules[parameter];
        if (value === null || value === undefined || value === '') {
            return { score: 0, level: 'missing', message: '数据缺失' };
        }

        const numValue = parseFloat(value);

        // 检查是否超出最大合理范围
        if (numValue > rules.max || numValue < 0) {
            return { score: 0, level: 'invalid', message: '数值超出合理范围' };
        }

        // 最优范围：满分
        if (numValue >= rules.optimal[0] && numValue <= rules.optimal[1]) {
            return {
                score: 100,
                level: 'excellent',
                message: '处于最优范围'
            };
        }

        // 可接受范围：线性递减
        if (numValue >= rules.acceptable[0] && numValue <= rules.acceptable[1]) {
            const distanceToOptimal = Math.min(
                Math.abs(numValue - rules.optimal[0]),
                Math.abs(numValue - rules.optimal[1])
            );
            const score = Math.max(100 - (distanceToOptimal * 15), 70);
            return {
                score: Math.round(score),
                level: score >= 85 ? 'good' : 'fair',
                message: this.getParameterMessage(parameter, numValue, 'acceptable')
            };
        }

        // 超出可接受范围：严重扣分
        const distanceToAcceptable = Math.min(
            Math.abs(numValue - rules.acceptable[0]),
            Math.abs(numValue - rules.acceptable[1])
        );
        const score = Math.max(60 - (distanceToAcceptable * 8), 0);
        return {
            score: Math.round(score),
            level: score >= 40 ? 'poor' : 'bad',
            message: this.getParameterMessage(parameter, numValue, 'unacceptable')
        };
    }

    getParameterMessage(parameter, value, range) {
        const rules = this.scoringRules[parameter];
        const messages = {
            turbidity: {
                acceptable: `浊度${value}NTU在可接受范围内`,
                unacceptable: value > rules.acceptable[1] ?
                    `浊度${value}NTU偏高，可能影响水体透明度` :
                    `浊度${value}NTU偏低`
            },
            ph: {
                acceptable: `pH值${value}在安全范围内`,
                unacceptable: value > rules.acceptable[1] ?
                    `pH值${value}偏碱性` :
                    `pH值${value}偏酸性`
            },
            dissolved_oxygen: {
                acceptable: `溶解氧${value}mg/L含量适宜`,
                unacceptable: value > rules.acceptable[1] ?
                    `溶解氧${value}mg/L过饱和` :
                    `溶解氧${value}mg/L含量不足`
            },
            temperature: {
                acceptable: `温度${value}°C适宜`,
                unacceptable: value > rules.acceptable[1] ?
                    `温度${value}°C偏高` :
                    `温度${value}°C偏低`
            },
            chlorophyll: {
                acceptable: `叶绿素${value}μg/L含量正常`,
                unacceptable: value > rules.acceptable[1] ?
                    `叶绿素${value}μg/L偏高，可能存在藻类繁殖` :
                    `叶绿素${value}μg/L含量较低`
            },
            salinity: {
                acceptable: `盐度${value}PSU在正常范围`,
                unacceptable: value > rules.acceptable[1] ?
                    `盐度${value}PSU偏高` :
                    `盐度${value}PSU偏低`
            }
        };

        return messages[parameter]?.[range] || '参数评估完成';
    }

    calculateOverallScore(parameters) {
        let totalScore = 0;
        let totalWeight = 0;
        let parameterScores = {};

        for (const [param, value] of Object.entries(parameters)) {
            const rules = this.scoringRules[param];
            if (rules && value !== null && value !== '') {
                const result = this.calculateParameterScore(param, value);
                parameterScores[param] = result;
                totalScore += result.score * rules.weight;
                totalWeight += rules.weight;
            }
        }

        if (totalWeight === 0) return null;

        const overallScore = Math.round(totalScore / totalWeight);

        return {
            overallScore: overallScore,
            parameterScores: parameterScores,
            healthLevel: this.getHealthLevel(overallScore),
            effectiveWeight: totalWeight
        };
    }

    getHealthLevel(score) {
        if (score >= 90) return {
            level: '优秀',
            color: '#27ae60',
            description: '水质极佳，生态系统健康'
        };
        if (score >= 80) return {
            level: '良好',
            color: '#2ecc71',
            description: '水质良好，适合各种用途'
        };
        if (score >= 70) return {
            level: '一般',
            color: '#f39c12',
            description: '水质一般，需要关注某些参数'
        };
        if (score >= 60) return {
            level: '较差',
            color: '#e67e22',
            description: '水质较差，建议采取措施改善'
        };
        return {
            level: '恶劣',
            color: '#e74c3c',
            description: '水质恶劣，急需治理改善'
        };
    }

    getParameterName(param) {
        const names = {
            turbidity: '浊度',
            ph: 'pH值',
            dissolved_oxygen: '溶解氧',
            temperature: '温度',
            chlorophyll: '叶绿素',
            salinity: '盐度'
        };
        return names[param] || param;
    }

    generateImprovementSuggestions(parameterScores) {
        const suggestions = [];
        const criticalParams = [];

        // 收集需要重点改善的参数
        for (const [param, scoreInfo] of Object.entries(parameterScores)) {
            if (scoreInfo.level === 'poor' || scoreInfo.level === 'bad') {
                criticalParams.push({
                    name: this.getParameterName(param),
                    score: scoreInfo.score,
                    message: scoreInfo.message,
                    value: this.getParameterValue(param) // 获取参数值用于具体建议
                });
            }
        }

        // 重点改善参数建议
        if (criticalParams.length > 0) {
            const criticalItems = criticalParams.map(param =>
                `${param.name}(${param.score}分): ${param.message}`
            );

            suggestions.push({
                title: '重点改善参数',
                items: criticalItems,
                priority: 'high'
            });
        }

        // 根据具体参数给出针对性建议
        for (const [param, scoreInfo] of Object.entries(parameterScores)) {
            if (scoreInfo.level === 'poor' || scoreInfo.level === 'bad') {
                const paramSuggestions = this.getParameterSuggestions(param, scoreInfo);
                if (paramSuggestions.length > 0) {
                    suggestions.push({
                        title: `${this.getParameterName(param)}改善建议`,
                        items: paramSuggestions,
                        priority: 'high'
                    });
                }
            } else if (scoreInfo.level === 'fair' && scoreInfo.score < 80) {
                const paramSuggestions = this.getParameterSuggestions(param, scoreInfo);
                if (paramSuggestions.length > 0) {
                    suggestions.push({
                        title: `${this.getParameterName(param)}优化建议`,
                        items: paramSuggestions,
                        priority: 'medium'
                    });
                }
            }
        }

        return suggestions;
    }

// 新增：获取参数具体建议的方法
    getParameterSuggestions(parameter, scoreInfo) {
        const suggestions = {
            turbidity: [
                '加强沉淀和过滤处理',
                '控制底泥扰动和再悬浮',
                '减少地表径流带来的泥沙',
                '增加水体自净能力'
            ],
            ph: [
                '定期监测pH值变化趋势',
                '检查可能的酸性或碱性污染源',
                '考虑使用pH缓冲剂',
                '加强水体曝气促进气体交换'
            ],
            dissolved_oxygen: [
                '增加水体曝气和循环',
                '控制有机污染物输入',
                '减少水体富营养化',
                '维护健康的水生生态系统'
            ],
            temperature: [
                '监测季节性温度变化',
                '控制热污染源排放',
                '维护水体遮荫植被',
                '增强水体热容量'
            ],
            chlorophyll: [
                '控制营养盐输入（氮、磷）',
                '增加水体流动性防止藻类聚集',
                '引入藻类竞争生物',
                '定期清理过度生长的藻类'
            ],
            salinity: [
                '监测盐度长期变化趋势',
                '控制盐水入侵或排放',
                '维持适当的水体交换',
                '关注周边土地利用变化'
            ]
        };

        // 根据参数值和评分调整建议
        const specificSuggestions = suggestions[parameter] || ['加强监测和管理'];

        // 对于pH值，根据具体值给出更精确的建议
        if (parameter === 'ph') {
            const phValue = parseFloat(document.getElementById('ph-input').value);
            if (!isNaN(phValue)) {
                if (phValue > 8.5) {
                    return ['添加酸性调节剂', '加强二氧化碳曝气', '检查碱性废水排放'];
                } else if (phValue < 6.5) {
                    return ['添加碱性调节剂', '使用石灰石调节', '检查酸性矿山排水'];
                }
            }
        }

        return specificSuggestions;
    }

// 新增：获取参数当前值的方法
    getParameterValue(parameter) {
        const inputIdMap = {
            turbidity: 'turbidity-input',
            ph: 'ph-input',
            dissolved_oxygen: 'dissolved_oxygen-input',
            temperature: 'temperature-input',
            chlorophyll: 'chlorophyll-input',
            salinity: 'salinity-input'
        };

        const inputId = inputIdMap[parameter];
        const inputElement = document.getElementById(inputId);
        return inputElement ? inputElement.value : null;
    }
}

// 全局函数
function calculateHealthScore() {
    const calculator = new HealthScoreCalculator();

    // 根据HTML中实际的ID获取参数值
    const parameters = {
        turbidity: getInputValue('turbidity-input'),
        ph: getInputValue('ph-input'),
        dissolved_oxygen: getInputValue('dissolved_oxygen-input'),  // 使用实际的ID
        temperature: getInputValue('temperature-input'),
        chlorophyll: getInputValue('chlorophyll-input'),
        salinity: getInputValue('salinity-input')
    };

    console.log('输入的参数:', parameters); // 调试信息

    const result = calculator.calculateOverallScore(parameters);

    if (!result) {
        alert('请至少输入一个参数值');
        return;
    }

    displayResults(result, calculator);
}

// 添加安全的输入值获取函数
function getInputValue(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`找不到ID为 ${id} 的输入框`);
        return null;
    }
    return element.value;
}
function displayResults(result, calculator) {
    const resultPanel = document.getElementById('result-panel');
    const scoreValue = document.getElementById('score-value');
    const scoreCircle = document.getElementById('score-circle');
    const healthLevel = document.getElementById('health-level');
    const healthDescription = document.getElementById('health-description');
    const parameterScores = document.getElementById('parameter-scores');
    const analysisContent = document.getElementById('analysis-content');
    const improvementSuggestions = document.getElementById('improvement-suggestions');

    // 检查必要的元素是否存在
    if (!resultPanel || !scoreValue || !scoreCircle) {
        console.error('找不到必要的显示元素');
        return;
    }

    // 更新评分显示
    scoreValue.textContent = result.overallScore;
    scoreCircle.style.borderColor = result.healthLevel.color;
    scoreValue.style.color = result.healthLevel.color;

    // 更新健康等级
    healthLevel.textContent = result.healthLevel.level;
    healthLevel.style.color = result.healthLevel.color;
    healthDescription.textContent = result.healthLevel.description;
    healthDescription.style.color = result.healthLevel.color;

    // 显示各参数得分 - 使用正确的ID映射
    parameterScores.innerHTML = '';
    for (const [param, scoreInfo] of Object.entries(result.parameterScores)) {
        const paramName = calculator.getParameterName(param);
        const paramUnit = calculator.scoringRules[param].unit;

        // 正确的参数名到输入框ID映射
        const inputIdMap = {
            turbidity: 'turbidity-input',
            ph: 'ph-input',
            dissolved_oxygen: 'dissolved_oxygen-input',  // 使用实际的ID
            temperature: 'temperature-input',
            chlorophyll: 'chlorophyll-input',
            salinity: 'salinity-input'
        };

        const inputId = inputIdMap[param];
        const inputElement = document.getElementById(inputId);
        const displayValue = inputElement ? inputElement.value : 'N/A';

        parameterScores.innerHTML += `
            <div class="param-score-item">
                <div class="param-info">
                    <div class="param-name">${paramName}</div>
                    <div class="param-value">${displayValue} ${paramUnit}</div>
                </div>
                <div class="param-score score-${scoreInfo.level}">
                    ${scoreInfo.score}分
                </div>
            </div>
        `;
    }

    // 显示分析报告
    analysisContent.innerHTML = `
        <div class="analysis-summary">
            <p>基于 <strong>${Object.keys(result.parameterScores).length}</strong> 个有效参数计算，综合健康评分为 <strong style="color:${result.healthLevel.color}">${result.overallScore}分</strong>。</p>
            <p>${result.healthLevel.description}</p>
        </div>
        <div class="parameter-analysis">
            <h5>各参数详细评估：</h5>
            ${Object.entries(result.parameterScores).map(([param, scoreInfo]) => `
                <div class="param-analysis-item">
                    <strong>${calculator.getParameterName(param)}</strong>: ${scoreInfo.message}
                </div>
            `).join('')}
        </div>
    `;

    // 显示改善建议
    const suggestions = calculator.generateImprovementSuggestions(result.parameterScores);
    if (suggestions.length > 0) {
        improvementSuggestions.innerHTML = `
            <h4><i class="fas fa-lightbulb"></i> 改善建议</h4>
            ${suggestions.map(suggestion => `
                <div class="suggestion-section">
                    <h5>${suggestion.title}</h5>
                    ${suggestion.items.map(item => `
                        <div class="suggestion-item ${suggestion.priority === 'high' ? 'critical' : ''}">
                            <i class="fas fa-chevron-right"></i> ${item}
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        `;
    } else {
        improvementSuggestions.innerHTML = `
            <h4><i class="fas fa-check-circle"></i> 水质状况良好</h4>
            <p>所有参数都在可接受范围内，继续保持当前水质管理措施。</p>
        `;
    }

    // 显示结果面板
    resultPanel.style.display = 'block';
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCalculator() {
    // 清空所有输入
    document.querySelectorAll('.calculator-form input').forEach(input => {
        input.value = '';
    });

    // 隐藏结果面板
    document.getElementById('result-panel').style.display = 'none';
}

function fillSampleData() {
    // 使用正确的ID填充示例数据
    const sampleData = {
        'turbidity-input': '2.1',
        'ph-input': '8.12',
        'dissolved_oxygen-input': '7.6',  // 使用实际的ID
        'temperature-input': '20.5',
        'chlorophyll-input': '1.8',
        'salinity-input': '35.22'
    };

    for (const [id, value] of Object.entries(sampleData)) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        } else {
            console.warn(`找不到ID为 ${id} 的输入框`);
        }
    }

    // 自动计算
    setTimeout(() => calculateHealthScore(), 500);
}

// 添加输入实时验证
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.calculator-form input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value)) {
                this.style.borderColor = '#27ae60';
            } else if (this.value === '') {
                this.style.borderColor = '#e9ecef';
            } else {
                this.style.borderColor = '#e74c3c';
            }
        });
    });
});