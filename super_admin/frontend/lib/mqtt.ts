import mqtt from "mqtt";

let client: mqtt.MqttClient | null = null;

const getClient = async (): Promise<mqtt.MqttClient> => {
  if (client && client.connected) return client;
  
  if (!client) {
    client = mqtt.connect("mqtt://localhost:1883");
    client.on("error", (err) => console.error("MQTT Error:", err));
  }

  if (client.connected) return client;

  return new Promise((resolve) => {
    client!.once("connect", () => {
      console.log("Super Admin connected to MQTT Broker (IoT Simulator)");
      resolve(client!);
    });
  });
};

const publishAsync = async (topic: string, message: any) => {
  try {
    const c = await getClient();
    c.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
      if (err) console.error(`[MQTT] Failed to publish to ${topic}:`, err);
      else console.log(`[MQTT] Published to ${topic}`);
    });
  } catch (err) {
    console.error("[MQTT] Publisher error:", err);
  }
};

export const publishFeatureUpdate = async (tenantId: string, features: any) => {
  await publishAsync(`tenant/${tenantId}/features`, features);
};

export const publishMcpUpdate = async (tenantId: string, mcpConfig: any) => {
  await publishAsync(`tenant/${tenantId}/mcp`, mcpConfig);
};

export const publishUserSync = async (tenantId: string, userData: any) => {
  await publishAsync(`tenant/${tenantId}/users/create`, userData);
};

export const publishTenantSync = async (tenantId: string, tenantData: any) => {
  await publishAsync(`tenant/${tenantId}/info`, tenantData);
};
