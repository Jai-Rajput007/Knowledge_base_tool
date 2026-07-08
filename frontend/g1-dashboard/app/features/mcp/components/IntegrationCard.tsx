import React from "react";
import { Integration } from "../types";
import { 
  Puzzle, Crown, CheckCircle2, X, CreditCard, Cloud, FileText, Briefcase, Search, MessageSquare, Sun, Coins, ScanFace, User, HardHat, Navigation, Battery, Camera, Activity, Clock, Newspaper
} from "lucide-react";
import { 
  SiJira, SiGithub, SiGitlab, SiHubspot, 
  SiSap, SiAsana, SiTrello, SiAirtable,
  SiGooglecloud, SiQuickbooks, SiStripe, SiShopify, 
  SiWoocommerce, SiZoom, SiTelegram, SiNotion, SiConfluence, 
  SiWikipedia, SiDiscord, SiGooglecalendar, SiGoogledrive, 
  SiGoogledocs, SiBrave, SiDuckduckgo, SiGooglemaps
} from "@icons-pack/react-simple-icons";

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string, currentStatus: boolean) => void;
  onConfigure: (id: string) => void;
}

const AnimatedButton = ({ onClick, text, isPro }: { onClick: () => void, text: string, isPro?: boolean }) => {
  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`group flex justify-center items-center px-3 gap-2 h-[36px] w-full max-w-[140px] mx-auto border-none rounded-[20px] cursor-pointer transition-colors ${
        isPro ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-600' : 'bg-[#5e41de33] hover:bg-[#5e41de4d] text-[#5D41DE]'
      }`}
    >
      {isPro ? (
        <CreditCard className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width={18} viewBox="0 0 20 20" height={18} fill="none" className="group-hover:animate-[spin_2s_linear_infinite]">
          <g strokeWidth="1.5" strokeLinecap="round" stroke="currentColor">
            <circle r="2.5" cy={10} cx={10} />
            <path fillRule="evenodd" d="m8.39079 2.80235c.53842-1.51424 2.67991-1.51424 3.21831-.00001.3392.95358 1.4284 1.40477 2.3425.97027 1.4514-.68995 2.9657.82427 2.2758 2.27575-.4345.91407.0166 2.00334.9702 2.34248 1.5143.53842 1.5143 2.67996 0 3.21836-.9536.3391-1.4047 1.4284-.9702 2.3425.6899 1.4514-.8244 2.9656-2.2758 2.2757-.9141-.4345-2.0033.0167-2.3425.9703-.5384 1.5142-2.67989 1.5142-3.21831 0-.33914-.9536-1.4284-1.4048-2.34247-.9703-1.45148.6899-2.96571-.8243-2.27575-2.2757.43449-.9141-.01669-2.0034-.97028-2.3425-1.51422-.5384-1.51422-2.67994.00001-3.21836.95358-.33914 1.40476-1.42841.97027-2.34248-.68996-1.45148.82427-2.9657 2.27575-2.27575.91407.4345 2.00333-.01669 2.34247-.97026z" clipRule="evenodd" />
          </g>
        </svg>
      )}
      <span className="leading-5 text-[13px] font-sans tracking-[1px] whitespace-nowrap">{text}</span>
    </button>
  );
};

