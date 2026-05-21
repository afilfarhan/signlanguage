import { Metadata } from "next";
import ResearchClient from "./ResearchClient";

export const metadata: Metadata = {
  title: "Research Preview — Continuous SLR",
  robots: "noindex,nofollow",
};

export default function ContinuousResearchPage() {
  return <ResearchClient />;
}
