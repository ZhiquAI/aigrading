import React from "react";
import { HeroUIProvider } from "@heroui/react";

interface HeroUIRootProviderProps {
  children: React.ReactNode;
}

export const HeroUIRootProvider: React.FC<HeroUIRootProviderProps> = ({ children }) => {
  return <HeroUIProvider>{children}</HeroUIProvider>;
};
