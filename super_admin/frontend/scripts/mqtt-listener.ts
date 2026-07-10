import mqtt from "mqtt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("Super Admin MQTT Listener connected");
  // Subscribe to auth sync events from all AGX robots
  client.subscribe("agx/+/auth_sync");
  client.subscribe("agx/+/profile_sync");
  client.subscribe("tickets/created");
});

client.on("message", async (topic, message) => {
  try {
    const topicParts = topic.split("/");
    const payload = JSON.parse(message.toString());

    if (topic === "tickets/created") {
      console.log(`[MQTT] Received new ticket creation from tenant ${payload.tenantId}`);
      await prisma.supportTicket.create({
        data: {
          id: payload.id,
          tenantId: payload.tenantId,
          name: payload.name,
          email: payload.email,
          subject: payload.subject,
          description: payload.description,
          status: payload.status,
          createdAt: new Date(payload.createdAt)
        }
      });
      console.log(`[MQTT] Ticket ${payload.id} saved to master database.`);
      return;
    }

    const tenantId = topicParts[1];
    const updateType = topicParts[2];

    if (updateType === "auth_sync") {
      console.log(`[MQTT] Received upstream auth sync from AGX for tenant ${tenantId}`);
      
      const { userId, passwordHash, requiresPasswordChange } = payload;

      // Update the master cloud database with the new password hash
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: passwordHash,
          requiresPasswordChange
        }
      });
      console.log(`[MQTT] Master cloud database updated for user ${userId}`);
    } else if (updateType === "profile_sync") {
      console.log(`[MQTT] Received upstream profile sync from AGX for tenant ${tenantId}`);
      
      const { name, host, hostEmail, companyDescription, companyType, companyLogo } = payload;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          name,
          host,
          hostEmail,
          companyDescription,
          companyType,
          companyLogo
        }
      });
      console.log(`[MQTT] Master cloud database updated for tenant profile ${tenantId}`);
    }
  } catch (err) {
    console.error("[MQTT] Failed to process incoming message:", err);
  }
});

client.on("error", (err) => {
  console.error("MQTT Connection Error:", err);
});
