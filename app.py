from flask import Flask, render_template, redirect, url_for, flash, request, jsonify,send_file
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from forms import LoginForm, RegisterForm
from models import db, WaterQualityData, User, init_db
import os
from sqlalchemy import func, desc
import json
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import io
import math
import random
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import warnings
warnings.filterwarnings('ignore')
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] ='sqlite:///water_quality.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember_me.data)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('dashboard'))
        else:
            flash('用户名或密码错误，请重试', 'danger')
    return render_template('login.html', title='登录', form=form)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    form = RegisterForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('注册成功！请登录', 'success')
        return redirect(url_for('login'))
    return render_template('register.html', title='注册', form=form)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/')
@app.route('/dashboard')
@login_required
def dashboard():
    """主控制台页面"""
    return render_template('dashboard.html', title='控制台')
@app.route('/api/dashboard/stream-data')
@login_required
def api_dashboard_stream_data():
    """获取数据流数据 - 显示所有参数"""
    try:
        # 获取最新的50条记录
        latest_data = WaterQualityData.query.order_by(
            WaterQualityData.timestamp.desc()
        ).limit(50).all()

        stream_data = []
        for record in latest_data:
            # 检查并添加所有有数据的参数
            parameters_to_check = [
                ('temperature', '温度', 15, 28),
                ('dissolved_oxygen', '溶解氧', 5, 10),
                ('ph', 'pH值', 6.5, 8.5),
                ('turbidity', '浊度', 0, 5),
                ('chlorophyll', '叶绿素', 0, 3),
                ('salinity', '盐度', 0, 35)
            ]

            for param_field, param_name, min_val, max_val in parameters_to_check:
                value = getattr(record, param_field)
                if value is not None:
                    # 判断状态
                    status = 'normal'
                    if value < min_val or value > max_val:
                        status = 'warning'

                    stream_data.append({
                        'timestamp': record.timestamp.isoformat(),
                        'parameter': param_name,
                        'value': float(value),
                        'status': status,
                        'unit': get_parameter_unit(param_field)
                    })

        return jsonify({
            'success': True,
            'data': stream_data,
            'total': len(stream_data)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


def prepare_chart_data(recent_data):
    """准备图表数据，安全处理空值和异常"""
    if not recent_data:
        return {
            'timestamps': [],
            'temperatures': [],
            'dissolved_oxygen': [],
            'ph_values': [],
            'turbidity': []
        }

    # 只取最近10个数据点
    recent_subset = recent_data[-10:] if len(recent_data) >= 10 else recent_data

    chart_data = {
        'timestamps': [],
        'temperatures': [],
        'dissolved_oxygen': [],
        'ph_values': [],
        'turbidity': []
    }

    for data in recent_subset:
        # 安全处理时间戳
        if data.timestamp:
            chart_data['timestamps'].append(data.timestamp.strftime('%H:%M'))
        else:
            chart_data['timestamps'].append('--:--')

        # 安全处理温度
        if data.temperature is not None:
            chart_data['temperatures'].append(float(data.temperature))

        # 安全处理溶解氧
        if data.dissolved_oxygen is not None:
            chart_data['dissolved_oxygen'].append(float(data.dissolved_oxygen))

        # 安全处理pH值
        if data.ph is not None:
            chart_data['ph_values'].append(float(data.ph))

        # 安全处理浊度
        if data.turbidity is not None:
            chart_data['turbidity'].append(float(data.turbidity))

    return chart_data


@app.route('/api/latest-data')
@login_required
def api_latest_data():
    """API接口：获取最新数据"""
    latest_data = WaterQualityData.query.order_by(WaterQualityData.timestamp.desc()).first()

    if latest_data:
        return jsonify({
            'success': True,
            'data': latest_data.to_dict()
        })
    else:
        return jsonify({
            'success': False,
            'message': '暂无数据'
        })


@app.route('/api/data-statistics')
@login_required
def api_data_statistics():
    """API接口：获取数据统计"""
    total_records = WaterQualityData.query.count()

    # 各参数的平均值
    avg_temperature = db.session.query(func.avg(WaterQualityData.temperature)).scalar()
    avg_ph = db.session.query(func.avg(WaterQualityData.ph)).scalar()
    avg_oxygen = db.session.query(func.avg(WaterQualityData.dissolved_oxygen)).scalar()

    return jsonify({
        'total_records': total_records,
        'avg_temperature': round(avg_temperature, 2) if avg_temperature else 0,
        'avg_ph': round(avg_ph, 2) if avg_ph else 0,
        'avg_oxygen': round(avg_oxygen, 2) if avg_oxygen else 0
    })


@app.cli.command('create-admin')
def create_admin_command():
    """Flask命令：创建管理员账户"""
    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        if admin:
            print('管理员账户已存在!')
            return

        admin = User(
            username='admin',
            email='admin@waterquality.com',
            role='admin'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print('管理员账户创建成功: admin / admin123')


@app.cli.command('list-users')
def list_users_command():
    """Flask命令：列出所有用户"""
    with app.app_context():
        users = User.query.all()
        for user in users:
            print(f'{user.username} ({user.email}) - {user.role}')







# 分析中心路由 - 简化版
@app.route('/analysis')
@login_required
def analysis_center():
    return render_template('analysis.html', title='水质分析中心')

def calculate_daily_averages(data):
    """计算每日平均值"""
    from collections import defaultdict
    daily_data = defaultdict(lambda: {'temp': [], 'oxygen': [], 'ph': []})

    for record in data:
        if record.timestamp:
            date_key = record.timestamp.strftime('%Y-%m-%d')
            if record.temperature: daily_data[date_key]['temp'].append(float(record.temperature))
            if record.dissolved_oxygen: daily_data[date_key]['oxygen'].append(float(record.dissolved_oxygen))
            if record.ph: daily_data[date_key]['ph'].append(float(record.ph))

    return daily_data

@app.route('/api/analysis/overview')
@login_required
def api_analysis_overview():
    """分析中心概览数据"""
    try:
        data = WaterQualityData.query.all()
        if not data:
            return jsonify({'success': False, 'error': '无数据'})

        daily_data = calculate_daily_averages(data)

        # 计算总平均
        daily_avg_temps = [sum(values['temp'])/len(values['temp']) for values in daily_data.values() if values['temp']]
        daily_avg_oxygen = [sum(values['oxygen'])/len(values['oxygen']) for values in daily_data.values() if values['oxygen']]
        daily_avg_ph = [sum(values['ph'])/len(values['ph']) for values in daily_data.values() if values['ph']]

        metrics = {
            'avg_temperature': round(sum(daily_avg_temps)/len(daily_avg_temps), 1) if daily_avg_temps else 0,
            'avg_oxygen': round(sum(daily_avg_oxygen)/len(daily_avg_oxygen), 1) if daily_avg_oxygen else 0,
            'avg_ph': round(sum(daily_avg_ph)/len(daily_avg_ph), 2) if daily_avg_ph else 0,
            'total_records': len(data)
        }

        return jsonify({'success': True, 'metrics': metrics})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/analysis/trend')
@login_required
def api_analysis_trend():
    """趋势数据"""
    try:
        granularity = request.args.get('granularity', 'monthly')
        data = WaterQualityData.query.order_by(WaterQualityData.timestamp).all()

        if not data:
            return jsonify({'success': False, 'error': '无数据'})

        # 分组数据
        grouped_data = {}
        for record in data:
            if record.timestamp:
                key = record.timestamp.strftime('%Y-%m-%d' if granularity == 'daily' else '%Y-%m')
                if key not in grouped_data:
                    grouped_data[key] = {'temp': [], 'oxygen': [], 'ph': [], 'turbidity': [], 'chlorophyll': []}

                if record.temperature: grouped_data[key]['temp'].append(float(record.temperature))
                if record.dissolved_oxygen: grouped_data[key]['oxygen'].append(float(record.dissolved_oxygen))
                if record.ph: grouped_data[key]['ph'].append(float(record.ph))
                if record.turbidity: grouped_data[key]['turbidity'].append(float(record.turbidity))
                if record.chlorophyll: grouped_data[key]['chlorophyll'].append(float(record.chlorophyll))

        sorted_dates = sorted(grouped_data.keys())
        if granularity == 'daily':  # 限制显示天数
            sorted_dates = sorted_dates[-30:]

        def safe_avg(values):
            return round(sum(values)/len(values), 2) if values else 0

        trend_data = {
            'dates': sorted_dates,
            'temperature': [safe_avg(grouped_data[date]['temp']) for date in sorted_dates],
            'dissolved_oxygen': [safe_avg(grouped_data[date]['oxygen']) for date in sorted_dates],
            'ph': [safe_avg(grouped_data[date]['ph']) for date in sorted_dates],
            'turbidity': [safe_avg(grouped_data[date]['turbidity']) for date in sorted_dates],
            'chlorophyll': [safe_avg(grouped_data[date]['chlorophyll']) for date in sorted_dates]
        }

        return jsonify({'success': True, 'trend_data': trend_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# 其他API函数类似简化...
# 确保这些路由都存在
@app.route('/api/analysis/correlation')
@login_required
def api_analysis_correlation():
    """相关性分析"""
    try:
        # 获取有效数据（包含浊度）
        data = WaterQualityData.query.filter(
            WaterQualityData.temperature.isnot(None),
            WaterQualityData.dissolved_oxygen.isnot(None),
            WaterQualityData.ph.isnot(None),
            WaterQualityData.turbidity.isnot(None)  # 新增浊度
        ).limit(500).all()

        if len(data) < 10:
            return jsonify({'success': False, 'error': '数据不足'})

        # 简化版相关性计算（包含浊度）
        parameters = ['temperature', 'dissolved_oxygen', 'ph', 'turbidity']  # 新增浊度
        param_names = ['温度', '溶解氧', 'pH值', '浊度']  # 新增浊度
        param_data = {param: [] for param in parameters}

        # 收集数据（包含浊度）
        for record in data:
            for param in parameters:
                value = getattr(record, param)
                if value is not None:
                    param_data[param].append(float(value))

        # 计算相关性矩阵（现在包含浊度）
        correlation_matrix = []
        for i, param1 in enumerate(parameters):
            for j, param2 in enumerate(parameters):
                if i == j:
                    correlation = 1.0
                else:
                    # 简单相关性计算
                    data1 = param_data[param1]
                    data2 = param_data[param2]
                    min_len = min(len(data1), len(data2))
                    if min_len < 5:
                        correlation = 0.0
                    else:
                        # 使用numpy计算相关性
                        corr_matrix = np.corrcoef(data1[:min_len], data2[:min_len])
                        correlation = float(corr_matrix[0, 1]) if not np.isnan(corr_matrix[0, 1]) else 0.0

                correlation_matrix.append([param_names[i], param_names[j], correlation])

        return jsonify({
            'success': True,
            'correlation_data': {
                'parameters': param_names,
                'matrix': correlation_matrix
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/analysis/distribution')
@login_required
def api_analysis_distribution():
    """分布统计"""
    try:
        data = WaterQualityData.query.all()
        if not data:
            return jsonify({'success': False, 'error': '无数据'})

        # 主要参数统计
        parameters = ['temperature', 'dissolved_oxygen', 'ph', 'turbidity']
        param_names = ['温度', '溶解氧', 'pH值', '浊度']

        min_values, avg_values, max_values = [], [], []

        for param in parameters:
            values = [float(getattr(record, param)) for record in data if getattr(record, param) is not None]
            if values:
                min_values.append(round(min(values), 2))
                avg_values.append(round(sum(values)/len(values), 2))
                max_values.append(round(max(values), 2))
            else:
                min_values.append(0)
                avg_values.append(0)
                max_values.append(0)

        return jsonify({
            'success': True,
            'distribution_data': {
                'categories': param_names,
                'min': min_values,
                'avg': avg_values,
                'max': max_values
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
@app.route('/api/analysis/calendar')
@login_required
def api_analysis_calendar():
    """日历视图数据"""
    try:
        data = WaterQualityData.query.filter(
            WaterQualityData.timestamp.isnot(None),
            WaterQualityData.temperature.isnot(None)
        ).order_by(WaterQualityData.timestamp).all()

        monthly_data = {}
        for record in data:
            if record.timestamp and record.temperature:
                month_key = record.timestamp.strftime('%Y-%m')
                if month_key not in monthly_data:
                    monthly_data[month_key] = []
                monthly_data[month_key].append(float(record.temperature))

        calendar_data = []
        for month, temps in monthly_data.items():
            if temps:
                avg_temp = round(sum(temps)/len(temps), 1)
                calendar_data.append([f"{month}-01", avg_temp])

        calendar_data.sort(key=lambda x: x[0])

        return jsonify({
            'success': True,
            'calendar_data': {
                'range': '2023-2024',
                'data': calendar_data
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
# 全局变量存储数据
water_data = None
data_loaded = False
# 在应用启动时加载数据
# 从数据库加载数据的函数
def load_data_from_database():
    try:
        with app.app_context():
            # 查询所有数据
            records = WaterQualityData.query.order_by(WaterQualityData.timestamp).all()

            if not records:
                print("数据库中没有数据")
                return None

            # 转换为DataFrame
            data_list = []
            for record in records:
                data_list.append({
                    'Timestamp': record.timestamp,
                    'Record number': record.record_number,
                    'Average Water Speed': record.average_water_speed,
                    'Average Water Direction': record.average_water_direction,
                    'Chlorophyll': record.chlorophyll,
                    'Chlorophyll [quality]': record.chlorophyll_quality,
                    'Temperature': record.temperature,
                    'Temperature [quality]': record.temperature_quality,
                    'Dissolved Oxygen': record.dissolved_oxygen,
                    'Dissolved Oxygen [quality]': record.dissolved_oxygen_quality,
                    'Dissolved Oxygen (%Saturation)': record.dissolved_oxygen_saturation,
                    'Dissolved Oxygen (%Saturation) [quality]': record.dissolved_oxygen_saturation_quality,
                    'pH': record.ph,
                    'pH [quality]': record.ph_quality,
                    'Salinity': record.salinity,
                    'Salinity [quality]': record.salinity_quality,
                    'Specific Conductance': record.specific_conductance,
                    'Specific Conductance [quality]': record.specific_conductance_quality,
                    'Turbidity': record.turbidity,
                    'Turbidity [quality]': record.turbidity_quality
                })

            df = pd.DataFrame(data_list)
            print(f"从数据库加载了 {len(df)} 条记录")
            return df

    except Exception as e:
        print(f"从数据库加载数据失败: {str(e)}")
        return None

# 数据预处理函数
def preprocess_data(df):
    df_clean = df.copy()

    # 确保时间列是datetime类型
    if 'Timestamp' in df_clean.columns:
        df_clean['Timestamp'] = pd.to_datetime(df_clean['Timestamp'])

    # 处理数值列
    numeric_columns = [
        'Average Water Speed', 'Average Water Direction', 'Chlorophyll',
        'Temperature', 'Dissolved Oxygen', 'Dissolved Oxygen (%Saturation)',
        'pH', 'Salinity', 'Specific Conductance', 'Turbidity'
    ]

    for col in numeric_columns:
        if col in df_clean.columns:
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')

    # 按时间排序
    if 'Timestamp' in df_clean.columns:
        df_clean = df_clean.sort_values('Timestamp').reset_index(drop=True)

    return df_clean

# 懒加载数据函数
def ensure_data_loaded():
    global water_data, data_loaded
    if not data_loaded:
        print("首次加载数据...")
        water_data = load_data_from_database()
        if water_data is not None:
            water_data = preprocess_data(water_data)
            data_loaded = True
            print("数据加载成功！")
        else:
            data_loaded = False
            print("数据加载失败！")





# 预测中心主页路由
@app.route('/prediction')
def prediction_center():
    return render_template('prediction_center.html')

# API: 检查数据状态
@app.route('/api/prediction/status')
def get_data_status():
    ensure_data_loaded()
    global water_data
    if water_data is None or water_data.empty:
        return jsonify({'status': 'error', 'message': '数据未加载'}), 400

    return jsonify({
        'status': 'success',
        'message': '数据加载成功',
        'data_shape': water_data.shape,
        'timestamp_range': {
            'start': water_data['Timestamp'].min().strftime('%Y-%m-%d %H:%M:%S'),
            'end': water_data['Timestamp'].max().strftime('%Y-%m-%d %H:%M:%S')
        }
    })

# API: 获取可用参数列表
@app.route('/api/prediction/parameters')
def get_prediction_parameters():
    ensure_data_loaded()
    global water_data

    if water_data is None or water_data.empty:
        return jsonify({'error': '数据未加载'}), 400

    parameter_mapping = {
        'Dissolved Oxygen': {'name': '溶解氧', 'unit': 'mg/L'},
        'Temperature': {'name': '温度', 'unit': '°C'},
        'pH': {'name': 'pH值', 'unit': ''},
        'Salinity': {'name': '盐度', 'unit': 'PSU'},
        'Chlorophyll': {'name': '叶绿素', 'unit': 'μg/L'},
        'Turbidity': {'name': '浊度', 'unit': 'NTU'},
        'Specific Conductance': {'name': '电导率', 'unit': 'mS/cm'},
        'Average Water Speed': {'name': '平均水流速度', 'unit': 'm/s'},
        'Average Water Direction': {'name': '平均水流方向', 'unit': '°'}
    }

    available_parameters = []
    for param_id, param_info in parameter_mapping.items():
        if param_id in water_data.columns and water_data[param_id].notna().sum() > 10:
            available_parameters.append({
                'id': param_id,
                'name': param_info['name'],
                'unit': param_info['unit'],
                'data_count': int(water_data[param_id].notna().sum())
            })

    return jsonify(available_parameters)

# API: 重新加载数据
@app.route('/api/prediction/reload', methods=['POST'])
def reload_data():
    ensure_data_loaded()
    global water_data
    try:
        water_data = load_data_from_database()
        if water_data is not None:
            water_data = preprocess_data(water_data)
            return jsonify({
                'success': True,
                'message': f'数据重新加载成功，共 {len(water_data)} 条记录'
            })
    except Exception as e:
        return jsonify({'error': f'重新加载数据失败: {str(e)}'}), 500

# 通用预测函数
def prepare_prediction_data(target_param, df):
    """准备预测数据"""
    if target_param not in df.columns or 'Timestamp' not in df.columns:
        return None, None, None

    # 创建时间特征
    df_clean = df[['Timestamp', target_param]].copy()
    df_clean = df_clean.dropna()

    if len(df_clean) < 10:
        return None, None, None

    df_clean['hour'] = df_clean['Timestamp'].dt.hour
    df_clean['day_of_week'] = df_clean['Timestamp'].dt.dayofweek
    df_clean['time_index'] = range(len(df_clean))

    X = df_clean[['hour', 'day_of_week', 'time_index']].values
    y = df_clean[target_param].values

    return X, y, df_clean

def train_and_predict(X, y, model_type, forecast_hours, df_clean):
    """训练模型并进行预测"""
    if len(X) < 10:
        return None, None, None

    # 分割数据
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 选择模型
    model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10) if model_type == 'random_forest' else LinearRegression()

    # 训练模型
    model.fit(X_train, y_train)

    # 评估模型
    y_pred = model.predict(X_test)
    performance = {
        'mse': float(mean_squared_error(y_test, y_pred)),
        'r2': float(r2_score(y_test, y_pred)),
        'mae': float(mean_absolute_error(y_test, y_pred))
    }

    # 生成预测
    last_time = df_clean['Timestamp'].max()
    future_times = [last_time + timedelta(hours=i) for i in range(1, forecast_hours + 1)]

    future_features = []
    for time in future_times:
        future_features.append([
            time.hour,
            time.weekday(),
            df_clean['time_index'].max() + (time - last_time).total_seconds() / 3600
        ])

    future_predictions = model.predict(future_features)

    return performance, future_times, future_predictions

# API: 单参数预测
@app.route('/api/prediction/single', methods=['POST'])
def single_parameter_prediction():
    ensure_data_loaded()
    try:
        global water_data
        if water_data is None or water_data.empty:
            return jsonify({'error': '数据未加载'}), 400

        data = request.json
        target_param = data.get('parameter')
        model_type = data.get('model', 'linear')
        forecast_hours = int(data.get('hours', 24))

        if target_param not in water_data.columns:
            return jsonify({'error': f'参数 {target_param} 不存在'}), 400

        # 准备数据
        X, y, df_clean = prepare_prediction_data(target_param, water_data.copy())
        if X is None:
            return jsonify({'error': '有效数据量不足'}), 400

        # 训练和预测
        performance, future_times, future_predictions = train_and_predict(X, y, model_type, forecast_hours, df_clean)
        if performance is None:
            return jsonify({'error': '预测失败'}), 400

        # 准备返回数据
        history_data = [
            {'time': row['Timestamp'].strftime('%Y-%m-%d %H:%M:%S'), 'value': row[target_param]}
            for _, row in df_clean.iterrows()
        ]

        prediction_data = [
            {'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'value': float(pred)}
            for time, pred in zip(future_times, future_predictions)
        ]

        return jsonify({
            'success': True,
            'model_performance': performance,
            'history': history_data[-100:],
            'predictions': prediction_data,
            'model_type': model_type,
            'parameter': target_param
        })

    except Exception as e:
        return jsonify({'error': f'预测错误: {str(e)}'}), 500

# API: 多变量联合预测
@app.route('/api/prediction/multi', methods=['POST'])
def multi_parameter_prediction():
    ensure_data_loaded()
    try:
        global water_data
        if water_data is None or water_data.empty:
            return jsonify({'error': '数据未加载'}), 400

        data = request.json
        target_params = data.get('parameters', [])
        forecast_hours = int(data.get('hours', 24))

        results = {}
        for target_param in target_params:
            if target_param not in water_data.columns:
                continue

            X, y, df_clean = prepare_prediction_data(target_param, water_data.copy())
            if X is None:
                continue

            performance, future_times, future_predictions = train_and_predict(X, y, 'random_forest', forecast_hours, df_clean)
            if performance is None:
                continue

            results[target_param] = {
                'r2_score': performance['r2'],
                'predictions': [
                    {'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'value': float(pred)}
                    for time, pred in zip(future_times, future_predictions)
                ]
            }

        return jsonify({'success': True, 'results': results})

    except Exception as e:
        return jsonify({'error': f'多变量预测错误: {str(e)}'}), 500

# API: 导出预测结果
@app.route('/api/prediction/export', methods=['POST'])
def export_prediction_results():
    try:
        data = request.json
        predictions = data.get('predictions', {})
        output = io.StringIO()

        if 'single' in predictions:
            single_pred = predictions['single']
            output.write('Time,Predicted_Value\n')
            for pred in single_pred.get('predictions', []):
                output.write(f"{pred['time']},{pred['value']}\n")
        elif 'multi' in predictions:
            multi_pred = predictions['multi']['results']
            if multi_pred:
                first_param = list(multi_pred.keys())[0]
                times = [pred['time'] for pred in multi_pred[first_param]['predictions']]

                output.write('Time,' + ','.join(multi_pred.keys()) + '\n')
                for i, time in enumerate(times):
                    row = [time] + [str(multi_pred[param]['predictions'][i]['value']) for param in multi_pred.keys()]
                    output.write(','.join(row) + '\n')

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'water_quality_predictions_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    # 预警规则定义
# 预警规则定义
ALERT_RULES = {
    'temperature': {
        'critical': {'min': 5, 'max': 35},     # 极端异常
        'warning': {'min': 10, 'max': 30},     # 明显异常
        'attention': {'min': 15, 'max': 28}    # 轻微异常
    },
    'dissolved_oxygen': {
        'critical': {'min': 3, 'max': 15},     # 严重缺氧或过饱和
        'warning': {'min': 4, 'max': 12},      # 明显异常
        'attention': {'min': 5, 'max': 10}     # 轻微异常
    },
    'ph': {
        'critical': {'min': 6.0, 'max': 9.5},  # 严重偏离
        'warning': {'min': 6.5, 'max': 9.0},   # 明显偏离
        'attention': {'min': 7.0, 'max': 8.5}  # 轻微偏离
    },
    'turbidity': {
        'critical': {'max': 20},               # 严重异常：20NTU以上
        'warning': {'max': 10},                # 警告：10NTU以上
        'attention': {'max': 5}                # 关注：5NTU以上
    },
    'chlorophyll': {
        'critical': {'max': 10},               # 严重异常：10μg/L以上
        'warning': {'max': 5},                 # 警告：5μg/L以上
        'attention': {'max': 3}                # 关注：3μg/L以上
    }
}

def get_parameter_name(parameter):
    """获取参数中文名称"""
    names = {
        'temperature': '温度',
        'dissolved_oxygen': '溶解氧',
        'ph': 'pH值',
        'turbidity': '浊度',
        'chlorophyll': '叶绿素',
        'salinity': '盐度'
    }
    return names.get(parameter, parameter)

def get_parameter_unit(parameter):
    """获取参数单位"""
    units = {
        'temperature': '°C',
        'dissolved_oxygen': 'mg/L',
        'ph': '',
        'turbidity': 'NTU',
        'chlorophyll': 'μg/L',
        'salinity': 'PSU'
    }
    return units.get(parameter, '')

def check_single_parameter(parameter, value, timestamp):
    """检查单个参数的预警 - 修复版本"""
    alerts = []

    # 参数验证
    if value is None:
        return alerts

    try:
        value = float(value)
    except (ValueError, TypeError):
        return alerts

    rules = ALERT_RULES.get(parameter, {})

    # 按优先级检查：critical -> warning -> attention
    # 只返回最高级别的预警
    highest_alert = None
    level_priority = {'critical': 3, 'warning': 2, 'attention': 1}

    for level, threshold in rules.items():
        is_alert = False
        message = ""

        if 'min' in threshold and value < threshold['min']:
            is_alert = True
            message = f"{get_parameter_name(parameter)}过低"
        elif 'max' in threshold and value > threshold['max']:
            is_alert = True
            message = f"{get_parameter_name(parameter)}过高"

        if is_alert:
            alert = {
                'parameter': parameter,
                'current_value': round(value, 2),
                'level': level,
                'message': message,
                'timestamp': timestamp,
                'status': 'active',
                'unit': get_parameter_unit(parameter),
                'threshold': threshold
            }

            # 只保留最高级别的预警
            if (highest_alert is None or
                    level_priority[level] > level_priority[highest_alert['level']]):
                highest_alert = alert

    if highest_alert:
        alerts.append(highest_alert)

    return alerts

def get_highest_level_alert(alerts):
    """获取最高级别的预警"""
    level_priority = {'critical': 3, 'warning': 2, 'attention': 1}

    highest_alert = None
    for alert in alerts:
        if highest_alert is None or level_priority[alert['level']] > level_priority[highest_alert['level']]:
            highest_alert = alert

    return highest_alert

def get_daily_trend_data():
    """获取日粒度趋势数据 - 修复版本"""
    data = WaterQualityData.query.order_by(WaterQualityData.timestamp).all()

    daily_data = {}
    for record in data:
        if record.timestamp:
            date_key = record.timestamp.strftime('%Y-%m-%d')
            if date_key not in daily_data:
                daily_data[date_key] = {
                    'temp': [], 'oxygen': [], 'ph': [],
                    'turbidity': [], 'chlorophyll': []
                }

            # 安全地添加数据
            def safe_append(data_list, value):
                if value is not None:
                    try:
                        data_list.append(float(value))
                    except (ValueError, TypeError):
                        pass

            safe_append(daily_data[date_key]['temp'], record.temperature)
            safe_append(daily_data[date_key]['oxygen'], record.dissolved_oxygen)
            safe_append(daily_data[date_key]['ph'], record.ph)
            safe_append(daily_data[date_key]['turbidity'], record.turbidity)
            safe_append(daily_data[date_key]['chlorophyll'], record.chlorophyll)

    dates = sorted(daily_data.keys())

    # 安全计算平均值
    def safe_average(data_list):
        if not data_list:  # 空列表返回None
            return None
        return sum(data_list) / len(data_list)

    result = {
        'dates': dates,
        'temperature': [safe_average(daily_data[date]['temp']) for date in dates],
        'dissolved_oxygen': [safe_average(daily_data[date]['oxygen']) for date in dates],
        'ph': [safe_average(daily_data[date]['ph']) for date in dates],
        'turbidity': [safe_average(daily_data[date]['turbidity']) for date in dates],
        'chlorophyll': [safe_average(daily_data[date]['chlorophyll']) for date in dates]
    }

    return result

@app.route('/alerts')
@login_required
def alerts_center():
    """预警监控中心"""
    return render_template('alerts.html', title='预警监控中心')

@app.route('/api/alerts/rules')
@login_required
def api_alerts_rules():
    """获取预警规则"""
    return jsonify({'success': True, 'rules': ALERT_RULES})

@app.route('/api/alerts/historical')
@login_required
def api_alerts_historical():
    """获取历史预警数据 - 修复版本"""
    try:
        # 获取日粒度数据
        daily_trend = get_daily_trend_data()

        alerts = []
        processed_dates = set()

        for i, date in enumerate(daily_trend['dates']):
            if date in processed_dates:
                continue

            daily_alerts = []
            timestamp = f"{date} 12:00:00"

            # 检查每个参数，跳过None值
            parameters_to_check = [
                ('temperature', daily_trend['temperature'][i]),
                ('dissolved_oxygen', daily_trend['dissolved_oxygen'][i]),
                ('ph', daily_trend['ph'][i]),
                ('turbidity', daily_trend['turbidity'][i]),
                ('chlorophyll', daily_trend['chlorophyll'][i])
            ]

            for param_name, param_value in parameters_to_check:
                if param_value is not None:
                    param_alerts = check_single_parameter(param_name, param_value, timestamp)
                    daily_alerts.extend(param_alerts)

            if daily_alerts:
                # 只保留最高级别的预警
                highest_alert = get_highest_level_alert(daily_alerts)
                alerts.append(highest_alert)
                processed_dates.add(date)

        # 限制返回数量，按时间倒序
        alerts.sort(key=lambda x: x['timestamp'], reverse=True)
        alerts = alerts[:50]

        return jsonify({
            'success': True,
            'alerts': alerts,
            'total_count': len(alerts),
            'data_note': '基于日粒度数据的预警分析',
            'time_range': f"{daily_trend['dates'][0]} 至 {daily_trend['dates'][-1]}" if daily_trend['dates'] else '无数据'
        })

    except Exception as e:
        print(f"预警分析错误: {e}")
        return jsonify({'success': False, 'error': str(e)})
@app.route('/health')
@login_required
def health_calculator():
    """水质健康评分页面"""
    return render_template('health_calculator.html', title='水质健康评分')
@app.route('/help')
@login_required
def help_page():
    """系统帮助页面"""
    return render_template('help.html', title='系统帮助')


if __name__ == '__main__':
    with app.app_context():
        init_db(app)
    app.run(debug=False)