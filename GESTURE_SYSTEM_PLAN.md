# Gesture Recording & Robot Liveness — Implementation Plan

**Scope:** persist custom gestures in Postgres per tenant, and make the dashboard's
connectivity indicators tell the truth.

**Status:** plan only. Nothing below is implemented.

---

## 1. Executive summary

Three separate problems, verified against the running system:

| # | Problem | Root cause |
|---|---|---|
| 1 | Recorded gestures "don't store properly" | They are `.gesture` files on the Thor filesystem. The backend is a pure HTTP proxy with **zero database involvement**, and there is no tenant scoping. |
| 2 | Robot shows "connected" when it isn't | `robotStatus = agxStatus` — the robot indicator is a literal copy of the AGX indicator. Nothing ever checks the robot. |
| 3 | The deployed robot cannot record at all | The record/play implementation exists only on branch `surya/research/custom-gestures`. The deployed binary (`jai/translation`) has no such code. |

Problem 3 is the prerequisite — 1 and 2 are pointless until the recording code is actually deployed.

---

## 2. Current state (verified)

### 2.1 Where gestures live today

```
Robot arms (compliant, kp=0)
    ↓  robot_agent.cpp  [surya/research/custom-gestures ONLY]
<repo_root>/data/gestures/NAME.gesture      ← plain text: t,q0,q1,...,q13
    ↓  robot_sync.py :9000  (reads the directory)
    ↓  backend/app/api/v1/endpoints/gestures.py   ← PURE PROXY, no DB
    ↓  dashboard
```

`backend/app/api/v1/endpoints/gestures.py` is 158 lines and every endpoint is an
`httpx` call to `robot_sync`. There is no model, no query, no `tenant_id`.

Consequences:

- **Not tenant-scoped.** Every tenant sees the same robot's filesystem. Multi-tenancy is violated.
- **Lost on redeploy.** A Thor reflash, container rebuild, or `data/` clean wipes every recording.
- **No backup, no versioning, no audit trail.**
- **Unreachable when the Thor is down**, even just to list what exists.

### 2.2 The liveness bug

`frontend/g1-dashboard/app/dashboard/page.tsx:35-48`

```js
const { data: healthData, error: healthError } = useSWR('/gestures/health', fetcher);
const agxStatus   = healthError ? "offline" : healthData ? "online" : "offline";
const robotStatus = agxStatus;          // ← the entire bug
```

And `/gestures/health` (`gestures.py:146-158`) only does `GET http://<thor>:9000/health`.
So the "robot" light is really a second Thor light. A powered-off G1 shows ONLINE.

### 2.3 What already exists on `surya/research/custom-gestures`

This branch is substantially complete and should be the basis for the work:

| Capability | Detail |
|---|---|
| `record_gesture_start` / `record_gesture_stop` | TCP 7788 JSON. Takes over `rt/arm_sdk`, sets **kp=0** so the arms are backdrivable — this is the "frees the robot hands" behaviour. |
| `play_gesture` | Ramps into the first pose, follows waypoints with linear interpolation, ramps out. Has a guard against large jumps from re-grips during recording. |
| Waypoint format | `t,q0,q1,...,q13` — timestamp + 14 arm joint positions per line. |
| **Status feed on TCP :7790** | `{ts, battery{soc,soh,voltage_mv,current_ma,temp_c}, robot{mode_machine,fsm_mode}, imu{roll,pitch,yaw}, max_motor_temp_c}` — real DDS telemetry, pushed to connected clients. |
| `tools/gesture_test.html` | Standalone test harness. |

The 7790 status feed is a far better liveness signal than a ping, and it is already written.

### 2.4 Network topology — a hard constraint

```
Thor (dual-homed):   enP2p1s0  192.168.123.166/24   ← robot subnet
                     wlP1p1s0  192.168.1.107/24     ← LAN

Thor       → 192.168.123.164 : 0% loss, 0.12 ms    ✅
Web server → 192.168.123.164 : UNREACHABLE          ❌
```

**The backend cannot ping the robot.** Any robot reachability check must execute on
the Thor and be proxied back. This shapes the whole of Phase 1 — do not plan a
direct ping from the backend, it cannot work.

---

## 3. Target architecture

