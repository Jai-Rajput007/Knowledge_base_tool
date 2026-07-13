import { useState, useEffect, useCallback } from 'react';
import { api, API_BASE_URL } from '@/lib/api';

export interface Gesture {
  name: string;
  samples: number;
  duration_s: string;
  modified: string;
}

const API = API_BASE_URL;

export function useGestures() {
  const [robotIp, setRobotIp] = useState('192.168.123.222');
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [gestures, setGestures] = useState<Gesture[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gestureTesterRobotIp');
    if (saved) setRobotIp(saved);
  }, []);

  const updateRobotIp = (ip: string) => {
    const cleanIp = ip.trim();
    setRobotIp(cleanIp);
    localStorage.setItem('gestureTesterRobotIp', cleanIp);
  };

  const getQuery = () => `?robot_ip=${encodeURIComponent(robotIp)}`;

  const checkHealth = useCallback(async () => {
    try {
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/health${getQuery()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setIsHealthy(true);
      } else {
        setIsHealthy(false);
      }
    } catch {
      setIsHealthy(false);
    }
  }, [robotIp]);

  const fetchGestures = useCallback(async () => {
    setLoading(true);
    try {
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/custom${getQuery()}`, {
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
  }, [robotIp]);

  useEffect(() => {
    checkHealth();
    fetchGestures();
    const interval = setInterval(() => {
      checkHealth();
    }, 10000); 
    return () => clearInterval(interval);
  }, [checkHealth, fetchGestures]);

  const startRecording = async (name: string) => {
    try {
      const formData = new URLSearchParams();
      formData.append('name', name);
      const token = api.getToken();
      const res = await fetch(`${API}/gestures/custom/record/start${getQuery()}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData.toString(),
      });
      if (res.ok) {
        setIsRecording(true);
        setRecordingName(name);
      } else {
        alert('Robot rejected the recording request. Is it in compliant mode?');
      }
    } catch (e) {
      console.error('Failed to start recording', e);
      alert('Failed to connect to backend API');
    }
  };

  const stopRecording = async () => {
    try {
      const token = api.getToken();
      await fetch(`${API}/gestures/custom/record/stop${getQuery()}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setIsRecording(false);
      setRecordingName('');
      setTimeout(fetchGestures, 500);
    } catch (e) {
      console.error('Failed to stop recording', e);
    }
  };

  const playGesture = async (name: string) => {
    try {
      const token = api.getToken();
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}/play${getQuery()}`, {
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
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}${getQuery()}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      fetchGestures();
    } catch (e) {
      console.error('Failed to delete gesture', e);
    }
  };

  return {
    robotIp,
    updateRobotIp,
    isHealthy,
    gestures,
    isRecording,
    recordingName,
    loading,
    startRecording,
    stopRecording,
    playGesture,
    deleteGesture,
    checkHealth,
    refresh: fetchGestures
  };
}
