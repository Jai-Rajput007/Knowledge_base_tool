import { AuthGuard } from "@/app/components/auth-guard";
import { VoiceStudioModule } from "@/app/features/voice-studio";

export default function VoiceStudioPage() {
  return (
    <AuthGuard>
      <VoiceStudioModule />
    </AuthGuard>
  );
}
