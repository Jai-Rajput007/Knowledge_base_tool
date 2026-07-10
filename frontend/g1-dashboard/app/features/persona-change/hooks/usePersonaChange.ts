import { useState, useEffect } from "react";
import { usePersonaContext } from "../../persona/context";
import { SaveResult } from "../types";
import { api } from "@/lib/api";

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
        console.log("[usePersonaChange] Loading existing persona into role builder:", roleBuilderPersona.id);
        
        let parsedRules: string[] = [];
        if (Array.isArray(roleBuilderPersona.conversationRules)) {
          parsedRules = roleBuilderPersona.conversationRules;
        } else if (typeof roleBuilderPersona.conversationRules === 'string') {
          try {
            parsedRules = JSON.parse(roleBuilderPersona.conversationRules);
            if (!Array.isArray(parsedRules)) parsedRules = [];
          } catch (e) {
            console.error("[usePersonaChange] Failed to parse conversation rules string:", e);
          }
        }

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
          conversation_rules: parsedRules
        });
      } else {
        console.log("[usePersonaChange] Initializing new persona for role builder");
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
    console.log("[usePersonaChange] Attempting to save persona:", editForm.name);
    setSaving(true);
    setSaveResult(null);
    try {
      const payload = {
        name: editForm.name,
        robotName: editForm.identity.name,
        robotCompany: editForm.identity.company,
        robotLocation: editForm.identity.location,
        robotRole: editForm.identity.role,
        robotVoice: editForm.identity.voice,
        wakeWord: editForm.wakeWord,
        systemPrompt: editForm.system_prompt,
        conversationRules: JSON.stringify(editForm.conversation_rules)
      };

      let res;
      if (editForm.id) {
        console.log(`[usePersonaChange] Sending PUT request via API client with payload:`, payload);
        res = await api.updatePersona(editForm.id, payload);
      } else {
        console.log(`[usePersonaChange] Sending POST request via API client with payload:`, payload);
        res = await api.createPersona(payload);
      }
      
      console.log(`[usePersonaChange] Save response:`, res);
      
      if (res.error) {
        setSaveResult({
          success: false,
          robot_synced: false,
          message: res.error,
        });
      } else {
        const data = (res.data as any) || {};
        setSaveResult({
          success: data.success !== false,
          robot_synced: data.robot_synced ?? false,
          message: data.message ?? "Saved",
          version: data.version,
        });
        
        await fetchPersonas();
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
