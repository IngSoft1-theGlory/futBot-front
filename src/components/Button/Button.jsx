import "./Button.css";

function Button({
  variant = "primary",
  isLoading = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...props
}) {
  const isDisabled = disabled || isLoading;

  const classes = [
    "btn",
    `btn--${variant}`,
    isLoading && "btn--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
    >
      <span className="btn__label">{children}</span>
      {isLoading && <span className="btn__spinner" aria-hidden="true" />}
    </button>
  );
}

export default Button;