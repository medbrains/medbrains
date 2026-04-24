#!/usr/bin/env bash

# MedBrains Deployment Script
# Usage: ./deploy.sh [frontend|backend|all]
# Requires: cargo-zigbuild, zig, pnpm

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Server Configuration ──
EC2_USER="ubuntu"
EC2_HOST="13.203.199.2"
KEY_PATH="$HOME/Projects/alagappa-main/cpanel-mail.pem"
REMOTE_BACKEND_PATH="/opt/medbrains"
REMOTE_FRONTEND_PATH="/var/www/medbrains"
SERVICE_NAME="medbrains"
BACKEND_PORT="3000"
BINARY_NAME="medbrains-server"
TARGET_ARCH="x86_64-unknown-linux-gnu"

COMPONENT="${1:-all}"

echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MedBrains Deployment${NC}"
echo -e "${BLUE}  Component: ${YELLOW}$COMPONENT${NC}"
echo -e "${BLUE}  Server:    ${YELLOW}$EC2_HOST${NC}"
echo -e "${BLUE}══════════════════════════════════════════════${NC}"
echo ""

# ── Deploy Backend ──
deploy_backend() {
    echo -e "${YELLOW}🦀 Building Rust backend...${NC}"

    # Check tools
    if ! command -v cargo-zigbuild &> /dev/null; then
        echo -e "${YELLOW}Installing cargo-zigbuild...${NC}"
        cargo install cargo-zigbuild
    fi
    if ! command -v zig &> /dev/null; then
        echo -e "${RED}❌ Zig not installed! Run: brew install zig${NC}"
        exit 1
    fi

    # Cross-compile for Linux x86_64
    cd "$SCRIPT_DIR"
    cargo zigbuild --release --target=$TARGET_ARCH --bin medbrains-server

    BINARY_PATH="target/$TARGET_ARCH/release/$BINARY_NAME"
    if [ ! -f "$BINARY_PATH" ]; then
        echo -e "${RED}❌ Binary not found at $BINARY_PATH${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Build successful!${NC}"
    ls -lh "$BINARY_PATH"
    echo ""

    # Deploy
    echo -e "${YELLOW}🚀 Deploying backend to $EC2_HOST...${NC}"

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo mkdir -p $REMOTE_BACKEND_PATH && sudo chown ubuntu:ubuntu $REMOTE_BACKEND_PATH"

    # Stop service
    echo -e "${YELLOW}🛑 Stopping service...${NC}"
    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo systemctl stop $SERVICE_NAME" 2>/dev/null || true

    # Upload binary
    echo -e "${YELLOW}📤 Uploading binary...${NC}"
    scp -i "$KEY_PATH" "$BINARY_PATH" $EC2_USER@$EC2_HOST:$REMOTE_BACKEND_PATH/$BINARY_NAME
    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "chmod +x $REMOTE_BACKEND_PATH/$BINARY_NAME"

    # Upload .env if exists
    if [ -f ".env.production" ]; then
        scp -i "$KEY_PATH" ".env.production" $EC2_USER@$EC2_HOST:$REMOTE_BACKEND_PATH/.env
        echo -e "${GREEN}   Uploaded .env.production${NC}"
    fi

    # Upload migrations
    echo -e "${YELLOW}📤 Uploading migrations...${NC}"
    scp -i "$KEY_PATH" -r crates/medbrains-db/src/migrations $EC2_USER@$EC2_HOST:$REMOTE_BACKEND_PATH/

    # Create systemd service
    echo -e "${YELLOW}🔧 Setting up systemd service...${NC}"
    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << 'EOF'
[Unit]
Description=MedBrains HMS Backend
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$REMOTE_BACKEND_PATH
ExecStart=$REMOTE_BACKEND_PATH/$BINARY_NAME
Restart=always
RestartSec=5
Environment=RUST_LOG=info
EnvironmentFile=$REMOTE_BACKEND_PATH/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$REMOTE_BACKEND_PATH

[Install]
WantedBy=multi-user.target
EOF"

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE_NAME"

    # Start service
    echo -e "${YELLOW}🔄 Starting service...${NC}"
    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo systemctl start $SERVICE_NAME"

    sleep 3
    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "sudo systemctl status $SERVICE_NAME --no-pager -l" || true

    echo -e "${GREEN}✅ Backend deployed!${NC}"
}

