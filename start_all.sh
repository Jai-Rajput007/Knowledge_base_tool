#!/bin/bash
echo "Starting all G1 Universe services..."

BASE_DIR="/home/jai/g1-universe/knowledge_base_tool"

# 2. Super Admin Frontend (Next.js, Port 3001)
gnome-terminal --window --title="Super Admin Frontend" -- bash -ic "cd $BASE_DIR/super_admin/frontend && npm run dev; exec bash"

# 3. Super Admin MQTT Background Listener (Cloud Receiver)
gnome-terminal --window --title="Super Admin MQTT Listener" -- bash -ic "cd $BASE_DIR/super_admin/frontend && npm run mqtt:listen; exec bash"

# 4. Client Dashboard Backend (Python RAG, Port 8002)
gnome-terminal --window --title="Client Dashboard Backend" -- bash -ic "cd $BASE_DIR/backend && conda activate nlp-env && python main.py; exec bash"

# 4. Client Dashboard Frontend (Next.js, Port 3000)
gnome-terminal --window --title="Client Dashboard Frontend" -- bash -ic "cd $BASE_DIR/frontend/g1-dashboard && npm run dev; exec bash"

# 5. Client MQTT Background Listener (IoT Simulator)
gnome-terminal --window --title="Client MQTT Listener" -- bash -ic "cd $BASE_DIR/frontend/g1-dashboard && npm run mqtt:listen; exec bash"

echo "All services launched in separate terminals! Have a great coding session."
