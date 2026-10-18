export default function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
        verticalAlign: "middle",
        marginRight: 8
      }}
    />
  );
}