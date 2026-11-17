export default function FundLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/60" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-slate-200/60" />
        <div className="h-56 animate-pulse rounded-xl bg-slate-200/60" />
      </div>
    </div>
  );
}
