export default function TrafficLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-md bg-slate-200" />
      <div className="h-48 rounded-2xl bg-slate-900/90" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-white border border-slate-200/80" />
        ))}
      </div>
    </div>
  );
}