```
┌── Thor (192.168.1.107 / 192.168.123.166) ──────────────────────┐
│  robot_agent (C++)                                             │
│    :7788 gesture cmds   :7789 audio   :7790 status feed        │
│    records → data/gestures/NAME.gesture  (local scratch)       │
│                          ↕                                     │
│  robot_sync (FastAPI :9000)                                    │
│    /gestures/custom/...      record, play, list, delete        │
│    /gestures/custom/{n}/raw  NEW — return waypoints for upload │
│    /gestures/custom/push     NEW — write waypoints from DB     │
│    /robot/ping               NEW — ping 192.168.123.164 here   │
└────────────────────────────────────────────────────────────────┘
                          ↕ HTTP (LAN)
┌── Web server ──────────────────────────────────────────────────┐
│  backend :8002                                                 │
│    /gestures/*      now DB-backed, tenant-scoped               │
│    /robot/status    aggregated liveness                        │
│         ↓                                                      │
│  Postgres :5433   custom_gestures  (waypoints live here)       │
└────────────────────────────────────────────────────────────────┘
```

**Postgres is the source of truth.** The Thor filesystem becomes a cache: on
playback, if the file is missing there, the backend pushes it down first. That
survives reflashes and gives per-tenant isolation.

---

## 4. Phase 0 — Deploy the recording code (prerequisite)

Port from `surya/research/custom-gestures` into the working branch:

- `cpp/robot_agent.cpp` — record/play/status blocks (~959 added lines there; take
  the gesture and status sections, not the whole file, to avoid regressing the
  audio/gesture code currently in production)
- Rebuild via `cpp/build.sh`, redeploy, confirm `:7788`, `:7789`, `:7790` all listen

**Verify before proceeding:** record a 5-second gesture by hand, confirm
`data/gestures/NAME.gesture` appears with sane values, and play it back.

> ⚠️ `g1-robot-agent` currently shows **↺ 94 restarts** in PM2. Investigate before
> building on top of it — the wrapper waits for `enP2p1s0` to come UP, so a
> flapping interface or a powered-down robot causes a crash loop. Recording a
> gesture through an agent that restarts mid-capture will silently lose data.

---

## 5. Phase 1 — Honest connectivity

### 5.1 New endpoint on `robot_sync` (runs on the Thor)

```python
@app.get("/robot/ping")
def robot_ping():
    """Is the G1 reachable on the DDS subnet? Must run here — the web server
    is not on 192.168.123.0/24 and cannot reach the robot directly."""
    r = subprocess.run(["ping", "-c", "1", "-W", "1", ROBOT_IP],
                       capture_output=True)
    return {"robot_ip": ROBOT_IP, "reachable": r.returncode == 0,
            "checked_at": time.time()}
```

`ROBOT_IP = "192.168.123.164"` — the G1 PC1. (Note: the root `CLAUDE.md` documents
`.165`; the correct address is **.164**, confirmed by ping.)

### 5.2 New backend endpoint

`GET /api/v1/robot/status` returns all three signals separately:

```json
{
  "thor":  {"status": "online",  "note": "implicit — UI cannot load if Thor is down"},
  "robot": {"status": "online",  "reachable": true, "ip": "192.168.123.164",
            "checked_at": 1755600000},
  "agent": {"status": "online",  "ports": {"7788": true, "7789": true, "7790": true}}
}
```

- **Thor** — hardcode `online`, per your requirement. The dashboard is served
  through the Thor path; if it were down the page would not render. Keep the field
  in the payload rather than removing it, so the UI shape stays stable.
- **Robot** — from `robot_sync /robot/ping`. If `robot_sync` itself is unreachable,
  report `unknown`, **not** `online`. That is the specific bug being fixed.
- **Agent** — whether robot_agent's TCP ports accept a connection. Distinguishes
  "robot is powered on but the agent crashed" from "robot is off", which the
  current single indicator cannot express.

### 5.3 Frontend

Replace `dashboard/page.tsx:47-48`:

```js
// BEFORE
const agxStatus   = healthError ? "offline" : healthData ? "online" : "offline";
const robotStatus = agxStatus;                       // ← wrong

// AFTER
const { data: status } = useSWR('/robot/status', fetcher, { refreshInterval: 5000 });
const thorStatus  = 'online';                        // implicit
const robotStatus = status?.robot?.status ?? 'unknown';
const agentStatus = status?.agent?.status ?? 'unknown';
```

Add a third visual state. Today it is a green/red binary; `unknown` (amber) is
needed for "we cannot tell", which is honest when `robot_sync` is unreachable.

Apply the same change to the gesture page's connectivity badge.

### 5.4 Upgrade path (optional, better)

Once `:7790` is deployed, subscribe to the status feed instead of polling ping.
Liveness then becomes "a status frame arrived in the last N seconds", and you get
battery SOC, FSM mode, and motor temperature for free — genuinely useful on set
and during demos. Ping answers "is it on the network"; the status feed answers
"is the robot actually alive and healthy".

