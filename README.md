# 拾圆 - AI 智能记账小程序

一款基于微信小程序 + 云开发的个人记账应用，集成 DeepSeek 大模型实现自然语言智能记账。

## 功能特性

### 核心功能

- **AI 智能记账** - 输入自然语言（如"今天午饭花了35"），AI 自动识别金额、分类和账户并完成记账
- **手动记账** - 自定义数字键盘，支持支出/收入切换、10 种分类、多账户选择、AA 分账
- **账单明细** - 按月份和分类筛选，按日期分组展示，支持修改金额并同步更新账户余额
- **账户管理** - 多账户管理（微信零钱/支付宝/银行卡等），自动区分资产与负债，展示净资产
- **人情债管理** - AA 应收账款追踪，选择收款账户核销，核销后自动生成收入账单
- **账单导出** - 一键生成 Excel 文件，支持下载和分享
- **个人中心** - 头像上传、昵称编辑、记账天数统计、待收债务汇总

### 页面一览

| 页面 | 说明 |
|------|------|
| 首页仪表盘 | 时段问候、本月收支概览、最近交易流水、快捷入口 |
| 账单明细 | 月份/分类筛选、按日期分组、修改金额 |
| AI 管家 | 聊天式交互，自然语言记账 + 财务问答 |
| 极速记账 | 自定义键盘、支出/收入、AA 分账 |
| 个人中心 | 用户信息、统计、账单导出、人情债入口 |
| 账户管理 | 多账户 CRUD、资产/负债、净资产计算 |
| 人情债管理 | 待收/已结清切换、核销操作 |
| 关于拾圆 | 应用介绍 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 微信小程序原生框架（WXML + WXSS + JS） |
| 后端 | 微信云开发（CloudBase） |
| 数据库 | 微信云数据库 |
| AI 能力 | DeepSeek API（deepseek-chat 模型） |
| 文件导出 | node-xlsx |
| 自定义 TabBar | 微信小程序自定义 tabBar 组件 |

## 项目结构

```
├── cloudfunctions/                 # 云函数
│   ├── login/                      # 登录/注册
│   ├── aiBookkeeping/              # AI 智能记账
│   └── exportBills/                # 账单导出 Excel
├── miniprogram/                    # 小程序前端
│   ├── app.json                    # 全局配置
│   ├── app.js                      # 全局逻辑（云初始化 + 静默登录）
│   ├── app.wxss                    # 全局样式
│   ├── custom-tab-bar/             # 自定义底部导航栏
│   ├── pages/
│   │   ├── index/                  # 首页
│   │   ├── history/                # 明细
│   │   ├── ai/                     # AI 管家
│   │   ├── book/                   # 记账
│   │   ├── profile/                # 我的
│   │   ├── accounts/               # 账户管理
│   │   ├── debt/                   # 人情债管理
│   │   └── about/                  # 关于
│   └── static/                     # 静态资源（tab 图标等）
└── project.config.json             # 项目配置
```

## 数据库设计

| 集合 | 用途 | 主要字段 |
|------|------|----------|
| `pc_user` | 用户信息 | `_openid`, `nickname`, `avatarUrl`, `createTime` |
| `pc_bill` | 账单记录 | `_openid`, `type`, `category`, `amount`, `account`, `remark`, `createTime` |
| `pc_account` | 账户信息 | `_openid`, `name`, `balance`, `icon`, `type` |
| `pc_debt` | 人情债 | `_openid`, `debtType`, `targetPerson`, `amount`, `status`, `settleTime` |

## 云函数说明

| 云函数 | 说明 | 依赖 |
|--------|------|------|
| `login` | 静默登录，新用户自动注册 | `wx-server-sdk` |
| `aiBookkeeping` | 调用 DeepSeek 解析自然语言，区分记账/聊天两种模式 | `wx-server-sdk`, `axios` |
| `exportBills` | 查询账单生成 Excel 并上传云存储 | `wx-server-sdk`, `node-xlsx` |

## 快速开始

### 环境要求

- 微信开发者工具
- 微信小程序基础库 >= 2.20.1
- 已开通微信云开发

### 部署步骤

1. 克隆项目到本地
2. 在微信开发者工具中导入项目
3. 开通云开发，创建云开发环境
4. 在云开发控制台创建数据库集合：`pc_user`、`pc_bill`、`pc_account`、`pc_debt`
5. 上传并部署云函数（`login`、`aiBookkeeping`、`exportBills`）
6. 在 `aiBookkeeping` 云函数中配置 DeepSeek API Key
7. 编译运行

### 云函数配置

在 `cloudfunctions/aiBookkeeping/index.js` 中配置 DeepSeek API：

```javascript
const DEEPSEEK_API_KEY = 'your-api-key-here';
```

## 设计规范

- 主色调：深蓝渐变 `#1E3A8A` -> `#3B82F6`
- AI 主题色：紫蓝渐变 `#667eea` -> `#764ba2`
- 功能色：收入绿 `#10B981`、支出红 `#EF4444`
- 卡片风格：白底、24rpx 圆角、轻微投影
- 自定义 TabBar：AI 管家居中突出展示

## 许可证

MIT License
