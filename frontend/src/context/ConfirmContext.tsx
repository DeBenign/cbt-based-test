import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (message: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  function handleChoice(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 22, 31, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: "var(--surface-1)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              padding: 24,
              maxWidth: 360,
              width: "90%"
            }}
          >
            <p style={{ marginBottom: 20 }}>{state.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => handleChoice(false)}>Cancel</button>
              <button
                type="button"
                onClick={() => handleChoice(true)}
                style={{ background: "var(--bg-danger)", color: "var(--text-danger)", borderColor: "var(--bg-danger)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}