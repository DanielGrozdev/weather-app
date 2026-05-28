import type { CSSProperties } from "react";
import UpArrow from "/src/assets/uparrow.svg?react";
import { windToDeg } from "../lib/windGrid";

type Props = {
  fromDeg: number;
  className?: string;
  style?: CSSProperties;
};

export function WindArrow({ fromDeg, className, style }: Props) {
  return (
    <UpArrow
      className={className}
      style={{ ...style, transform: `rotate(${windToDeg(fromDeg)}deg)` }}
    />
  );
}
