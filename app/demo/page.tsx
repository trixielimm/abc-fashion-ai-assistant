import { notFound } from "next/navigation";
import { PRESENTATION_MODE } from "@/lib/demo/config";
import { DemoLaunch } from "@/components/stylist/DemoLaunch";
import Home from "../page";

export default function DemoPage() {
  if (!PRESENTATION_MODE) notFound();
  return <><Home /><DemoLaunch /></>;
}
