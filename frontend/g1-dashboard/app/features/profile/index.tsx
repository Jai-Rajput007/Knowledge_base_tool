"use client";

import React from "react";
import { ProfileFeatureProps } from "./types";
import { useProfileState } from "./hooks";
import { ProfileForm } from "./components/ProfileForm";

export function ProfileFeature({ tenant }: ProfileFeatureProps) {
  const {
    isEditing,
    setIsEditing,
    isSaving,
    formData,
    setFormData,
    handleSave,
    handleCancel
  } = useProfileState(tenant);

  return (
    <div className="p-8">
      <ProfileForm 
        tenant={tenant}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isSaving={isSaving}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
