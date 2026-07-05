const frameworks = ["vue", "vite", "pinia", "vue-router"];
const versions = ["3.4", "3.3", "3.2"];

export function VersionPicker() {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        框架
        <select className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-950">
          {frameworks.map((framework) => (
            <option key={framework} value={framework}>
              {framework}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        版本
        <select className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-950">
          {versions.map((version) => (
            <option key={version} value={version}>
              {version}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
