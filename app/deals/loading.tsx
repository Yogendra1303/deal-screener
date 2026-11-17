export default function DealsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-md bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-md bg-slate-200" />
          <div className="h-9 w-28 rounded-md bg-slate-200" />
        </div>
      </div>
      <div className="h-32 rounded-xl bg-white border border-slate-200/80" />
      <div className="h-24 rounded-xl bg-white border border-slate-200/80" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-white border border-slate-200/70" />
        ))}
      </div>
    </div>
  );
}
