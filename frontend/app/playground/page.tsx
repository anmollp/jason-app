import { PlaygroundShell } from "@/components/playground/PlaygroundShell";
import { connection } from "next/server";

export default async function PlaygroundPage() {
  await connection();
  return <PlaygroundShell aiEnabled={process.env.AI_ENABLED === "true"} />;
}
