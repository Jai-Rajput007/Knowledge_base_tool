"use client";

import React from "react";
import { Floating3DCard } from "@/app/components/ui/3d-card";
import { FeatureGate } from "@/app/components/feature-gate";
import { usePersonaChange } from "./hooks/usePersonaChange";
import { RoleBuilderModal } from "./components/RoleBuilderModal";

export function PersonaChangeModule() {
  const {
    availableWakewords, isRoleBuilderOpen, openRoleBuilder, closeRoleBuilder,
    saving, editForm, setEditForm, markUnsaved,
    updateIdentity, updateRule, addRule, removeRule, handleCreateOrUpdate
  } = usePersonaChange();

  return (
    <>
      <FeatureGate featureKey="personaChange">
        <Floating3DCard
          title="Role Builder"
          description="Manually configure the robot's Identity, Master Instructions, and Conversation Rules. Create custom roles for any use case."
          imageSrc="https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=800&q=80"
          buttonText="Build Custom →"
          onButtonClick={() => openRoleBuilder(null)}
        />
      </FeatureGate>

      <RoleBuilderModal
        isRoleBuilderOpen={isRoleBuilderOpen}
        closeRoleBuilder={closeRoleBuilder}
        editForm={editForm}
        setEditForm={setEditForm}
        markUnsaved={markUnsaved}
        updateIdentity={updateIdentity}
        updateRule={updateRule}
        addRule={addRule}
        removeRule={removeRule}
        handleCreateOrUpdate={handleCreateOrUpdate}
        saving={saving}
        availableWakewords={availableWakewords}
      />
    </>
  );
}
