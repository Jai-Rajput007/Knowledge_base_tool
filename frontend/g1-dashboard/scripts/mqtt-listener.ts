import mqtt from "mqtt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("AGX Client connected to MQTT Broker (IoT Simulator)");
  // Subscribe to all feature and MCP updates for all tenants
  // In production, an AGX would only subscribe to its OWN tenant ID topic
  client.subscribe("tenant/+/features");
  client.subscribe("tenant/+/mcp");
  client.subscribe("tenant/+/users/create");
});

client.on("message", async (topic, message) => {
  try {
    const topicParts = topic.split("/");
    const tenantId = topicParts[1];
    const updateType = topicParts[2];
    const payload = JSON.parse(message.toString());

    if (updateType === "features") {
      console.log(`[MQTT] Received features update for tenant ${tenantId}`);
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { features: JSON.stringify(payload) }
      });
      console.log(`[MQTT] Features applied locally for ${tenantId}`);
      // Notify the frontend to re-fetch features in real-time
      await fetch("http://localhost:3000/api/events", { method: "POST" }).catch(() => {});
    } 
    else if (updateType === "mcp") {
      console.log(`[MQTT] Received MCP update for tenant ${tenantId}`);
      const { mcpId, isUnlocked } = payload;
      
      const config = await prisma.tenantMcpConfig.findFirst({
        where: { tenantId, mcpId }
      });

      if (config) {
        await prisma.tenantMcpConfig.update({
          where: { id: config.id },
          data: { isUnlocked }
        });
      } else {
        await prisma.tenantMcpConfig.create({
          data: { tenantId, mcpId, isUnlocked }
        });
      }
      console.log(`[MQTT] MCP config applied locally for ${tenantId} (${mcpId})`);
    }
    else if (updateType === "users" && topicParts[3] === "create") {
      console.log(`[MQTT] Received new user downstream sync for tenant ${tenantId}`);
      
      // Ensure tenant exists locally to prevent foreign key errors
      await prisma.tenant.upsert({
        where: { id: payload.tenantId },
        update: {},
        create: {
          id: payload.tenantId,
          name: "Test Tenant (Synced)"
        }
      });

      // Upsert the user into the local database
      await prisma.user.upsert({
        where: { id: payload.id },
        update: {
          email: payload.email,
          name: payload.name,
          password: payload.password,
          role: payload.role,
          requiresPasswordChange: payload.requiresPasswordChange,
          tenantId: payload.tenantId,
        },
        create: {
          id: payload.id,
          email: payload.email,
          name: payload.name,
          password: payload.password,
          role: payload.role,
          requiresPasswordChange: payload.requiresPasswordChange,
          tenantId: payload.tenantId,
        }
      });
      console.log(`[MQTT] New user ${payload.email} saved locally!`);
    }
  } catch (err) {
    console.error("[MQTT] Failed to process incoming message:", err);
  }
});

client.on("error", (err) => {
  console.error("MQTT Connection Error:", err);
});
