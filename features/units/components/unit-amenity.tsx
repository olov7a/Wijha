import type { ComponentType, SVGProps } from "react";
import {
  FlameIcon,
  LiftIcon,
  MonitorIcon,
  ShieldIcon,
  SnowflakeIcon,
  WashingMachineIcon,
  WifiIcon,
} from "@/components/ui/icons";
import type { AmenityKey } from "@/lib/sample-data";

export const amenities: Record<AmenityKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  wifi: WifiIcon,
  ac: SnowflakeIcon,
  laundry: WashingMachineIcon,
  gas: FlameIcon,
  elevator: LiftIcon,
  desk: MonitorIcon,
  security: ShieldIcon,
};
