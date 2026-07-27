"use client";

import { useEffect } from "react";
import { Delete } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  onEnter?: () => void;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function PinPad({ value, onChange, maxLength = 6, disabled, onEnter }: Props) {
  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "") return;
    if (value.length >= maxLength) return;
    onChange(value + key);
  }

  // Physical keyboard support: digits, Backspace to delete, Enter to submit.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        press("back");
      } else if (e.key === "Enter") {
        e.preventDefault();
        onEnter?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, maxLength, disabled, onEnter]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full border border-neutral-300 ${
              i < value.length ? "bg-neutral-900 border-neutral-900" : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(key)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-200 text-lg font-semibold text-neutral-800 hover:bg-neutral-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {key === "back" ? <Delete className="h-5 w-5" /> : key}
            </button>
          )
        )}
      </div>
    </div>
  );
}
