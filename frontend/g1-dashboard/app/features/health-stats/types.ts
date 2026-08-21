// Types for health-stats — mirrors backend/app/api/v1/endpoints/health.py's
// GET /telemetry response, which itself merges g1-nlp/robot_sync.py's
// /telemetry (Thor) and /robot/telemetry (G1, bridged from robot_agent's
// :7790 status feed).

export interface CpuCore {
  load_pct: number;
  clock_mhz: number;
}

export interface ThorTelemetry {
  reachable: boolean;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_free_gb: number | null;
  power_mode: string | null;
  gpu_util_pct: number | null;
  gpu_memory: { used_mb?: number; free_mb?: number; total_mb?: number };
  thermal_c: Record<string, number>;
  power_mw: Record<string, { inst_mw: number; avg_mw: number }>;
  cpu_cores: CpuCore[];
  uptime_hrs?: number;
  net_sent_mb?: number;
  net_recv_mb?: number;
}

export interface RobotBattery {
  soc: number;
  soh: number;
  voltage_mv: number;
  current_ma: number;
  temp_c: number;
  cycle: number;
  cell_vol_min_mv: number;
  cell_vol_max_mv: number;
  bms_state_flags: number[];
}

export interface RobotMotion {
  mode_machine: number;
  fsm_id: number;
  fsm_mode: number;
  task_id: number;
  task_time: number;
}

export interface RobotImu {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface RobotJoints {
  temp_c: number[];
  motorstate: number[];
}

export interface RobotSnapshot {
  ts: number;
  battery: RobotBattery;
  robot: RobotMotion;
  imu: RobotImu;
  max_motor_temp_c: number;
  joints: RobotJoints;
}

export interface RobotTelemetry {
  available: boolean;
  stale: boolean;
  last_seen_s_ago: number | null;
  data: RobotSnapshot | null;
}

export interface TelemetryResponse {
  timestamp: number;
  thor: ThorTelemetry;
  robot: RobotTelemetry;
}

// Fixed 29-joint order (motor_state indices 0-28) — see
// GESTURE_SYSTEM_PLAN.md-adjacent research and the SDK's JointIndex enum.
// Indices 29-34 are unused padding (29 is the arm_sdk takeover weight) and
// are never included here.
export interface JointGroup {
  label: string;
  indices: number[];
  x: number;
  y: number;
}

export const JOINT_NAMES: string[] = [
  "Left Hip Pitch", "Left Hip Roll", "Left Hip Yaw", "Left Knee", "Left Ankle", "Left Ankle Roll",
  "Right Hip Pitch", "Right Hip Roll", "Right Hip Yaw", "Right Knee", "Right Ankle", "Right Ankle Roll",
  "Waist Yaw", "Waist Roll", "Waist Pitch",
  "Left Shoulder Pitch", "Left Shoulder Roll", "Left Shoulder Yaw", "Left Elbow", "Left Wrist Roll", "Left Wrist Pitch", "Left Wrist Yaw",
  "Right Shoulder Pitch", "Right Shoulder Roll", "Right Shoulder Yaw", "Right Elbow", "Right Wrist Roll", "Right Wrist Pitch", "Right Wrist Yaw",
];

// Anatomical marker positions in a 200x400 viewBox (front view). Joints that
// share one physical location (e.g. the 3 waist DOF) are grouped under one
// marker showing their worst reading; the tooltip breaks out each DOF.
export const JOINT_GROUPS: JointGroup[] = [
  { label: "Left Hip",      indices: [0, 1, 2],   x: 78,  y: 215 },
  { label: "Left Knee",     indices: [3],         x: 74,  y: 278 },
  { label: "Left Ankle",    indices: [4, 5],      x: 70,  y: 338 },
  { label: "Right Hip",     indices: [6, 7, 8],   x: 122, y: 215 },
  { label: "Right Knee",    indices: [9],         x: 126, y: 278 },
  { label: "Right Ankle",   indices: [10, 11],    x: 130, y: 338 },
  { label: "Waist",         indices: [12, 13, 14], x: 100, y: 172 },
  { label: "Left Shoulder", indices: [15, 16, 17], x: 66,  y: 108 },
  { label: "Left Elbow",    indices: [18],        x: 50,  y: 150 },
  { label: "Left Wrist",    indices: [19, 20, 21], x: 40,  y: 192 },
  { label: "Right Shoulder", indices: [22, 23, 24], x: 134, y: 108 },
  { label: "Right Elbow",   indices: [25],        x: 150, y: 150 },
  { label: "Right Wrist",   indices: [26, 27, 28], x: 160, y: 192 },
];

// Heuristic thresholds — not from a published Unitree spec (none found),
// chosen as reasonable defaults for small BLDC actuators. Treat as
// provisional until real operating data (or vendor docs) refine them.
export const JOINT_TEMP_WARN_C = 55;
export const JOINT_TEMP_CRIT_C = 70;
