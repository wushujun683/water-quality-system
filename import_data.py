import pandas as pd
import math
from app import app, db
from models import WaterQualityData
from datetime import datetime
import os

def setup_database():
    """设置数据库，确保表存在"""
    with app.app_context():
        db.create_all()
        print("数据库表已就绪")

def clean_value(value):
    """清理 nan 值"""
    if isinstance(value, float) and math.isnan(value):
        return None
    return value

def import_water_quality_data():
    """导入水质数据到数据库"""
    print("开始导入水质数据...")
    setup_database()

    with app.app_context():
        # 读取Excel文件
        file_path = '水质监测.xlsx'
        if not os.path.exists(file_path):
            print("错误: 找不到数据文件")
            return


        try:
            df = pd.read_excel(file_path, sheet_name='brisbane_water_quality')
            print(f"成功读取数据，共 {len(df)} 行")
        except Exception as e:
            print(f"读取文件失败: {e}")
            return

        # 清空现有数据
        WaterQualityData.query.delete()
        db.session.commit()
        print("现有数据已清空")

        records_imported = 0
        errors = 0

        print("开始导入数据...")
        for index, row in df.iterrows():
            try:
                # 跳过无效数据
                if pd.isna(row['Timestamp']) or pd.isna(row['Record number']):
                    continue

                # 处理时间戳
                timestamp = row['Timestamp']
                if isinstance(timestamp, str):
                    try:
                        timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S')
                    except ValueError:
                        continue

                # 创建水质数据记录
                water_data = WaterQualityData(
                    timestamp=timestamp,
                    record_number=int(clean_value(row['Record number'])),
                    average_water_speed=clean_value(row.get('Average Water Speed')),
                    average_water_direction=clean_value(row.get('Average Water Direction')),
                    chlorophyll=clean_value(row.get('Chlorophyll')),
                    chlorophyll_quality=clean_value(row.get('Chlorophyll [quality]')),
                    temperature=clean_value(row.get('Temperature')),
                    temperature_quality=clean_value(row.get('Temperature [quality]')),
                    dissolved_oxygen=clean_value(row.get('Dissolved Oxygen')),
                    dissolved_oxygen_quality=clean_value(row.get('Dissolved Oxygen [quality]')),
                    dissolved_oxygen_saturation=clean_value(row.get('Dissolved Oxygen (%Saturation)')),
                    dissolved_oxygen_saturation_quality=clean_value(row.get('Dissolved Oxygen (%Saturation) [quality]')),
                    ph=clean_value(row.get('pH')),
                    ph_quality=clean_value(row.get('pH [quality]')),
                    salinity=clean_value(row.get('Salinity')),
                    salinity_quality=clean_value(row.get('Salinity [quality]')),
                    specific_conductance=clean_value(row.get('Specific Conductance')),
                    specific_conductance_quality=clean_value(row.get('Specific Conductance [quality]')),
                    turbidity=clean_value(row.get('Turbidity')),
                    turbidity_quality=clean_value(row.get('Turbidity [quality]'))
                )

                # 计算数据质量评分
                water_data.data_quality_score = water_data.calculate_quality_score()

                db.session.add(water_data)
                records_imported += 1

                # 每200条提交一次
                if records_imported % 200 == 0:
                    db.session.commit()
                    print(f"已导入 {records_imported} 条记录...")

            except Exception as e:
                errors += 1
                continue

        # 最终提交
        db.session.commit()
        print(f"\n数据导入完成！")
        print(f"成功导入: {records_imported} 条记录")
        print(f"导入失败: {errors} 条记录")

        # 显示统计信息
        total_records = WaterQualityData.query.count()
        print(f"数据库中记录总数: {total_records}")

        if total_records > 0:
            first_record = WaterQualityData.query.first()
            last_record = WaterQualityData.query.order_by(WaterQualityData.id.desc()).first()
            print(f"数据时间范围: {first_record.timestamp} 到 {last_record.timestamp}")

def check_database_status():
    """检查数据库状态"""
    with app.app_context():
        try:
            total_records = WaterQualityData.query.count()
            print(f"数据库状态: {total_records} 条记录")

            if total_records > 0:
                first = WaterQualityData.query.first()
                last = WaterQualityData.query.order_by(WaterQualityData.id.desc()).first()
                print(f"时间范围: {first.timestamp} 到 {last.timestamp}")

        except Exception as e:
            print(f"数据库状态检查失败: {e}")

if __name__ == '__main__':
    print("水质数据导入工具")
    check_database_status()

    user_input = input("\n是否继续导入数据？(y/n): ").strip().lower()
    if user_input in ['y', 'yes']:
        import_water_quality_data()
    else:
        print("操作已取消")

    print("\n最终数据库状态:")
    check_database_status()