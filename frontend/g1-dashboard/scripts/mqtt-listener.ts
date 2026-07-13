import mqtt from "mqtt";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const FRONTEND_EVENTS = process.env.FRONTEND_EVENTS_URL || "http://localhost:3000/api/events";

// ── helpers ──────────────────────────────────────────────────────────────────
async function callBackend(path: string, body: object): Promise<void> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${path} returned ${res.status}: ${text}`);
  }
}

async function notifyFrontend(): Promise<void> {
  await fetch(FRONTEND_EVENTS, { method: "POST" }).catch(() => {});
}

// ── MQTT ─────────────────────────────────────────────────────────────────────
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const client = mqtt.connect(MQTT_URL, {
  clientId: `g1-dashboard-listener-${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}`,
  clean: false, // Persistent session: broker queues messages while offline
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

client.on("connect", () => {
  console.log("[MQTT] AGX Client connected to broker (IoT Simulator)");
  // In production an AGX only subscribes to its OWN tenant topic.
  // For local dev we subscribe to all tenants.
  client.subscribe("tenant/+/info", { qos: 1 });
  client.subscribe("tenant/+/features", { qos: 1 });
  client.subscribe("tenant/+/mcp", { qos: 1 });
  client.subscribe("tenant/+/users/create", { qos: 1 });
  client.subscribe("tenant/+/tickets/status", { qos: 1 });
  client.subscribe("tenant/+/delete", { qos: 1 });
});

client.on("message", async (topic, message) => {
  const topicParts = topic.split("/");
  const tenantId = topicParts[1];
  const updateType = topicParts[2];

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(message.toString());
  } catch {
    console.error(`[MQTT] Could not parse message on ${topic}`);
    return;
  }

  try {
    // ── tenant/+/info ──────────────────────────────────────────────────────
    if (updateType === "info") {
      console.log(`[MQTT] Tenant info sync → ${tenantId}`);
      await callBackend("/tenant/sync", payload);
      await notifyFrontend();
      console.log(`[MQTT] ✓ Tenant ${tenantId} saved to local DB`);
    }

    // ── tenant/+/features ──────────────────────────────────────────────────
    else if (updateType === "features") {
      console.log(`[MQTT] Features update → tenant ${tenantId}`);
      await callBackend("/tenant/features/sync", { tenantId, features: payload });
      await notifyFrontend();
      console.log(`[MQTT] ✓ Features for ${tenantId} saved to local DB`);
    }

    // ── tenant/+/mcp ───────────────────────────────────────────────────────
    else if (updateType === "mcp") {
      console.log(`[MQTT] MCP update → tenant ${tenantId}, mcp ${payload.mcpId}`);
      await callBackend("/tenant/mcp/sync", { tenantId, ...payload });
      console.log(`[MQTT] ✓ MCP config for ${tenantId}/${payload.mcpId} saved to local DB`);
    }

    // ── tenant/+/users/create ──────────────────────────────────────────────
    else if (updateType === "users" && topicParts[3] === "create") {
      console.log(`[MQTT] New user downstream → tenant ${tenantId}, email ${payload.email}`);
      // Ensure the tenant exists locally before creating its user
      if (payload.tenantId) {
        await callBackend("/tenant/sync", {
          id: payload.tenantId,
          name: (payload.tenantName as string) || "Synced Tenant",
        }).catch(() => {}); // non-fatal — tenant may already exist
      }
      await callBackend("/tenant/users/sync", payload);
      console.log(`[MQTT] ✓ User ${payload.email} provisioned in local DB`);
    }

    // ── tenant/+/tickets/status ─────────────────────────────────────────────
    else if (updateType === "tickets" && topicParts[3] === "status") {
      console.log(`[MQTT] Ticket status update downstream → tenant ${tenantId}, ticket ${payload.id}`);
      await callBackend("/tenant/tickets/sync", payload);
      await notifyFrontend();
      console.log(`[MQTT] ✓ Ticket ${payload.id} status updated to ${payload.status}`);
    }

    // ── tenant/+/delete ──────────────────────────────────────────────────────
    else if (updateType === "delete") {
      console.log(`[MQTT] Tenant delete downstream → tenant ${tenantId}`);
      await callBackend("/tenant/sync-delete", { id: tenantId });
      await notifyFrontend();
      console.log(`[MQTT] ✓ Tenant ${tenantId} and its users deleted from local DB`);
    }

  } catch (err) {
    console.error(`[MQTT] Failed to process message on ${topic}:`, err);
  }
});

client.on("error", (err) => {
  console.error("[MQTT] Connection error:", err);
});

client.on("offline", () => {
  console.warn("[MQTT] Listener went offline. Broker unreachable.");
});

client.on("reconnect", () => {
  console.log("[MQTT] Attempting to reconnect to broker...");
});

client.on("close", () => {
  console.warn("[MQTT] Connection closed.");
});