# ── Deploy Frontend ──
deploy_frontend() {
    echo -e "${YELLOW}🌐 Building frontend...${NC}"

    cd "$SCRIPT_DIR"
    pnpm --filter @medbrains/web build

    if [ ! -d "apps/web/dist" ]; then
        echo -e "${RED}❌ dist folder not found!${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Build successful!${NC}"
    du -sh apps/web/dist/
    echo ""

    # Deploy
    echo -e "${YELLOW}🚀 Deploying frontend to $EC2_HOST...${NC}"

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "mkdir -p /tmp/medbrains_deploy && rm -rf /tmp/medbrains_deploy/*"
    scp -i "$KEY_PATH" -r apps/web/dist/* $EC2_USER@$EC2_HOST:/tmp/medbrains_deploy/

    # Copy logo assets
    scp -i "$KEY_PATH" -r apps/web/public/logo $EC2_USER@$EC2_HOST:/tmp/medbrains_deploy/
    scp -i "$KEY_PATH" apps/web/public/favicon.svg $EC2_USER@$EC2_HOST:/tmp/medbrains_deploy/ 2>/dev/null || true

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "
sudo mkdir -p $REMOTE_FRONTEND_PATH
sudo rm -rf $REMOTE_FRONTEND_PATH/*
sudo mv /tmp/medbrains_deploy/* $REMOTE_FRONTEND_PATH/
sudo chown -R ubuntu:ubuntu $REMOTE_FRONTEND_PATH
rm -rf /tmp/medbrains_deploy
"

    echo -e "${GREEN}✅ Frontend deployed!${NC}"
}

# ── Setup Caddy ──
setup_caddy() {
    echo -e "${YELLOW}🔧 Adding MedBrains to Caddy config...${NC}"

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "
# Check if medbrains config already exists
if ! grep -q 'medbrains.alagappahospital.com' /etc/caddy/Caddyfile 2>/dev/null; then
    sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'CADDY'

# MedBrains HMS
medbrains.alagappahospital.com {
    encode gzip

    # API — reverse proxy to Rust backend
    handle /api/* {
        reverse_proxy 127.0.0.1:3000 {
            header_up Host {upstream_hostport}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-Proto https
            header_up X-Forwarded-For {remote_host}
        }
    }

    # WebSocket — queue displays
    handle /ws/* {
        reverse_proxy 127.0.0.1:3000
    }

    # Frontend SPA
    handle {
        root * /var/www/medbrains

        @static {
            path *.js *.css *.png *.jpg *.jpeg *.gif *.svg *.woff *.woff2 *.ttf *.eot *.ico *.wasm
        }
        header @static Cache-Control \"public, max-age=604800\"

        try_files {path} {path}/ /index.html
        file_server
    }

    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
        X-XSS-Protection \"1; mode=block\"
        Strict-Transport-Security \"max-age=31536000; includeSubDomains\"
    }

    log {
        output file /var/log/caddy/medbrains.log
    }
}
CADDY
    echo 'Caddy config added'
    sudo systemctl reload caddy
else
    echo 'MedBrains config already exists in Caddyfile'
fi
"

    echo -e "${GREEN}✅ Caddy configured!${NC}"
}

# ── Setup PostgreSQL Database ──
setup_database() {
    echo -e "${YELLOW}🗄️ Setting up PostgreSQL database...${NC}"

    ssh -i "$KEY_PATH" $EC2_USER@$EC2_HOST "
# Check if medbrains DB exists
if sudo -u postgres psql -lqt | cut -d '|' -f 1 | grep -qw medbrains; then
    echo 'Database medbrains already exists'
else
    sudo -u postgres createuser --no-superuser --no-createdb --no-createrole medbrains 2>/dev/null || true
    sudo -u postgres psql -c \"ALTER USER medbrains WITH PASSWORD 'medbrains_prod';\" 2>/dev/null || true
    sudo -u postgres createdb -O medbrains medbrains
    echo 'Database medbrains created'
fi
"

    echo -e "${GREEN}✅ Database ready!${NC}"
}

# ── Create Production .env ──
create_env() {
    if [ ! -f ".env.production" ]; then
        echo -e "${YELLOW}📝 Creating .env.production...${NC}"
        cat > .env.production << 'EOF'
DATABASE_URL=postgres://medbrains:medbrains_prod@localhost:5432/medbrains
BIND_ADDR=127.0.0.1:3000
CORS_ORIGIN=https://medbrains.alagappahospital.com
COOKIE_DOMAIN=medbrains.alagappahospital.com
SECURE_COOKIES=true
TRUSTED_PROXIES=127.0.0.1/32
RUST_LOG=medbrains_server=info
EOF
        echo -e "${GREEN}✅ Created .env.production — edit credentials before deploying!${NC}"
    fi
}

# ── Execute ──
case "$COMPONENT" in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    caddy)
        setup_caddy
        ;;
    database)
        setup_database
        ;;
    env)
        create_env
        ;;
    all)
        create_env
        setup_database
        deploy_backend
        deploy_frontend
        setup_caddy
        ;;
    *)
        echo "Usage: ./deploy.sh [frontend|backend|caddy|database|env|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 Deployment complete!${NC}"
echo -e "${GREEN}  🌐 https://medbrains.alagappahospital.com${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
