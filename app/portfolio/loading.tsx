export default function PortfolioLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-24 rounded-xl bg-white border border-slate-200/80" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-white border border-slate-200/80" />
        ))}
      </div>
    </div>
  );
}
