export interface ProfileFormData {
  name: string;
  host: string;
  hostEmail: string;
  companyDescription: string;
  companyType: string;
  companyLogo: string;
}

export interface ProfileFeatureProps {
  tenant: any; // Ideally we use a strict Tenant type, but we pass raw Prisma Tenant for now
}
