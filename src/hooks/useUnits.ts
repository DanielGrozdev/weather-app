import { useContext } from "react";
import { UnitsContext } from "../context/UnitsContext";

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used inside <UnitsProvider>");
  return ctx;
}
