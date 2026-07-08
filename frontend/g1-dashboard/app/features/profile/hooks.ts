import { useState, useEffect } from "react";
import { ProfileFormData } from "./types";
import { updateTenantProfile } from "./api";
import { useRouter } from "next/navigation";

export const useProfileState = (tenant: any) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    host: "",
    hostEmail: "",
    companyDescription: "",
    companyType: "",
    companyLogo: "",
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        host: tenant.host || "",
        hostEmail: tenant.hostEmail || "",
        companyDescription: tenant.companyDescription || "",
        companyType: tenant.companyType || "",
        companyLogo: tenant.companyLogo || "",
      });
    }
  }, [tenant]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateTenantProfile(tenant.id, formData);
      setIsEditing(false);
      router.refresh(); // Refresh to get the new data in server components
    } catch (e) {
      console.error(e);
      alert("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        host: tenant.host || "",
        hostEmail: tenant.hostEmail || "",
        companyDescription: tenant.companyDescription || "",
        companyType: tenant.companyType || "",
        companyLogo: tenant.companyLogo || "",
      });
    }
  };

  return {
    isEditing,
    setIsEditing,
    isSaving,
    formData,
    setFormData,
    handleSave,
    handleCancel
  };
};