export function IntegrationCard({ integration, onToggle, onConfigure }: IntegrationCardProps) {
  const getBrandIcon = (name: string, isEnabled: boolean) => {
    const iconClass = `w-12 h-12 transition-all ${isEnabled ? 'opacity-100 scale-105' : 'opacity-80 group-hover:opacity-100 group-hover:scale-110'}`;
    const n = name.toLowerCase();
    
    if (n.includes('slack')) return <MessageSquare className={iconClass} style={{ color: '#4A154B' }} />;
    if (n.includes('salesforce')) return <Cloud className={iconClass} style={{ color: '#00A1E0' }} />;
    if (n.includes('oracle')) return <Briefcase className={iconClass} style={{ color: '#C74634' }} />;
    if (n.includes('azure')) return <Cloud className={iconClass} style={{ color: '#0078D4' }} />;
    if (n.includes('sharepoint')) return <FileText className={iconClass} style={{ color: '#0078D4' }} />;
    if (n.includes('google workspace')) return <Cloud className={iconClass} style={{ color: '#4285F4' }} />;
    if (n.includes('teams')) return <MessageSquare className={iconClass} style={{ color: '#464EB8' }} />;
    if (n.includes('onedrive')) return <Cloud className={iconClass} style={{ color: '#0078D4' }} />;
    if (n.includes('word') || n.includes('excel') || n.includes('microsoft 365')) return <FileText className={iconClass} style={{ color: '#185ABD' }} />;
    if (n.includes('aws') || n.includes('amazon')) return <Cloud className={iconClass} style={{ color: '#FF9900' }} />;

    if (n.includes('weather')) return <Sun className={iconClass} style={{ color: '#EAB308' }} />;
    if (n.includes('currency')) return <Coins className={iconClass} style={{ color: '#22C55E' }} />;
    if (n.includes('face recognition')) return <ScanFace className={iconClass} style={{ color: '#6366F1' }} />;
    if (n.includes('person detection')) return <User className={iconClass} style={{ color: '#3B82F6' }} />;
    if (n.includes('ppe detection')) return <HardHat className={iconClass} style={{ color: '#F97316' }} />;
    if (n.includes('github')) return <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" style={{ color: '#E5E7EB' }}><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>;
    if (n.includes('navigation') || n.includes('ros2')) return <Navigation className={iconClass} style={{ color: '#0EA5E9' }} />;
    if (n.includes('battery')) return <Battery className={iconClass} style={{ color: '#10B981' }} />;
    if (n.includes('camera')) return <Camera className={iconClass} style={{ color: '#D946EF' }} />;
    if (n.includes('diagnostics')) return <Activity className={iconClass} style={{ color: '#EF4444' }} />;
    if (n.includes('timezone')) return <Clock className={iconClass} style={{ color: '#8B5CF6' }} />;
    if (n.includes('news')) return <Newspaper className={iconClass} style={{ color: '#64748B' }} />;
    if (n.includes('search')) return <Search className={iconClass} style={{ color: '#F43F5E' }} />;

    if (n.includes('jira')) return <SiJira className={iconClass} color="default" />;
    if (n.includes('github')) return <SiGithub className={iconClass} color="default" />;
    if (n.includes('gitlab')) return <SiGitlab className={iconClass} color="default" />;
    if (n.includes('hubspot')) return <SiHubspot className={iconClass} color="default" />;
    if (n.includes('sap')) return <SiSap className={iconClass} color="default" />;
    if (n.includes('asana')) return <SiAsana className={iconClass} color="default" />;
    if (n.includes('monday')) return <Puzzle className={iconClass} />;
    if (n.includes('trello')) return <SiTrello className={iconClass} color="default" />;
    if (n.includes('airtable')) return <SiAirtable className={iconClass} color="default" />;
    if (n.includes('google cloud')) return <SiGooglecloud className={iconClass} color="default" />;
    if (n.includes('quickbooks')) return <SiQuickbooks className={iconClass} color="default" />;
    if (n.includes('stripe')) return <SiStripe className={iconClass} color="default" />;
    if (n.includes('shopify')) return <SiShopify className={iconClass} color="default" />;
    if (n.includes('woocommerce')) return <SiWoocommerce className={iconClass} color="default" />;
    if (n.includes('zoom')) return <SiZoom className={iconClass} color="default" />;
    if (n.includes('telegram')) return <SiTelegram className={iconClass} color="default" />;
    if (n.includes('notion')) return <SiNotion className={iconClass} color="default" />;
    if (n.includes('confluence')) return <SiConfluence className={iconClass} color="default" />;
    if (n.includes('wikipedia')) return <SiWikipedia className={iconClass} color="default" />;
    if (n.includes('discord')) return <SiDiscord className={iconClass} color="default" />;
    if (n.includes('google calendar')) return <SiGooglecalendar className={iconClass} color="default" />;
    if (n.includes('google drive')) return <SiGoogledrive className={iconClass} color="default" />;
    if (n.includes('docs') || n.includes('sheets')) return <SiGoogledocs className={iconClass} color="default" />;
    if (n.includes('brave')) return <SiBrave className={iconClass} color="default" />;
    if (n.includes('duckduckgo')) return <SiDuckduckgo className={iconClass} color="default" />;
    if (n.includes('maps')) return <SiGooglemaps className={iconClass} color="default" />;

    return <Puzzle className={iconClass} />;
  };

  const isPro = integration.tier === "PRO" || false;
  // In the DB tier isn't natively "PRO", assuming mapping or falling back
  // Wait, Integration type might not have tier and isUnlocked in our new types.ts.
  // We'll fall back gracefully or assume it from the object if it exists.
  const tier = (integration as any).tier || "BASIC";
  const isUnlocked = (integration as any).isUnlocked ?? true;

  return (
    <div 
      className={`mcp-card relative group flex flex-col justify-between aspect-square rounded-[2rem] border ${
        integration.is_active 
          ? 'border-primary/50 bg-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.16)]' 
          : 'border-border bg-card/40 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-primary/30 hover:bg-background'
      } p-5 transition-all duration-300 hover:-translate-y-1`}
    >
      {/* Corner gradient flair */}
      <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
      </div>

      {/* Top Row: Crown (Left) and Name (Right) */}
      <div className="flex justify-between items-start z-10">
        <div>
          {tier === "PRO" && (
            <div className="group/crown relative inline-flex items-center justify-center p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-help">
              <Crown className="w-4 h-4" />
              {/* Tooltip */}
              <div className="absolute bottom-full left-0 mb-2 whitespace-nowrap bg-transparent text-amber-500 font-medium px-2 py-1 text-xs tracking-wide opacity-0 group-hover/crown:opacity-100 transition-opacity pointer-events-none z-50 drop-shadow-sm backdrop-blur-[2px] rounded-md">
                Contact admin for buying this mcp
              </div>
            </div>
          )}
          {tier === "BASIC" && (
            <span className="text-[9px] uppercase tracking-widest font-mono bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full border border-blue-500/20">
              BASIC
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-foreground text-right leading-tight max-w-[60%]">
          {integration.name}
        </h3>
      </div>

      {/* Center: Large Brand Icon */}
      <div className="flex-1 flex items-center justify-center z-10 py-2">
        <div className="relative">
          {getBrandIcon(integration.name, integration.is_active)}
          {integration.is_active && (
            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 shadow-md">
              <CheckCircle2 className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Description & Action */}
      <div className="mt-auto z-10 flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 text-center opacity-85 group-hover:opacity-100 transition-opacity">
          {integration.description || `Connect your agent to ${integration.name} for extended capabilities.`}
        </p>

        <div className="mt-1">
          {(!isUnlocked && tier === "PRO") ? (
            <AnimatedButton onClick={() => onConfigure(integration.id)} text="Buy MCP" isPro={true} />
          ) : (
            <div className="flex gap-2">
              <AnimatedButton onClick={() => onConfigure(integration.id)} text="Configure" />
              
              {/* Small Toggle Off Button if enabled */}
              {integration.is_active && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(integration.id, integration.is_active); }}
                  className="w-[36px] h-[36px] flex-shrink-0 flex items-center justify-center rounded-[20px] bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                  title="Disable"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
