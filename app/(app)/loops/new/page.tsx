// New recording page — title input + recorder.
import { PageHeader } from "@/components/ui/PageHeader";
import { LoopRecorder } from "@/components/loops/LoopRecorder";
import { NewLoopForm } from "@/components/loops/NewLoopForm";

export default function NewLoopPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <PageHeader
        title="New Loop"
        subtitle="Record your screen + mic. Captures cursor automatically."
      />
      <NewLoopForm />
    </main>
  );
}
