import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  const ROBOT_SYNC_URL = process.env.ROBOT_SYNC_URL || 'http://192.168.1.107:9000';
  let models: { filename: string; name: string }[] = [];

  try {
    // Attempt to fetch from live robot
    const res = await fetch(`${ROBOT_SYNC_URL}/wakeword/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        models = data.models.map((m: any) => {
          const baseName = m.filename.replace('.onnx', '');
          // Create a pretty display name, e.g. "hey_jarvis_kag2" -> "Hey Jarvis Kag2"
          const prettyName = baseName.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          return { filename: baseName, name: prettyName };
        });
      }
    }
  } catch (error) {
    console.warn('Robot unreachable to fetch wakewords, falling back to local folder...');
  }

  // If we couldn't fetch from robot, fallback to local directory scan or defaults
  if (models.length === 0) {
    try {
      const localDir = '/home/jai/g1-universe/g1-nlp/models/wakewords';
      if (fs.existsSync(localDir)) {
        const files = fs.readdirSync(localDir);
        models = files
          .filter(f => f.endsWith('.onnx'))
          .map(f => {
            const baseName = f.replace('.onnx', '');
            const prettyName = baseName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            return { filename: baseName, name: prettyName };
          });
      }
    } catch (e) {
      console.warn('Failed to read local wakewords directory:', e);
    }
  }

  // Fallback to absolute defaults if both fail
  if (models.length === 0) {
    models = [
      { filename: 'hey_jarvis', name: 'Hey Jarvis' },
      { filename: 'hey_daksh', name: 'Hey Daksh' }
    ];
  }

  return NextResponse.json({ models });
}
