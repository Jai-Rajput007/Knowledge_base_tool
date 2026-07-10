module.exports = {
  apps: [
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
      script: "/home/jai/miniconda3/envs/nlp-env/bin/python3",
      args: "main.py",
      restart_delay: 3000,
      max_restarts: 20,
    },
    {
      name: "g1-frs-server",
      cwd: "../g1-nlp/frs",
      script: "/home/jai/miniconda3/envs/nlp-env/bin/python3",
      args: "frs_server.py --no-display --port 8001",
      restart_delay: 5000,
      max_restarts: 20,
    },
    {
      name: "g1-robot-sync",
      cwd: "../g1-nlp",
      script: "/home/jai/miniconda3/envs/nlp-env/bin/python3",
      args: "-m uvicorn robot_sync:app --host 0.0.0.0 --port 9000",
      restart_delay: 5000,
      max_restarts: 20,
    },
    {
      name: "g1-sa-mqtt-listener",
      cwd: "./super_admin/frontend",
      script: "npm",
      args: "run mqtt:listen",
      restart_delay: 5000,
      max_restarts: 50,
    }
  ]
};
