# 🌐 VPS 轻量云服务器部署指南 (SQLite 特别版)

> **针对你当前的项目特别定制**:
> - 后端: Next.js (Port 3000)
> - 前端: Vite + React (Static)
> - 数据库: SQLite (本地文件)

---

## 🛠️ 第一步: 购买服务器

推荐配置:
*   **地区**: **香港 (Hong Kong)** 或新加坡 (必须海外，否则连不上 Google)
*   **系统**: **Ubuntu 22.04 LTS**
*   **配置**: 2核 2G内存 (最低要求)

---

## 🚀 第二步: 服务器环境安装

使用 SSH 登录服务器后，按顺序执行以下命令：

### 1. 安装基础软件
```bash
# 更新软件源
sudo apt update && sudo apt upgrade -y

# 安装 Nginx (网站服务器), Git, 和构建工具
sudo apt install -y nginx git curl unzip build-essential

# 安装 Node.js 20 (使用 fnm)
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20
fnm use 20
npm install -g pm2
```

### 2. 创建目录结构
我们需要把代码、数据库和日志分开存放，以防数据丢失。

```bash
# 创建应用目录
sudo mkdir -p /var/www/ai-grading/dist
sudo mkdir -p /var/www/ai-grading/code
sudo mkdir -p /var/www/ai-grading/database

# 赋予当前用户权限 (假设你是 root, 如果不是请替换 user)
sudo chown -R $USER:$USER /var/www/ai-grading
```

---

## 📦 第三步: 部署代码

你可以直接在服务器上拉取代码，或者从本地上传。这里推荐 **在服务器上拉取代码**。

### 1. 拉取代码
```bash
cd /var/www/ai-grading/code
git clone https://github.com/your-username/ai-grading.git .
# 记得替换上面的 URL 为你的实际仓库地址
npm install
```

### 2. 准备数据库 (关键!)
由于你使用的是 SQLite，我们需要把数据库文件放在一个**不会被代码覆盖**的地方。

```bash
# 1. 复制你的本地 dev.db 到服务器 (如果你已有数据)
# 或者在服务器上初始化一个新的:
cd /var/www/ai-grading/code/aigradingbackend
npx prisma generate
# 设置 DATABASE_URL 指向由于持久化目录
export DATABASE_URL="file:/var/www/ai-grading/database/prod.db"
npx prisma db push
```

### 3.后端配置与启动
```bash
cd /var/www/ai-grading/code/aigradingbackend

# 创建 .env 文件
nano .env
```

**在 .env 中填入:**
```env
# 核心配置
NODE_ENV=production
# 关键: 指向我们刚才创建的持久化数据库路径
DATABASE_URL="file:/var/www/ai-grading/database/prod.db"
# 你的 Google Gemini Key
GEMINI_API_KEY=AIZaSy...
# 随机生成的密钥
JWT_SECRET=生成的长字符串
# 你的服务器公网IP 或 域名
ALLOWED_ORIGINS=http://你的公网IP
```

**启动后端:**
```bash
npm install
npx prisma generate
npm run build
pm2 start npm --name "backend" -- start
pm2 save
```

### 4. 前端构建
```bash
cd /var/www/ai-grading/code/aigradingfrontend

# 配置前端环境变量
nano .env.local
```

**填入:**
```env
# 指向你的 VPS IP (注意 /api 后缀)
VITE_API_BASE_URL=http://你的公网IP/api
```

**构建并部署:**
```bash
npm install
npm run build
# 把构建好的静态文件复制到 Nginx 托管目录
cp -r dist/* /var/www/ai-grading/dist/
```

---

## 🌐 第四步: 配置 Nginx (反向代理)

这是连接前端和后端的桥梁。

```bash
sudo nano /etc/nginx/sites-available/ai-grading
```

**粘贴以下内容:**
```nginx
server {
    listen 80;
    server_name _;  # 如果有域名，填域名；否则填 _

    # 1. 前端静态页面
    location / {
        root /var/www/ai-grading/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 2. 后端 API 转发
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**启用并重启:**
```bash
sudo ln -s /etc/nginx/sites-available/ai-grading /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ 验证与维护

**访问测试:**
打开浏览器，输入 `http://你的公网IP`。

**常用维护命令:**

*   **更新后端代码**:
    ```bash
    cd /var/www/ai-grading/code/aigradingbackend
    git pull
    npm install
    npx prisma generate
    npm run build
    pm2 restart backend
    ```

*   **更新前端代码**:
    ```bash
    cd /var/www/ai-grading/code/aigradingfrontend
    git pull
    npm install
    npm run build
    cp -r dist/* /var/www/ai-grading/dist/
    ```

*   **查看日志**:
    `pm2 logs backend`

---

## ⚠️ 关于数据备份 (非常重要)

你的数据现在存储在 `/var/www/ai-grading/database/prod.db`。
**请务必定期下载备份这个文件到本地!**
