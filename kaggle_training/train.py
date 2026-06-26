"""
G1 Wake Word Training Script — runs on Kaggle GPU
Reads config from /kaggle/input/g1-wakeword-config/config.json
Outputs .onnx model to /kaggle/working/output/
"""

import json
import os
import pathlib
import shutil
import subprocess
import sys
import yaml

# ── Read job config ────────────────────────────────────────────────────────
CONFIG_DIR  = pathlib.Path("/kaggle/input/g1-wakeword-config")
SAMPLES_DIR = CONFIG_DIR / "samples"

config_file = CONFIG_DIR / "config.json"
if not config_file.exists():
    print("ERROR: config.json not found in input dataset", flush=True)
    sys.exit(1)

cfg = json.loads(config_file.read_text())

JOB_ID       = cfg["job_id"]
WAKE_PHRASE  = cfg["wake_phrase"]
MODEL_NAME   = cfg["model_name"]
STEPS        = cfg.get("steps",    50000)
N_SAMPLES    = cfg.get("n_samples",10000)
N_VAL        = cfg.get("n_samples_val", max(500, N_SAMPLES // 5))
AUG_ROUNDS   = cfg.get("aug_rounds", 3)
SKIP_ACAV    = cfg.get("skip_acav",  True)
MODEL_TYPE   = cfg.get("model_type", "conv_attention")
MODEL_SIZE   = cfg.get("model_size", "medium")
NEG_PHRASES  = cfg.get("negative_phrases", [])

print(f"=== G1 Wake Word Trainer ===")
print(f"Job ID      : {JOB_ID}")
print(f"Wake phrase : {WAKE_PHRASE}")
print(f"Model name  : {MODEL_NAME}")
print(f"Steps       : {STEPS}")
print(f"Samples     : {N_SAMPLES} train + {N_VAL} val")
print(f"Architecture: {MODEL_TYPE} ({MODEL_SIZE})")
print(f"Aug rounds  : {AUG_ROUNDS}")
print(f"Neg phrases : {len(NEG_PHRASES)}", flush=True)


# ── Install dependencies ───────────────────────────────────────────────────
print("\n[1/6] Installing dependencies...", flush=True)

subprocess.run(
    ["apt-get", "install", "-y", "-q", "espeak-ng", "libsndfile1", "ffmpeg", "sox"],
    check=True
)

# Clone livekit-wakeword if not present
REPO_DIR = pathlib.Path("/kaggle/working/livekit-wakeword")
if not REPO_DIR.exists():
    subprocess.run(
        ["git", "clone", "--depth", "1",
         "https://github.com/livekit/livekit-wakeword.git", str(REPO_DIR)],
        check=True
    )

subprocess.run(
    [sys.executable, "-m", "pip", "install", "-q", "-e",
     f"{REPO_DIR}[train,export,eval]"],
    check=True
)
os.chdir(REPO_DIR)
print("Dependencies installed.", flush=True)


# ── Write config YAML ─────────────────────────────────────────────────────
print("\n[2/6] Writing training config...", flush=True)

config = {
    "model_name":                MODEL_NAME,
    "target_phrases":            [WAKE_PHRASE],
    "n_samples":                 N_SAMPLES,
    "n_samples_val":             N_VAL,
    "n_background_samples":      200,
    "n_background_samples_val":  40,
    "tts_batch_size":            25,
    "custom_negative_phrases":   NEG_PHRASES,
    "noise_scales":              [0.98],
    "noise_scale_ws":            [0.98],
    "length_scales":             [0.75, 1.0, 1.25],
    "slerp_weights":             [0.2, 0.35, 0.5, 0.65, 0.8],
    "data_dir":                  "./data",
    "output_dir":                "./output",
    "augmentation": {
        "clip_duration":    2.0,
        "batch_size":       32,
        "rounds":           AUG_ROUNDS,
        "background_paths": ["./data/backgrounds"],
        "rir_paths":        ["./data/rirs"],
    },
    "model": {
        "model_type": MODEL_TYPE,
        "model_size": MODEL_SIZE,
    },
    "steps":               STEPS,
    "learning_rate":       0.0001,
    "weight_decay":        0.01,
    "label_smoothing":     0.05,
    "max_negative_weight": 2000,
    "target_fp_per_hour":  0.2,
    "batch_n_per_class": {
        "positive":             50,
        "adversarial_negative": 50,
        "ACAV100M_sample":      0 if SKIP_ACAV else 1024,
        "background_noise":     50,
    },
}

config_path = pathlib.Path(f"configs/{MODEL_NAME}.yaml")
config_path.parent.mkdir(exist_ok=True)
config_path.write_text(yaml.dump(config, default_flow_style=False, sort_keys=False))
print(f"Config written to {config_path}", flush=True)


# ── Copy user recordings into positive_train ──────────────────────────────
if SAMPLES_DIR.exists():
    wav_files = list(SAMPLES_DIR.glob("*.wav"))
    if wav_files:
        positive_train = pathlib.Path(f"output/{MODEL_NAME}/positive_train")
        positive_train.mkdir(parents=True, exist_ok=True)

        converted = 0
        for src in wav_files:
            dest = positive_train / src.name
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(src),
                 "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", str(dest)],
                capture_output=True
            )
            if result.returncode == 0:
                converted += 1

        print(f"Copied {converted}/{len(wav_files)} user recordings to positive_train", flush=True)


# ── Run pipeline ──────────────────────────────────────────────────────────
def run(step_name: str, *cmd: str):
    print(f"\n[{step_name}]", " ".join(cmd), flush=True)
    result = subprocess.run(list(cmd))
    if result.returncode != 0:
        print(f"FAILED: {step_name}", flush=True)
        sys.exit(result.returncode)
    print(f"{step_name} done.", flush=True)


setup_cmd = ["livekit-wakeword", "setup", str(config_path)]
if SKIP_ACAV:
    setup_cmd.append("--skip-acav")

run("[3/6] Setup",    *setup_cmd)
run("[4/6] Generate", "livekit-wakeword", "generate", str(config_path))
run("[5/6] Augment",  "livekit-wakeword", "augment",  str(config_path))
run("[5/6] Train",    "livekit-wakeword", "train",    str(config_path))
run("[6/6] Export",   "livekit-wakeword", "export",   str(config_path))
run("[6/6] Eval",     "livekit-wakeword", "eval",     str(config_path))


# ── Print eval results ────────────────────────────────────────────────────
eval_path = pathlib.Path(f"output/{MODEL_NAME}/{MODEL_NAME}_eval.json")
if eval_path.exists():
    results = json.loads(eval_path.read_text())
    print("\n=== EVAL RESULTS ===")
    print(f"AUT                : {results.get('aut', 'N/A'):.4f}")
    print(f"Optimal threshold  : {results.get('optimal_threshold', 'N/A')}")
    print(f"Optimal recall     : {results.get('optimal_recall', 'N/A'):.1%}")
    print(f"Optimal FPPH       : {results.get('optimal_fpph', 'N/A'):.3f}")
    print(f"ONNX               : output/{MODEL_NAME}/{MODEL_NAME}.onnx", flush=True)

print("\n=== TRAINING COMPLETE ===", flush=True)
