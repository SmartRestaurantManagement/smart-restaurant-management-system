"use client";

import { useState } from "react";
import { PinPad } from "@/components/staff/pin-pad";

export default function SettingsPage() {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const current = step === "enter" ? pin : confirmPin;
  const setCurrent = step === "enter" ? setPin : setConfirmPin;

  function handleChange(value: string) {
    setError("");
    setSuccess(false);
    setCurrent(value);
  }

  function handleContinue() {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    setError("");
    setStep("confirm");
  }

  function reset() {
    setStep("enter");
    setPin("");
    setConfirmPin("");
    setError("");
  }

  async function handleSubmit() {
    if (confirmPin !== pin) {
      setError("PINs don't match. Try again.");
      setConfirmPin("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update PIN.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      reset();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Settings</h1>
        <p className="text-xs text-neutral-500 mt-1">
          Manage your dashboard PIN for this account.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col items-center gap-6">
        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-neutral-800">
            {step === "enter" ? "Change dashboard PIN" : "Confirm new PIN"}
          </h2>
          <p className="text-xs text-neutral-500">
            {step === "enter"
              ? "Choose a new 4-6 digit PIN."
              : "Enter it once more to confirm."}
          </p>
        </div>

        <PinPad
          value={current}
          onChange={handleChange}
          disabled={loading}
          onEnter={() => {
            if (current.length < 4) return;
            if (step === "enter") handleContinue();
            else void handleSubmit();
          }}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-600 font-medium">PIN updated successfully.</p>
        )}

        <button
          type="button"
          disabled={loading || current.length < 4}
          onClick={step === "enter" ? handleContinue : handleSubmit}
          className="w-full bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {loading ? "Saving..." : step === "enter" ? "Continue" : "Save PIN"}
        </button>

        {step === "confirm" && (
          <button type="button" onClick={reset} className="text-xs text-neutral-400 underline">
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
