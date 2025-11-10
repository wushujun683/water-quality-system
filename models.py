from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json


db = SQLAlchemy()

class User(UserMixin, db.Model):
    """用户模型"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default='user')  # user, admin

    # 用户设置
    preferences = db.Column(db.Text, default='{}')  # JSON格式存储用户偏好

    def set_password(self, password):
        """设置密码哈希"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """验证密码"""
        return check_password_hash(self.password_hash, password)

    def update_last_login(self):
        """更新最后登录时间"""
        self.last_login = datetime.utcnow()
        db.session.commit()

    def set_preference(self, key, value):
        """设置用户偏好"""
        prefs = json.loads(self.preferences)
        prefs[key] = value
        self.preferences = json.dumps(prefs)

    def get_preference(self, key, default=None):
        """获取用户偏好"""
        prefs = json.loads(self.preferences)
        return prefs.get(key, default)

    def __repr__(self):
        return f'<User {self.username}>'

class WaterQualityData(db.Model):
    """水质监测数据模型"""
    __tablename__ = 'water_quality_data'

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, index=True)
    record_number = db.Column(db.Integer, unique=True, nullable=False)

    # 水流参数
    average_water_speed = db.Column(db.Float, nullable=True)
    average_water_direction = db.Column(db.Float, nullable=True)

    # 叶绿素参数
    chlorophyll = db.Column(db.Float, nullable=True)
    chlorophyll_quality = db.Column(db.Integer, nullable=True)

    # 温度参数
    temperature = db.Column(db.Float, nullable=True)
    temperature_quality = db.Column(db.Integer, nullable=True)

    # 溶解氧参数
    dissolved_oxygen = db.Column(db.Float, nullable=True)
    dissolved_oxygen_quality = db.Column(db.Integer, nullable=True)
    dissolved_oxygen_saturation = db.Column(db.Float, nullable=True)
    dissolved_oxygen_saturation_quality = db.Column(db.Integer, nullable=True)

    # 化学参数
    ph = db.Column(db.Float, nullable=True)
    ph_quality = db.Column(db.Integer, nullable=True)
    salinity = db.Column(db.Float, nullable=True)
    salinity_quality = db.Column(db.Integer, nullable=True)

    # 电导率参数
    specific_conductance = db.Column(db.Float, nullable=True)
    specific_conductance_quality = db.Column(db.Integer, nullable=True)

    # 浊度参数
    turbidity = db.Column(db.Float, nullable=True)
    turbidity_quality = db.Column(db.Integer, nullable=True)

    # 数据质量标记
    data_quality_score = db.Column(db.Float, default=1.0)  # 0-1的数据质量评分
    is_anomaly = db.Column(db.Boolean, default=False)  # 是否为异常数据
    anomaly_type = db.Column(db.String(50), nullable=True)  # 异常类型

    # 元数据
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def calculate_quality_score(self):
        """计算数据质量评分"""
        quality_fields = [
            self.chlorophyll_quality,
            self.temperature_quality,
            self.dissolved_oxygen_quality,
            self.dissolved_oxygen_saturation_quality,
            self.ph_quality,
            self.salinity_quality,
            self.specific_conductance_quality,
            self.turbidity_quality
        ]

        valid_qualities = [q for q in quality_fields if q is not None]
        if not valid_qualities:
            return 1.0

        # 简单的质量评分逻辑（可根据实际需求调整）
        quality_score = sum(valid_qualities) / (len(valid_qualities) * 1000)  # 假设质量码在0-1000
        return min(max(quality_score, 0), 1)

    def to_dict(self):
        """转换为字典格式，用于API响应"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'record_number': self.record_number,
            'average_water_speed': self.average_water_speed,
            'average_water_direction': self.average_water_direction,
            'chlorophyll': self.chlorophyll,
            'temperature': self.temperature,
            'dissolved_oxygen': self.dissolved_oxygen,
            'dissolved_oxygen_saturation': self.dissolved_oxygen_saturation,
            'ph': self.ph,
            'salinity': self.salinity,
            'specific_conductance': self.specific_conductance,
            'turbidity': self.turbidity,
            'data_quality_score': self.data_quality_score,
            'is_anomaly': self.is_anomaly
        }

    def __repr__(self):
        return f'<WaterQualityData {self.record_number} at {self.timestamp}>'

