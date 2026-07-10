import { useState, useEffect, useCallback } from 'react';

export interface Gesture {
  name: string;
  samples: number;
  duration_s: string;
  modified: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export function useGestures() {
  const [robotIp, setRobotIp] = useState('192.168.1.50');
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
      const res = await fetch(`${API}/gestures/health${getQuery()}`);
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
      const res = await fetch(`${API}/gestures/custom${getQuery()}`);
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
      const res = await fetch(`${API}/gestures/custom/record/start${getQuery()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      await fetch(`${API}/gestures/custom/record/stop${getQuery()}`, {
        method: 'POST',
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
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}/play${getQuery()}`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('Failed to play gesture', e);
    }
  };

  const deleteGesture = async (name: string) => {
    if (!confirm(`Delete gesture '${name}'? This cannot be undone.`)) return;
    try {
      await fetch(`${API}/gestures/custom/${encodeURIComponent(name)}${getQuery()}`, {
        method: 'DELETE',
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
