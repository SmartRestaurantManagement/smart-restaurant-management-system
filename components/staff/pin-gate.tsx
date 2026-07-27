"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinPad } from "./pin-pad";

export function PinGate() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(value: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect PIN.");
        setPin("");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  function handleChange(value: string) {
    setError("");
    setPin(value);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm px-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-neutral-800">Enter dashboard PIN</h1>
          <p className="text-sm text-neutral-500">Unlock the staff dashboard on this device.</p>
        </div>

        <PinPad
          value={pin}
          onChange={handleChange}
          disabled={loading}
          onEnter={() => {
            if (pin.length >= 4) submit(pin);
          }}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="button"
          disabled={loading || pin.length < 4}
          onClick={() => submit(pin)}
          className="w-full bg-neutral-900 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-40"
        >
          {loading ? "Checking..." : "Unlock"}
        </button>
      </div>
    </div>
  );
}
