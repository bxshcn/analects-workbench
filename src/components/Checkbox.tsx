export function Checkbox({
  checked,
  onChange,
  label,
  color,
  disabled,
  variant = "checkbox",
  name,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
  variant?: "checkbox" | "radio";
  name?: string;
}) {
  const isRadio = variant === "radio";
  return (
    <label
      className={`flex min-h-[38px] cursor-pointer select-none items-center gap-2.5 rounded px-1.5 text-xs transition-colors max-sm:min-h-[44px] ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-ink/[0.04]"
      }`}
    >
      <input
        type={isRadio ? "radio" : "checkbox"}
        name={name}
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span
        aria-hidden
        className={`grid h-[15px] w-[15px] place-items-center border transition-colors ${
          isRadio ? "rounded-full" : "rounded-[3px]"
        } ${
          checked ? "border-vermilion bg-vermilion text-paper" : "border-ink/30 bg-paper"
        }`}
      >
        {checked ? (
          isRadio ? (
            <span className="h-1.5 w-1.5 rounded-full bg-paper" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
              <path
                d="M2 6.2 4.6 8.8 10 3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )
        ) : null}
      </span>
      {color ? (
        <span
          className="stat-dot"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}
      <span className="text-ink-soft peer-focus-visible:text-ink">{label}</span>
    </label>
  );
}
