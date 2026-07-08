import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { ProfileFormData } from "../types";
import { motion } from "motion/react";

interface ProfileFormProps {
  tenant: any;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  isSaving: boolean;
  formData: ProfileFormData;
  setFormData: (data: ProfileFormData) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileForm({ 
  tenant, 
  isEditing, 
  setIsEditing, 
  isSaving, 
  formData, 
  setFormData, 
  onSave, 
  onCancel 
}: ProfileFormProps) {
  
  const name = isEditing ? formData.name : (tenant?.name || "G1 Universe");
  const initial = name.substring(0, 2).toUpperCase();
  const host = isEditing ? formData.host : (tenant?.host || "Not Assigned");
  const hostEmail = isEditing ? formData.hostEmail : (tenant?.hostEmail || "No Email Provided");
  const description = isEditing ? formData.companyDescription : (tenant?.companyDescription || "No description provided.");
  const type = isEditing ? formData.companyType : (tenant?.companyType || "Unspecified");
  const logo = isEditing ? formData.companyLogo : (tenant?.companyLogo || "");

  let featuresObj = {};
  try {
    featuresObj = tenant?.features ? JSON.parse(tenant.features) : {};
  } catch (e) {}
  
  const featureKeys = Object.keys(featuresObj).filter(k => featuresObj[k as keyof typeof featuresObj]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, companyLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tenant Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace and company details.</p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
            <FiEdit2 /> Edit Profile
          </button>
        )}
      </div>

      <motion.div layout className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-8">
        
        {/* Header / Logo section */}
        <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-border">
          <Avatar className="w-32 h-32 border-4 border-background shadow-lg rounded-full">
            {logo ? <AvatarImage src={logo} className="object-cover rounded-full" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-semibold rounded-full">
              {initial}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 w-full text-center md:text-left space-y-3">
            {isEditing ? (
              <div className="space-y-3 max-w-sm mx-auto md:mx-0">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Company Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full text-lg font-bold bg-background p-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Company Type</label>
                  <input 
                    type="text" 
                    value={formData.companyType}
                    onChange={(e) => setFormData({...formData, companyType: e.target.value})}
                    className="w-full text-sm font-medium bg-background p-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 block">Company Logo</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full text-sm bg-background p-1.5 rounded-lg border border-border file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer text-muted-foreground"
                  />
                  {formData.companyLogo && formData.companyLogo.startsWith('data:image') && (
                    <p className="text-[10px] text-primary mt-1 font-medium">New image selected</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-3xl font-bold text-foreground">{name}</h2>
                <span className="inline-block mt-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                  {type}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Details section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Admin Contact (Host)</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={formData.host}
                  onChange={(e) => setFormData({...formData, host: e.target.value})}
                  className="w-full text-sm font-medium bg-background p-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <div className="text-sm text-foreground font-medium bg-secondary/50 p-3 rounded-lg border border-border/50">
                  {host}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Admin Email (Host Mail)</label>
              {isEditing ? (
                <input 
                  type="email" 
                  value={formData.hostEmail}
                  onChange={(e) => setFormData({...formData, hostEmail: e.target.value})}
                  className="w-full text-sm font-medium bg-background p-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <div className="text-sm text-foreground font-medium bg-secondary/50 p-3 rounded-lg border border-border/50">
                  {hostEmail}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Company Description</label>
              {isEditing ? (
                <textarea 
                  value={formData.companyDescription}
                  onChange={(e) => setFormData({...formData, companyDescription: e.target.value})}
                  className="w-full text-sm bg-background p-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px]"
                />
              ) : (
                <div className="text-sm text-foreground bg-secondary/50 p-3 rounded-lg border border-border/50 min-h-[120px] whitespace-pre-wrap">
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features section (Read Only) */}
        {!isEditing && (
          <div className="pt-6 border-t border-border">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 block">Enabled Capabilities</label>
            {featureKeys.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {featureKeys.map(key => (
                  <span key={key} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium border border-primary/20">
                    {key}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No specific features enabled.</p>
            )}
          </div>
        )}

        {/* Edit Actions */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-sm font-bold bg-secondary text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
              disabled={isSaving}
            >
              <FiX /> Cancel
            </button>
            <button 
              type="button" 
              onClick={onSave}
              className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
              disabled={isSaving}
            >
              <FiCheck /> {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
        
      </motion.div>
    </div>
  );
}
