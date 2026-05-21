"use client";

import { useEffect } from "react";
import { installPrivacyGate, setLeakCallback } from "@/lib/privacyGate";

export default function PrivacyGateWrapper() {
  useEffect(() => {
    installPrivacyGate();
    setLeakCallback((reason) => {
      console.error("Privacy gate triggered:", reason);
    });
  }, []);

  // This component has no visual presence — it just installs interceptors.
  return null;
}
