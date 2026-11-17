"use client";

import { useEffect } from "react";
import { useStylist } from "./StylistProvider";

export function DemoLaunch() {
  const { openStylist } = useStylist();
  useEffect(() => { openStylist(); }, [openStylist]);
  return null;
}
