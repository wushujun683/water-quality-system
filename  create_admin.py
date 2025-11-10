#!/usr/bin/env python3
"""
手动创建管理员账户脚本
"""

import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, User

def create_admin_user():
    """创建管理员账户"""
    with app.app_context():
        # 检查是否已存在管理员账户
        existing_admin = User.query.filter_by(username='admin').first()
        if existing_admin:
            print("❌ 管理员账户已存在！")
            print(f"   用户名: {existing_admin.username}")
            print(f"   邮箱: {existing_admin.email}")
            return False

        # 创建新的管理员账户
        admin = User(
            username='admin',
            email='admin@waterquality.com',
            role='admin'
        )
        admin.set_password('admin123')

        db.session.add(admin)
        db.session.commit()

        print("✅ 管理员账户创建成功！")
        print("=" * 40)
        print("   用户名: admin")
        print("   密码: admin123")
        print("   邮箱: admin@waterquality.com")
        print("   角色: admin")
        print("=" * 40)
        print("请使用以上凭据登录系统。")
        return True

def create_custom_admin(username, password, email):
    """创建自定义管理员账户"""
    with app.app_context():
        # 检查用户名是否已存在
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"❌ 用户名 '{username}' 已存在！")
            return False

        # 创建管理员账户
        admin = User(
            username=username,
            email=email,
            role='admin'
        )
        admin.set_password(password)

        db.session.add(admin)
        db.session.commit()

        print(f"✅ 管理员账户 '{username}' 创建成功！")
        print(f"   密码: {password}")
        print(f"   邮箱: {email}")
        return True

def list_all_users():
    """列出所有用户"""
    with app.app_context():
        users = User.query.all()
        print("\n📋 系统所有用户:")
        print("=" * 50)
        for user in users:
            print(f"   用户名: {user.username}")
            print(f"   邮箱: {user.email}")
            print(f"   角色: {user.role}")
            print(f"   创建时间: {user.created_at}")
            print("-" * 30)

def reset_admin_password():
    """重置管理员密码"""
    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            print("❌ 管理员账户不存在！")
            return False

        # 重置密码
        admin.set_password('admin123')
        db.session.commit()

        print("✅ 管理员密码已重置为: admin123")
        return True

if __name__ == '__main__':
    print("🚀 水质监测系统 - 用户管理工具")
    print("=" * 50)

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'create':
            create_admin_user()
        elif command == 'list':
            list_all_users()
        elif command == 'reset':
            reset_admin_password()
        elif command == 'custom' and len(sys.argv) == 5:
            create_custom_admin(sys.argv[2], sys.argv[3], sys.argv[4])
        else:
            print("用法:")
            print("  python create_admin.py create        # 创建默认管理员")
            print("  python create_admin.py list          # 列出所有用户")
            print("  python create_admin.py reset         # 重置管理员密码")
            print("  python create_admin.py custom <用户名> <密码> <邮箱>  # 创建自定义管理员")
    else:
        # 默认创建管理员
        create_admin_user()
        list_all_users()