---

## 6. Phase 2 — Postgres persistence

### 6.1 Data model

New file `backend/app/models/custom_gesture.py`, following `robot_map.py`, which is
the established pattern for a per-tenant robot asset:

```python
class CustomGesture(Base):
    __tablename__ = "custom_gestures"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id   = Column(String, ForeignKey("Tenant.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    name        = Column(String, nullable=False)          # unique per tenant
    description = Column(String, nullable=True)

    # Recording payload
    waypoints    = Column(JSON, nullable=False)   # [[t, q0..q13], ...]
    sample_count = Column(Integer, nullable=False)
    duration_s   = Column(Float,   nullable=False)
    joint_count  = Column(Integer, default=14)

    # Provenance
    recorded_on   = Column(String, nullable=True)   # robot/serial identifier
    schema_version = Column(Integer, default=1)     # waypoint format version

    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = (UniqueConstraint("tenant_id", "name",
                                       name="uq_gesture_tenant_name"),)
```

**Storage sizing — resolved, JSON is correct.** `robot_agent.cpp` records at a fixed
**30 Hz** (`constexpr float sample_dt = 1.f/30.f`), 14 joints per sample. Note the
control loop runs at 50 Hz (`control_dt = 0.02f`) but sampling is deliberately
decimated to 30 Hz.

| Gesture length | Rows | Values | ≈ JSON size |
|---|---|---|---|
| 5 s  | 150 | 2,250  | ~22 KB |
| 10 s | 300 | 4,500  | ~45 KB |
| 30 s | 900 | 13,500 | ~135 KB |

Comfortably inside JSONB's efficient range, and it stays queryable and debuggable.
No need for `bytea` packing — that was only worth considering at 500 Hz.

`sample_count` and `duration_s` are stored denormalised so the list view never has
to load or parse the waypoint blob.

`schema_version` is deliberate: if the waypoint format ever changes (different joint
count, added velocity), old recordings must still be identifiable and playable.

### 6.2 Sync flow

**Record → store**
```
POST /gestures/custom/record/start {name}
   → backend: reserve name for tenant (409 if taken), proxy to robot_sync
POST /gestures/custom/record/stop
   → robot_sync: robot_agent writes NAME.gesture
   → backend: GET robot_sync /gestures/custom/{name}/raw   [NEW endpoint]
   → parse waypoints → INSERT into custom_gestures with tenant_id
   → return the DB row
```

**Play**
```
POST /gestures/custom/{id}/play
   → backend: SELECT ... WHERE id AND tenant_id      ← tenant isolation enforced here
   → HEAD robot_sync /gestures/custom/{name}         does the file exist on Thor?
   → if missing: POST robot_sync /gestures/custom/push {name, waypoints}  [NEW]
   → POST robot_sync /gestures/custom/{name}/play
```

The push-on-miss step is what makes a Thor reflash a non-event.

**List** reads Postgres only — works with the robot powered off, which the current
implementation cannot do.

**Delete** removes the DB row, then best-effort deletes the file. A failed file
delete must not fail the request; the DB is authoritative.

### 6.3 New robot_sync endpoints

| Endpoint | Purpose |
|---|---|
| `GET /gestures/custom/{name}/raw` | Return parsed waypoints so the backend can persist them |
| `POST /gestures/custom/push` | Write waypoints from the DB back to `data/gestures/` |
| `HEAD /gestures/custom/{name}` | Cheap existence check before playback |
| `GET /robot/ping` | Phase 1 |

### 6.4 Migration

Existing `.gesture` files on the Thor predate tenant scoping, so they cannot be
auto-assigned. Provide a one-off import that takes an explicit `tenant_id`:

```bash
python scripts/import_gestures.py --tenant-id <id> [--dry-run]
```

Never guess the tenant.

---

## 7. Phase 3 — Dashboard UI

Existing surface: `app/gesture/page.tsx`, `app/features/configuration-gestures/`,
`app/features/communication-gestures/`. Feature flags `configurationGestures` and
`communicationGestures` already exist in the Super Admin's 21 canonical flags, so
gating is in place.

Changes:

1. **Record flow** — a clear three-state machine (`idle → recording → saving`). While
   recording, show elapsed time and a prominent warning that **the arms are limp**;
   that is a physical safety issue, not a UI nicety.
2. **Name collision** — check for an existing name before starting, not after
   recording. Losing a take to a 409 is unacceptable.
