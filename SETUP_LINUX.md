# Linux Setup Guide - RAG Document Processing System

Complete setup instructions for running the project on Linux (Ubuntu/Debian/CentOS).

---

## 📋 Prerequisites

### 1. Install Docker & Docker Compose
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Install Ollama (for local LLM)
```bash
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

### 3. Install Node.js & npm
```bash
# Using NodeSource (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version
```

### 4. Install Python 3.11+
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# Verify
python3.11 --version
```

### 5. Install system dependencies
```bash
sudo apt install -y \
    git \
    curl \
    wget \
    build-essential \
    libpq-dev \
    poppler-utils \
    tesseract-ocr \
    libtesseract-dev
```

---

## 🗄️ Database Setup (PostgreSQL + pgvector)

### Option A: Using Docker (Recommended)
```bash
# Create docker-compose for database services
cd /path/to/project

# Start PostgreSQL with pgvector
docker run -d \
  --name rag-postgres \
  -e POSTGRES_USER=raguser \
  -e POSTGRES_PASSWORD=ragpassword \
  -e POSTGRES_DB=ragdb \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  ankane/pgvector:latest

# Verify it's running
docker ps
docker logs rag-postgres
```

### Option B: Install PostgreSQL locally
```bash
# Ubuntu/Debian
sudo apt install -y postgresql postgresql-contrib

# Install pgvector extension
sudo apt install -y postgresql-16-pgvector  # Adjust version as needed

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER raguser WITH PASSWORD 'ragpassword';"
sudo -u postgres psql -c "CREATE DATABASE ragdb OWNER raguser;"
sudo -u postgres psql -d ragdb -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## ⚙️ Backend Setup

### 1. Navigate to backend directory
```bash
cd /path/to/project/backend
```

### 2. Create Python virtual environment
```bash
python3.11 -m venv venv

# Activate
source venv/bin/activate

# Verify
which python
# Should show: /path/to/project/backend/venv/bin/python
```

### 3. Install Python dependencies
```bash
pip install --upgrade pip

# Install CPU-optimized dependencies first
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install all requirements
pip install -r requirements.txt
```

### 4. Configure environment variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env file
nano .env  # or vim .env
```

**Required .env configurations:**
```env
# Database (Docker setup)
DATABASE_URL=postgresql://raguser:ragpassword@localhost:5432/ragdb

# Or if using local PostgreSQL
# DATABASE_URL=postgresql://raguser:ragpassword@localhost:5432/ragdb

# Vector Database
VECTOR_DB_TYPE=pgvector

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2:latest
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2048

# Embeddings
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text:latest
EMBEDDING_DIMENSIONS=768
EMBEDDING_BATCH_SIZE=32
EMBEDDING_CPU_OPTIMIZED=true

# Application
APP_NAME="RAG Document System"
DEBUG=false
UPLOAD_DIR=./uploads
```

### 5. Initialize database
```bash
# Run database migrations/initialization
python -c "from app.db.database import init_db; init_db()"

# Or if you have Alembic migrations:
# alembic upgrade head
```

### 6. Test backend startup
```bash
# Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# In another terminal, test the API
curl http://localhost:8000/health
# Should return: {"status":"healthy","version":"1.0.0",...}
```

---

## 🎨 Frontend Setup

### 1. Navigate to frontend directory
```bash
cd /path/to/project/frontend/g1-dashboard
```

### 2. Install dependencies
```bash
# Using npm
npm install

# Or using yarn
yarn install

# Or using pnpm
pnpm install
```

### 3. Configure frontend environment
```bash
# Create .env.local
cp .env.example .env.local

# Edit and set backend API URL
nano .env.local
```

**Required .env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 4. Build and start frontend
```bash
# Development mode
npm run dev

# Or for production build
npm run build
npm start
```

Frontend will be available at: `http://localhost:3000`

---

## 🐳 Docker Compose Setup (Full Stack)

For easier setup, you can use Docker Compose for all services:

### 1. Create `docker-compose.yml` in project root
```yaml
version: '3.8'

services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: raguser
      POSTGRES_PASSWORD: ragpassword
      POSTGRES_DB: ragdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U raguser -d ragdb"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://raguser:ragpassword@postgres:5432/ragdb
      - VECTOR_DB_TYPE=pgvector
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend/g1-dashboard
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
    depends_on:
      - backend

volumes:
  postgres_data:
```

### 2. Create `Dockerfile` for backend
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3. Create `Dockerfile` for frontend
```dockerfile
# frontend/g1-dashboard/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 4. Run with Docker Compose
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🚀 Running the Application

### Manual Start (Development)

**Terminal 1 - PostgreSQL (if not using Docker):**
```bash
sudo systemctl start postgresql
```

**Terminal 2 - Ollama:**
```bash
ollama serve
```

**Terminal 3 - Backend:**
```bash
cd /path/to/project/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 4 - Frontend:**
```bash
cd /path/to/project/frontend/g1-dashboard
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Ollama**: http://localhost:11434

---

## 🧪 Testing the Setup

### 1. Test Ollama
```bash
curl http://localhost:11434/api/tags
# Should list downloaded models
```

### 2. Test Backend API
```bash
# Health check
curl http://localhost:8000/health

# Upload a document (replace with your file)
curl -X POST -F "file=@/path/to/your/document.pdf" \
  http://localhost:8000/api/v1/documents/upload

# List documents
curl http://localhost:8000/api/v1/documents/
```

### 3. Test Chat
```bash
# Send chat message
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this document about?",
    "enable_query_processing": true,
    "context_strategy": "hierarchy"
  }'
```

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to PostgreSQL"
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U raguser -d ragdb -h localhost -p 5432

# Check pgvector extension
psql -U raguser -d ragdb -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### Issue: "Ollama connection refused"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve &

# Check firewall
sudo ufw allow 11434/tcp
```

### Issue: "Module not found" in Python
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt --force-reinstall
```

### Issue: "Port already in use"
```bash
# Find and kill process using port 8000
sudo lsof -t -i:8000 | xargs kill -9

# Or use different port
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## 📁 Project Structure

```
project-root/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Config, logging
│   │   ├── db/            # Database models
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   ├── uploads/           # Document storage
│   ├── venv/              # Python virtual env
│   ├── requirements.txt
│   └── .env
├── frontend/
│   └── g1-dashboard/
│       ├── app/           # Next.js pages
│       ├── components/    # React components
│       ├── lib/           # API client
│       └── .env.local
├── docker-compose.yml
└── SETUP_LINUX.md         # This file
```

---

## 📝 Environment Variables Reference

### Backend (.env)
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `VECTOR_DB_TYPE` | Vector DB type | `pgvector` |
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` |
| `LLM_MODEL` | LLM model name | `llama3.2:latest` |
| `EMBEDDING_MODEL` | Embedding model | `nomic-embed-text:latest` |
| `UPLOAD_DIR` | Document upload path | `./uploads` |
| `DEBUG` | Debug mode | `false` |

### Frontend (.env.local)
| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:8000/api/v1` |

---

## 🎉 You're Ready!

After completing setup:
1. Open http://localhost:3000 in your browser
2. Upload documents via the Documents page
3. Chat with your documents via the Chat page
4. Use advanced options (hierarchy filters, context strategies) for better results

For support or issues, check the logs or refer to the troubleshooting section above.
