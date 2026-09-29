/**
 * Simulated Thor + G1 telemetry, shaped exactly like GET /health/telemetry.
 * Values drift smoothly over time so the Robot Health page looks live, and
 * sit in the same ranges a connected Jetson Thor and Unitree G1 report.
 */

const wave = (t: number, period: number, phase = 0) => Math.sin((t / period) * Math.PI * 2 + phase);
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// Idle resting temperatures per joint (°C): legs and waist run warmer than wrists.
const BASE_JOINT_TEMPS = [
  41, 39, 37, 46, 38, 36, // left leg
  41, 39, 37, 49, 38, 36, // right leg (right knee a little warmer)
  43, 40, 42, // waist
  38, 36, 35, 37, 33, 33, 32, // left arm
  38, 36, 35, 37, 33, 33, 32, // right arm
];

export function demoTelemetry(sessionStart: number) {
  const now = Date.now();
  const t = now / 1000;
  const minutes = (now - sessionStart) / 60_000;

  const soc = Math.max(38, Math.round(82 - minutes * 0.35));
  const cpu = 34 + 9 * wave(t, 47) + 4 * wave(t, 13, 1.3);
  const coreCount = 14;
  const cpu_cores = Array.from({ length: coreCount }, (_, i) => ({
    load_pct: Math.max(3, Math.min(97, round(cpu + 18 * wave(t, 9 + i, i), 0))),
    clock_mhz: 2601,
  }));

  const temp_c = BASE_JOINT_TEMPS.map((b, i) => round(b + 2.2 * wave(t, 90 + i * 7, i) + minutes * 0.03, 1));
  const max_motor_temp_c = Math.max(...temp_c);

  return {
    timestamp: t,
    thor: {
      reachable: true,
      cpu_percent: round(cpu, 1),
      memory_percent: round(47 + 3 * wave(t, 120), 1),
      disk_free_gb: 412.6,
      power_mode: "MAXN",
      gpu_util_pct: null,
      gpu_clock_pct: round(58 + 22 * wave(t, 31, 0.7), 0),
      gpu_memory: { used_mb: 18_432, free_mb: 112_640, total_mb: 131_072 },
      thermal_c: {
        tj: round(54 + 4 * wave(t, 75), 1),
        cpu: round(51 + 3.5 * wave(t, 70, 0.4), 1),
        gpu: round(49 + 4 * wave(t, 60, 1.1), 1),
        soc0: round(47 + 2 * wave(t, 110), 1),
      },
      power_mw: {
        VIN: { inst_mw: Math.round(62_000 + 9_000 * wave(t, 40)), avg_mw: 61_400 },
        VDD_GPU: { inst_mw: Math.round(21_000 + 6_000 * wave(t, 33, 0.5)), avg_mw: 20_800 },
        VDD_CPU_SOC: { inst_mw: Math.round(14_500 + 3_000 * wave(t, 27, 1.2)), avg_mw: 14_300 },
      },
      cpu_cores,
      uptime_hrs: round(126.4 + minutes / 60, 1),
      net_sent_mb: round(8_420 + minutes * 3.1, 1),
      net_recv_mb: round(15_760 + minutes * 5.4, 1),
    },
    robot: {
      available: true,
      stale: false,
      last_seen_s_ago: 0.4,
      data: {
        ts: t,
        battery: {
          confirmed: true,
          soc,
          soh: 97,
          voltage_mv: Math.round(47_800 + soc * 45 + 60 * wave(t, 20)),
          current_ma: Math.round(-5_400 - 1_800 * Math.abs(wave(t, 25))),
          temp_c: round(31 + 2 * wave(t, 200), 1),
          cycle: 143,
          cell_vol_min_mv: 3_952 + Math.round(soc * 0.9),
          cell_vol_max_mv: 3_987 + Math.round(soc * 0.9),
          bms_state_flags: [0, 0],
        },
        robot: { mode_machine: 5, fsm_id: 801, fsm_mode: 1, task_id: 0, task_time: 0 },
        imu: {
          roll: round(0.6 * wave(t, 6), 2),
          pitch: round(0.9 * wave(t, 8, 0.8), 2),
          yaw: round(12.4 + 1.5 * wave(t, 40), 2),
        },
        max_motor_temp_c,
        joints: { temp_c, motorstate: new Array(29).fill(0) },
      },
    },
  };
}
