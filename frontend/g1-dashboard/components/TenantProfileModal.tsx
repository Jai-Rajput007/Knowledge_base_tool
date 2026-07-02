"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TenantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: any;
}

export function TenantProfileModal({ isOpen, onClose, tenant }: TenantProfileModalProps) {
  const name = tenant?.name || "G1 Universe";
  const initial = name.substring(0, 2).toUpperCase();
  const host = tenant?.host || "Not Assigned";
  const description = tenant?.companyDescription || "No description provided.";
  const type = tenant?.companyType || "Unspecified";
  const logo = tenant?.companyLogo || "";
  
  let featuresObj = {};
  try {
    featuresObj = tenant?.features ? JSON.parse(tenant.features) : {};
  } catch (e) {}
  
  const featureKeys = Object.keys(featuresObj);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl bg-bg-primary p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
          <DialogPrimitive.Title className="text-lg font-semibold text-text-primary mb-2">
            Tenant Profile
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-text-muted mb-6">
            Your workspace details are managed by the super admin.
          </DialogPrimitive.Description>
          
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-24 h-24 border-2 border-border shadow-sm">
                {logo ? <AvatarImage src={logo} className="object-cover" /> : null}
                <AvatarFallback className="bg-bg-secondary text-text-secondary text-2xl font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">{name}</h3>
                <span className="text-xs uppercase tracking-widest text-accent-blue font-semibold">{type}</span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Host / Admin</label>
                <p className="mt-1 text-sm text-text-primary font-medium bg-bg-secondary p-2.5 rounded-lg border border-border/50">
                  {host}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Description</label>
                <p className="mt-1 text-sm text-text-primary bg-bg-secondary p-2.5 rounded-lg border border-border/50 leading-relaxed">
                  {description}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Enabled Features</label>
                {featureKeys.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {featureKeys.map(key => (
                      <span key={key} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium border border-primary/20">
                        {key}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-text-muted italic">No specific features enabled.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
