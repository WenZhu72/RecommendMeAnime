import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ContainerProps = ComponentPropsWithoutRef<"div">;

export function Container({
  children,
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[80rem] px-5 sm:px-7 lg:px-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
