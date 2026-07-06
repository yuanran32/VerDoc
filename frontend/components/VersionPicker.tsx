export type FrameworkOption = {
  id: string;
  name: string;
  versions: string[];
};

type VersionPickerProps = {
  disabled?: boolean;
  frameworks: FrameworkOption[];
  framework: string;
  onFrameworkChange: (framework: string) => void;
  onVersionChange: (version: string) => void;
  version: string;
};

export function VersionPicker({
  disabled = false,
  frameworks,
  framework,
  onFrameworkChange,
  onVersionChange,
  version
}: VersionPickerProps) {
  const safeFrameworks =
    frameworks.length > 0 ? frameworks : [{ id: "vue", name: "Vue", versions: ["3.4"] }];
  const selectedFramework =
    safeFrameworks.find((item) => item.id === framework) ?? safeFrameworks[0];

  function handleFrameworkChange(nextFramework: string) {
    const nextOption =
      safeFrameworks.find((item) => item.id === nextFramework) ?? safeFrameworks[0];

    onFrameworkChange(nextOption.id);
    if (!nextOption.versions.includes(version)) {
      onVersionChange(nextOption.versions[0]);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5 rounded-lg border p-0.5"
        style={{
          background: "var(--bg-subtle)",
          borderColor: "var(--border-base)"
        }}
        role="group"
        aria-label="选择框架"
      >
        {safeFrameworks.map((option) => {
          const isActive = option.id === selectedFramework.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => handleFrameworkChange(option.id)}
              className="focus-ring rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: isActive ? "var(--bg-elev)" : "transparent",
                boxShadow: isActive
                  ? "0 1px 2px color-mix(in srgb, var(--text-primary) 8%, transparent)"
                  : "none",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)"
              }}
            >
              {option.name}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <select
          aria-label="选择版本"
          disabled={disabled}
          onChange={(event) => onVersionChange(event.target.value)}
          value={version}
          className="focus-ring cursor-pointer appearance-none rounded-lg border py-1 pl-2.5 pr-7 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--bg-subtle)",
            borderColor: "var(--border-base)",
            color: "var(--text-primary)"
          }}
        >
          {selectedFramework.versions.map((option) => (
            <option key={option} value={option}>
              v{option}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2"
          style={{ fill: "var(--text-muted)" }}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
