import { ProfileFormData } from "./types";
import { api } from "@/lib/api";

export const updateTenantProfile = async (id: string, data: ProfileFormData) => {
  const res = await api.updateTenantProfile({ id, ...data });
  if (res.error) {
    throw new Error(res.error);
  }
  return res.data;
};
