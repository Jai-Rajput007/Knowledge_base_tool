import { useState, useEffect, useCallback } from 'react';
import { api, API_BASE_URL } from '@/lib/api';

export interface Gesture {
  id: string;
  name: string;
  sample_count: number;
  duration_s: number;
  created_at: string;
  created_by?: number | null;
}

const API = API_BASE_URL;

// One robot per tenant — the backend always talks to its own configured AGX
// (settings.ROBOT_SYNC_HOST) for robot_sync, and robot_sync always talks to
// the G1's known DDS-subnet IP (192.168.123.164) for liveness. Neither is
// user-configurable from this page; there is nothing to reconnect to.
export function useGestures() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  // isHealthy only confirms robot_sync (on the AGX Thor) is reachable — it says
  // nothing about the G1 itself being powered on. robotStatus is sourced from
  // /robot/status, which pings the G1's own IP (192.168.123.164) from the Thor,
  // so a powered-off robot reads "offline" here even while robot_sync is fine.
  const [robotStatus, setRobotStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [gestures, setGestures] = useState<Gesture[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [loading, setLoading] = useState(false);
  // Surfaced as an inline banner in the UI, not a native browser alert().
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setIsHealthy(res.ok);
    } catch {
      setIsHealthy(false);
    }
  }, []);

  const checkRobotStatus = useCallback(async () => {
    try {
      const token = api.getToken();
      const res = await fetch(`${API}/robot/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setRobotStatus(data?.robot?.status ?? 'unknown');
      } else {
        setRobotStatus('unknown');
      }
    } catch {
      setRobotStatus('unknown');
    }
  }, []);

  const fetchGestures = useCallback(async () => {
    setLoading(true);
    try {
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/custom`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setGestures(data.gestures || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    checkRobotStatus();
    fetchGestures();
    const interval = setInterval(() => {
      checkHealth();
      checkRobotStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [checkHealth, checkRobotStatus, fetchGestures]);

  const startRecording = async (name: string) => {
    setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('name', name);
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/custom/record/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData.toString(),
      });
      if (res.ok) {
        setIsRecording(true);
        setRecordingName(name);
      } else if (res.status === 409) {
        setError(`A gesture named '${name}' already exists. Choose a different name.`);
      } else {
        const detail = await res.json().catch(() => null);
        setError(detail?.detail || 'Robot rejected the recording request. Is it in compliant mode?');
      }
    } catch (e) {
      console.error('Failed to start recording', e);
      setError('Failed to connect to backend API');
    }
  };

  const stopRecording = async () => {
    setError(null);
    try {
      const token = api.getToken();
      const formData = new URLSearchParams();
      formData.append('name', recordingName);
      const res = await fetch(`${API}/gestures/custom/record/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData.toString(),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setError(detail?.detail || 'Failed to save the recording — 0 samples captured?');
      }
      setIsRecording(false);
      setRecordingName('');
      setTimeout(fetchGestures, 500);
    } catch (e) {
      console.error('Failed to stop recording', e);
      setError('Failed to connect to backend API');
    }
  };

  const playGesture = async (name: string) => {
    try {
      const token = api.getToken();
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}/play`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (e) {
      console.error('Failed to play gesture', e);
    }
  };

  const deleteGesture = async (name: string) => {
    if (!confirm(`Delete gesture '${name}'? This cannot be undone.`)) return;
    try {
      const token = api.getToken();
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchGestures();
    } catch (e) {
      console.error('Failed to delete gesture', e);
    }
  };

  return {
    isHealthy,
    robotStatus,
    gestures,
    isRecording,
    recordingName,
    loading,
    error,
    clearError: () => setError(null),
    startRecording,
    stopRecording,
    playGesture,
    deleteGesture,
    refresh: fetchGestures,
  };
}
