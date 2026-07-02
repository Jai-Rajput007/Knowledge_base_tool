import mqtt from "mqtt";

// Connect to the local Mosquitto broker (IoT Simulator)
const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("Super Admin connected to MQTT Broker (IoT Simulator)");
});

client.on("error", (err) => {
  console.error("MQTT Connection Error:", err);
});

export const publishFeatureUpdate = (tenantId: string, features: any) => {
  if (client.connected) {
    const topic = `tenant/${tenantId}/features`;
    client.publish(topic, JSON.stringify(features), { qos: 1 }, (err) => {
      if (err) console.error(`Failed to publish to ${topic}:`, err);
      else console.log(`Published features update to ${topic}`);
    });
  } else {
    console.warn("MQTT Client disconnected. Could not publish feature update.");
  }
};

export const publishMcpUpdate = (tenantId: string, mcpConfig: any) => {
  if (client.connected) {
    const topic = `tenant/${tenantId}/mcp`;
    client.publish(topic, JSON.stringify(mcpConfig), { qos: 1 }, (err) => {
      if (err) console.error(`Failed to publish to ${topic}:`, err);
      else console.log(`Published MCP update to ${topic}`);
    });
  } else {
    console.warn("MQTT Client disconnected. Could not publish MCP update.");
  }
};

export const publishUserSync = (tenantId: string, userData: any) => {
  if (client.connected) {
    const topic = `tenant/${tenantId}/users/create`;
    client.publish(topic, JSON.stringify(userData), { qos: 1 }, (err) => {
      if (err) console.error(`Failed to publish to ${topic}:`, err);
      else console.log(`Published user downstream sync to ${topic}`);
    });
  } else {
    console.warn("MQTT Client disconnected. Could not publish user sync.");
  }
};
