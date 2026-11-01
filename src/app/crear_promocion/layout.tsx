import type { ReactNode } from "react";
import PromotionsLayout from "../promociones/layout";

export default function CreatePromotionLayout({ children }: { children: ReactNode }) {
  return <PromotionsLayout>{children}</PromotionsLayout>;
}