3. **Gesture list** — served from Postgres, so it renders with the robot off. Show
   duration, sample count, created-by, created-at.
4. **Play** — disable when `robot.status !== 'online'`, with the reason on hover.
5. **Connectivity badges** — three indicators (Thor / Robot / Agent), amber for
   `unknown`.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Compliant arms drop under gravity.** kp=0 means the arms are limp — they will fall if unsupported, and can pinch. | Require a confirm dialog before recording. Ensure a human is holding the arms. This is the single biggest safety issue in this feature. |
| `robot_agent` crash-loops (↺ 94) mid-recording | Fix before Phase 0. Have the backend verify `sample_count > 0` and reject empty recordings rather than storing a useless row. |
| Porting 959 lines of C++ regresses working audio/gesture code | Port only the gesture/status sections; keep the audio path byte-identical. Test TTS playback after the rebuild. |
| Replacing a robot unit invalidates recordings | Joint calibration differs between units. `recorded_on` records provenance so a swapped robot can be detected and the user warned. |
| Filename collision on the flat Thor filesystem | Names are unique per tenant, but `data/gestures/` is flat. Namespace the on-disk file as `{tenant_id}__{name}.gesture`. |

---

## 9. Decisions and remaining questions

### Decided

1. **One robot per tenant.** Gestures are keyed by `tenant_id` alone — **no
   `robot_id` column**. The schema in §6.1 is final as written. The `robot_ip` query
   parameter in `gestures.py` remains a transport detail (which AGX to talk to) and
   must never be used to scope data ownership.
2. **Sample rate is 30 Hz** — read from `robot_agent.cpp`, not assumed. JSON storage
   confirmed; see the sizing table in §6.1.
3. **Access: `admin` + `editor`**, matching the current `/gestures` policy. Tighter
   RBAC is a separate workstream, explicitly out of scope here. The safety confirm
   dialog in §7 carries the weight for now, since recording physically moves the
   robot with limp arms.

### Still open

4. **Should gestures be playable from chat** — exposed as a `perform_gesture` tool
   the LLM can call? Tool calling is now proven
   (`g1-nlp/docs/TOOL_CALLING_GUIDE.md`) and `custom_gestures` would be a natural
   backend for it, but this is scope beyond what was asked. Flagged, not planned.

---

## 10. Suggested order

| Step | Work | Depends on |
|---|---|---|
| 0 | Fix the robot_agent restart loop | — |
| 1 | Port record/play/status C++, rebuild, verify by hand | 0 |
| 2 | `robot_sync`: `/robot/ping` | — (parallel with 1) |
| 3 | Backend `/robot/status` + dashboard indicators | 2 |
| 4 | `custom_gestures` model + migration | — (parallel) |
| 5 | `robot_sync`: `/raw`, `/push`, `HEAD` | 1 |
| 6 | Rewrite `gestures.py` as DB-backed | 4, 5 |
| 7 | Dashboard record/list/play UI | 3, 6 |
| 8 | Import existing `.gesture` files | 6 |

Steps 2–3 are independent of the C++ work and fix the visible bug you noticed, so
they are the fastest path to a user-visible improvement.

---

## 11. File reference

| Path | Change |
|---|---|
| `g1-nlp/cpp/robot_agent.cpp` | Port record/play/status from `surya/research/custom-gestures` |
| `g1-nlp/robot_sync.py` | Add `/robot/ping`, `/gestures/custom/{name}/raw`, `/push`, `HEAD` |
| `backend/app/models/custom_gesture.py` | **New** — model above |
| `backend/app/api/v1/endpoints/gestures.py` | Rewrite: proxy → DB-backed, tenant-scoped |
| `backend/app/api/v1/endpoints/robot.py` | **New** — `/robot/status` |
| `frontend/.../app/dashboard/page.tsx` | Fix `robotStatus = agxStatus` (L47-48) |
| `frontend/.../app/features/configuration-gestures/` | Record UI, DB-backed list |
| `scripts/import_gestures.py` | **New** — one-off migration |

### Reference branches

| Branch | Contains |
|---|---|
| `surya/research/custom-gestures` | Full record/play + `:7790` status feed + `tools/gesture_test.html` — **the basis for Phase 0** |
| `feat/com-gesture` | `comm_gesture_start/stop` looped replay, `g1_speak_with_gesture.py` (speech+gesture sync) |
| `feature/gestures` | `services/gesture/gesture_service.py` only |
| `feat/v1/remote-control` | Joystick DDS handling — unrelated but same file |
