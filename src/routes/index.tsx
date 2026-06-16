import { createFileRoute } from "@tanstack/react-router";
import DoneHoApp from "@/components/DoneHoApp";
import { Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DoneHo — Better Days for the Best" },
      { name: "description", content: "Your day, synchronized. Steampunk productivity for resilient weeks." },
      { property: "og:title", content: "DoneHo" },
      { property: "og:description", content: "Your day, synchronized." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <DoneHoApp />
      <Toaster position="bottom-center" toastOptions={{ style: { background: "#2d4a1e", color: "#e8d5b0", border: "2px solid #b87333" } }} />
    </>
  );
}
