export function Summary({ icon: Icon, title, value, detail, tone = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return (
    <div className="group flex min-w-0 items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${colors[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <p className="mt-1 text-xl font-black tabular-nums text-slate-900">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  )
}
