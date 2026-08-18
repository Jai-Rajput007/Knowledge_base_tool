const path = require('path');
const homeDir = process.env.HOME || '/home/jai';

module.exports = {
  apps: [
    {
      name: "g1-docker-db",
      cwd: "./",
      script: "docker",
      args: "compose up -d",
      autorestart: false,
      watch: false
    },
    {
      name: "g1-docker-sa",
      cwd: "./super_admin",
      script: "docker",
      args: "compose up -d",
      autorestart: false,
      watch: false
    },
    {
      name: "g1-dashboard",
      cwd: "./frontend/g1-dashboard",
      script: "npm",
      args: "run start -- -H 0.0.0.0 -p 3000",
      restart_delay: 3000,
      max_restarts: 20,
      env: { 
        NODE_ENV: "production" 
      }
    },
    {
      name: "g1-mqtt-listener",
      cwd: "./frontend/g1-dashboard",
      script: "npm",
      args: "run mqtt:listen",
      restart_delay: 5000,
      max_restarts: 50,
    },
    {
      name: "g1-super-admin",
      cwd: "./super_admin/frontend",
      script: "npm",
      args: "run start -- -H 0.0.0.0 -p 3001",
      restart_delay: 3000,
      env: { 
        NODE_ENV: "production" 
      }
    },
    {
      name: "g1-backend",
      cwd: "./backend",
      script: path.join(homeDir, "miniconda3/envs/nlp-env/bin/python3"),
      args: "main.py",
      interpreter: "none",
      restart_delay: 3000,
      max_restarts: 20,
      env: {
        CONDA_DEFAULT_ENV: "nlp-env",
        CONDA_PREFIX: path.join(homeDir, "miniconda3/envs/nlp-env"),
        PATH: `${path.join(homeDir, "miniconda3/envs/nlp-env/bin")}:${path.join(homeDir, "miniconda3/bin")}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
        PYTHONPATH: "."
      },
    },
    {
      name: "g1-frs-server",
      cwd: "../g1-nlp/frs",
      script: path.join(homeDir, "miniconda3/envs/frs-env/bin/python3"),
      args: "frs_server.py --no-display --port 8001",
      restart_delay: 5000,
      max_restarts: 20,
    },
    {
      name: "g1-robot-sync",
      cwd: "../g1-nlp",
      script: path.join(homeDir, "miniconda3/envs/nlp-env/bin/uvicorn"),
      args: "robot_sync:app --host 0.0.0.0 --port 9000",
      interpreter: "none",
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        CONDA_DEFAULT_ENV: "nlp-env",
        CONDA_PREFIX: path.join(homeDir, "miniconda3/envs/nlp-env"),
        PATH: `${path.join(homeDir, "miniconda3/envs/nlp-env/bin")}:${path.join(homeDir, "miniconda3/bin")}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
        PYTHONPATH: "."
      },
    },
    {
      name: "g1-robot-agent",
      cwd: "../g1-nlp/cpp/build",
      script: "./robot_agent_start.sh",
      interpreter: "bash",
      // wrapper waits for enP2p1s0 to be UP before exec-ing the binary
      kill_timeout: 8000,              // give DDS time to shut down cleanly
      restart_delay: 5000,             // base delay before first retry
      exp_backoff_restart_delay: 100,  // exponential backoff — slows retries so max_restarts isn't exhausted in seconds
      max_restarts: 20,
    },
    {
      name: "g1-sa-mqtt-listener",
      cwd: "./super_admin/frontend",
      script: "npm",
      args: "run mqtt:listen",
      restart_delay: 5000,
      max_restarts: 50,
    },
    {
      name: "kokoro-tts",
      cwd: "../g1-nlp",
      script: "./start_kokoro.sh",
      interpreter: "bash",
      restart_delay: 3000,
      max_restarts: 20,
    },
    {
      name: "sglang",
      cwd: "../g1-nlp",
      script: "./start_sglang.sh",
      interpreter: "bash",
      restart_delay: 5000,
      max_restarts: 20,
    }
  ]
};
