import mqtt from "mqtt";

// Connect to the local Mosquitto broker (IoT Simulator)
const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("AGX Client MQTT Publisher connected");
});

client.on("error", (err) => {
  console.error("AGX MQTT Publisher Connection Error:", err);
});

export const publishAuthSync = (tenantId: string, userId: string, passwordHash: string) => {
  if (client.connected) {
    const topic = `agx/${tenantId}/auth_sync`;
    const payload = { userId, passwordHash, requiresPasswordChange: false };
    
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) console.error(`Failed to publish to ${topic}:`, err);
      else console.log(`Published upstream auth sync to ${topic}`);
    });
  } else {
    console.warn("MQTT Client disconnected. Could not publish auth sync upstream.");
  }
};
