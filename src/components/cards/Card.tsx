import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  title: string;
  childrenClassName?: string;
  isRefreshing?: boolean;
};

const Card = ({ children, title, childrenClassName, isRefreshing }: Props) => {
  return (
    <div className="p-4 rounded-xl bg-linear-to-br from-card to-card/35 shadow-md flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {isRefreshing ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-sky-400/80 animate-pulse" />
            <span className="hidden sm:inline">Refreshing</span>
          </div>
        ) : null}
      </div>
      <div className={childrenClassName}>{children}</div>
    </div>
  );
};

export default Card;
