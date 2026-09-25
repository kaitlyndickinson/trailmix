import { cardClass } from "@/components/ui";
import { JoinForm } from "../../crew/join-form";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;

  return (
    <div className={`${cardClass} mt-6 flex flex-col gap-4`}>
      <div>
        <h1 className="text-xl font-semibold">You&apos;re invited</h1>
        <p className="text-foreground/70 mt-1">
          Join the crew to share trips and checklists.
        </p>
      </div>
      <JoinForm initialCode={decodeURIComponent(code)} prominent />
    </div>
  );
}
