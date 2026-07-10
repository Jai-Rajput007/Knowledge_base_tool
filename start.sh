#!/bin/bash

# G1 Universe Master Controller

function show_help() {
    echo "=========================================="
    echo "    G1 Universe Master Controller         "
    echo "=========================================="
    echo ""
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Starts all 4 services in the background (Backend, Client UI, Admin UI, MQTT)"
    echo "  stop     - Stops all running services safely"
    echo "  restart  - Restarts all running services"
    echo "  build    - Compiles Next.js production builds (run this when you change UI code)"
    echo "  monitor  - Opens a split-screen terminal dashboard to view all 4 services at once"
    echo "  logs     - Streams raw logs from all services"
    echo ""
}

# Ensure PM2 is installed
command -v pm2 >/dev/null 2>&1 || { echo "[*] Installing PM2..."; npm install -g pm2; }

case "$1" in
  start)
    echo "[*] Starting all G1 services via PM2..."
    pm2 start ecosystem.config.js
    echo ""
    echo "✅ All services are now running in the background!"
    echo "👉 Run './start.sh monitor' to see all your terminals in one dashboard."
    ;;
  stop)
    echo "[*] Stopping all G1 services..."
    pm2 stop ecosystem.config.js
    ;;
  restart)
    echo "[*] Restarting all G1 services..."
    pm2 restart ecosystem.config.js
    ;;
  build)
    echo "[*] Building Production Assets..."
    echo " -> Building Client Dashboard..."
    cd frontend/g1-dashboard && npm run build && cd ../..
    echo " -> Building Super Admin..."
    cd super_admin/frontend && npm run build && cd ../..
    echo "✅ Build Complete!"
    ;;
  monitor)
    echo "[*] Launching PM2 Terminal Dashboard..."
    pm2 monit
    ;;
  logs)
    pm2 logs
    ;;
  *)
    show_help
    exit 1
    ;;
esac
