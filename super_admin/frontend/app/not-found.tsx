import { NotFoundGlitch } from "@/app/components/ui/be-ui-404-not-found";

export default function NotFound() {
  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)] items-center justify-center">
      <NotFoundGlitch />
    </div>
  );
}
