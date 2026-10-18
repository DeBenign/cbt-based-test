import { ButtonHTMLAttributes } from "react";

export default function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { style, ...rest } = props;
  return (
    <button
      {...rest}
      style={{
        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
        color: "var(--on-accent)",
        borderColor: "transparent",
        boxShadow: "var(--shadow-sm)",
        ...style
      }}
    />
  );
}