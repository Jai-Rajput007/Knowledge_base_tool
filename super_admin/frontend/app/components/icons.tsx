import { Server, Users, Settings, Database, Code, Globe, Shield, Cpu } from "lucide-react";

export function getIcon(name: string, className?: string) {
  const icons: Record<string, React.ElementType> = {
    tenants: Users,
    server: Server,
    settings: Settings,
    database: Database,
    code: Code,
    globe: Globe,
    shield: Shield,
    cpu: Cpu,
  };
  
  const Icon = icons[name] || Server;
  return <Icon className={className} />;
}