class DataImportLog(db.Model):
    """数据导入日志"""
    __tablename__ = 'data_import_logs'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    import_type = db.Column(db.String(50), nullable=False)  # excel, csv, manual
    records_imported = db.Column(db.Integer, default=0)
    records_skipped = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, success, failed
    error_message = db.Column(db.Text, nullable=True)
    imported_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    # 关系
    importer = db.relationship('User', backref=db.backref('import_logs', lazy=True))

class AlertRule(db.Model):
    """预警规则"""
    __tablename__ = 'alert_rules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parameter = db.Column(db.String(50), nullable=False)  # temperature, dissolved_oxygen, etc.
    operator = db.Column(db.String(10), nullable=False)  # >, <, >=, <=, ==
    threshold = db.Column(db.Float, nullable=False)
    severity = db.Column(db.String(20), default='warning')  # info, warning, critical
    is_active = db.Column(db.Boolean, default=True)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 关系
    creator = db.relationship('User', backref=db.backref('alert_rules', lazy=True))

class AlertEvent(db.Model):
    """预警事件"""
    __tablename__ = 'alert_events'

    id = db.Column(db.Integer, primary_key=True)
    rule_id = db.Column(db.Integer, db.ForeignKey('alert_rules.id'))
    data_id = db.Column(db.Integer, db.ForeignKey('water_quality_data.id'))
    parameter_value = db.Column(db.Float, nullable=False)
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    # 关系
    rule = db.relationship('AlertRule', backref=db.backref('alert_events', lazy=True))
    data = db.relationship('WaterQualityData', backref=db.backref('alerts', lazy=True))
    acknowledger = db.relationship('User', foreign_keys=[acknowledged_by])

class AnalysisResult(db.Model):
    """分析结果"""
    __tablename__ = 'analysis_results'

    id = db.Column(db.Integer, primary_key=True)
    analysis_type = db.Column(db.String(50), nullable=False)  # trend, correlation, cluster, etc.
    parameters = db.Column(db.Text, nullable=False)  # JSON格式存储分析参数
    result_data = db.Column(db.Text, nullable=False)  # JSON格式存储分析结果
    visualization_config = db.Column(db.Text, nullable=True)  # 可视化配置
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 关系
    creator = db.relationship('User', backref=db.backref('analysis_results', lazy=True))

class PredictionModel(db.Model):
    """预测模型"""
    __tablename__ = 'prediction_models'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    model_type = db.Column(db.String(50), nullable=False)  # lstm, arima, prophet, etc.
    target_parameter = db.Column(db.String(50), nullable=False)
    input_parameters = db.Column(db.Text, nullable=False)  # JSON格式存储输入参数
    model_config = db.Column(db.Text, nullable=False)  # JSON格式存储模型配置
    performance_metrics = db.Column(db.Text, nullable=True)  # JSON格式存储性能指标
    is_active = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    creator = db.relationship('User', backref=db.backref('prediction_models', lazy=True))

class SystemSetting(db.Model):
    """系统设置"""
    __tablename__ = 'system_settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)
    value_type = db.Column(db.String(20), default='string')  # string, integer, float, boolean, json
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), default='general')
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    updater = db.relationship('User', backref=db.backref('system_settings', lazy=True))

    def get_value(self):
        """根据类型返回转换后的值"""
        if self.value_type == 'integer':
            return int(self.value)
        elif self.value_type == 'float':
            return float(self.value)
        elif self.value_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes')
        elif self.value_type == 'json':
            return json.loads(self.value)
        else:
            return self.value

def init_db(app):
    """初始化数据库"""
    db.init_app(app)
    with app.app_context():
        db.create_all()

        # 创建默认管理员用户（如果不存在）
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                email='admin@waterquality.com',
                role='admin'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("默认管理员账户已创建: admin / admin123")

        # 创建默认系统设置
        default_settings = [
            ('system_name', '水质监测分析系统', 'string', '系统名称'),
            ('data_retention_days', '365', 'integer', '数据保留天数'),
            ('auto_cleanup_enabled', 'true', 'boolean', '是否启用自动清理'),
            ('default_time_range', '7', 'integer', '默认时间范围（天）'),
            ('alert_check_interval', '300', 'integer', '预警检查间隔（秒）'),
            ('max_upload_size', '50', 'integer', '最大上传文件大小（MB）'),
        ]

        for key, value, value_type, description in default_settings:
            if not SystemSetting.query.filter_by(key=key).first():
                setting = SystemSetting(
                    key=key,
                    value=value,
                    value_type=value_type,
                    description=description
                )
                db.session.add(setting)

        db.session.commit()
        print("数据库初始化完成！")