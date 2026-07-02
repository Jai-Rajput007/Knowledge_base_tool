import { useState, useEffect } from "react";
import { usePersonaContext } from "../../persona/context";
import { SaveResult } from "../types";

export function usePersonaChange() {
  const { availableWakewords, fetchPersonas, isRoleBuilderOpen, openRoleBuilder, closeRoleBuilder, roleBuilderPersona } = usePersonaContext();
  
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);

  const [editForm, setEditForm] = useState<any>({
    name: "New Custom Persona",
    identity: { name: "", company: "", location: "", role: "", voice: "Male" },
    wakeWord: "hey_jarvis",
    system_prompt: "",
    conversation_rules: []
  });

  useEffect(() => {
    if (isRoleBuilderOpen) {
      if (roleBuilderPersona) {
        setEditForm({
          id: roleBuilderPersona.id,
          name: roleBuilderPersona.name || "",
          identity: {
            name: roleBuilderPersona.robotName || "",
            company: roleBuilderPersona.robotCompany || "",
            location: roleBuilderPersona.robotLocation || "",
            role: roleBuilderPersona.robotRole || "",
            voice: roleBuilderPersona.robotVoice || "Male"
          },
          wakeWord: roleBuilderPersona.wakeWord || "hey_jarvis",
          system_prompt: roleBuilderPersona.systemPrompt || "",
          conversation_rules: roleBuilderPersona.conversationRules || []
        });
      } else {
        setEditForm({
          name: "New Custom Persona",
          identity: { name: "", company: "", location: "", role: "", voice: "Male" },
          wakeWord: "hey_jarvis",
          system_prompt: "",
          conversation_rules: []
        });
      }
      setSaveResult(null);
      setUnsaved(false);
    }
  }, [isRoleBuilderOpen, roleBuilderPersona]);

  const markUnsaved = () => { setUnsaved(true); setSaveResult(null); };

  const updateIdentity = (field: string, value: string) => {
    setEditForm({
      ...editForm,
      identity: { ...editForm.identity, [field]: value },
    });
    markUnsaved();
  };

  const updateRule = (index: number, value: string) => {
    const newRules = [...editForm.conversation_rules];
    newRules[index] = value;
    setEditForm({ ...editForm, conversation_rules: newRules });
    markUnsaved();
  };

  const addRule = () => {
    setEditForm({
      ...editForm,
      conversation_rules: [...editForm.conversation_rules, ""],
    });
    markUnsaved();
  };

  const removeRule = (index: number) => {
    const newRules = [...editForm.conversation_rules];
    newRules.splice(index, 1);
    setEditForm({ ...editForm, conversation_rules: newRules });
    markUnsaved();
  };

  const handleCreateOrUpdate = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const method = editForm.id ? "PUT" : "POST";
      const url = editForm.id ? `/api/personas/${editForm.id}` : "/api/personas";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      
      setSaveResult({
        success:      res.ok && (data.success !== false),
        robot_synced: data.robot_synced ?? false,
        message:      data.message ?? (res.ok ? "Saved" : data.error ?? "Save failed"),
        version:      data.version,
      });
      
      await fetchPersonas();
      if (res.ok) {
        setUnsaved(false);
        closeRoleBuilder();
      }
    } catch (e) {
      setSaveResult({ success: false, robot_synced: false, message: "Network error" });
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return {
    availableWakewords, isRoleBuilderOpen, openRoleBuilder, closeRoleBuilder,
    saving, unsaved, saveResult, editForm, setEditForm, markUnsaved,
    updateIdentity, updateRule, addRule, removeRule, handleCreateOrUpdate
  };
}
