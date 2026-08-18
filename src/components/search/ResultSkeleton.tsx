interface ResultSkeletonProps {
  count: number;
}

export function ResultSkeleton({ count }: ResultSkeletonProps) {
  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 py-5">
          <div className="h-3 w-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
