"use client";

import { useCallback, useState } from "react";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

export default function PumpControl() {
  const [water, setWater] = useState<string>("");
  const [nutrients, setNutrients] = useState<string>("");
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [port, setPort] = useState<SerialPort | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const [lastSent, setLastSent] = useState<string>("");
  const [error, setError] = useState<string>("");

  const connect = useCallback(async () => {
    setError("");
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      setError(
        "Web Serial API is not supported in this browser. Use Chrome or Edge."
      );
      return;
    }

    setStatus("connecting");
    try {
      const selected = await navigator.serial.requestPort();
      await selected.open({ baudRate });
      if (!selected.writable) {
        throw new Error("The selected port is not writable.");
      }
      const w = selected.writable.getWriter();
      setPort(selected);
      setWriter(w);
      setStatus("connected");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") {
        setStatus("disconnected");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus("disconnected");
    }
  }, [baudRate]);

  const disconnect = useCallback(async () => {
    try {
      if (writer) {
        await writer.close().catch(() => undefined);
        writer.releaseLock();
      }
      if (port) {
        await port.close().catch(() => undefined);
      }
    } finally {
      setWriter(null);
      setPort(null);
      setStatus("disconnected");
    }
  }, [port, writer]);

  const send = useCallback(async () => {
    if (!port || !writer) {
      setError("Connect to the ESP32 first.");
      return;
    }

    const waterValue = Number(water);
    const nutrientValue = Number(nutrients);

    if (Number.isNaN(waterValue) || waterValue < 0) {
      setError("Water volume must be a non-negative number.");
      return;
    }
    if (Number.isNaN(nutrientValue) || nutrientValue < 0) {
      setError("Nutrients volume must be a non-negative number.");
      return;
    }

    setError("");
    const payload = `${waterValue},${nutrientValue}\n`;

    try {
      await writer.write(new TextEncoder().encode(payload));
      setLastSent(payload.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [port, writer, water, nutrients]);

  const isConnected = status === "connected";

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pump Automation
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Send water and nutrient volumes to your ESP32 over USB.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="water"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Water volume (ml)
          </label>
          <input
            id="water"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            placeholder="e.g. 500"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label
            htmlFor="nutrients"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nutrients volume (ml)
          </label>
          <input
            id="nutrients"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={nutrients}
            onChange={(e) => setNutrients(e.target.value)}
            placeholder="e.g. 50"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>

        <div>
          <label
            htmlFor="baud"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Baud rate
          </label>
          <select
            id="baud"
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isConnected}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            {BAUD_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          {!isConnected ? (
            <button
              onClick={connect}
              disabled={status === "connecting"}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {status === "connecting" ? "Connecting..." : "Connect to ESP32"}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Disconnect
            </button>
          )}

          <button
            onClick={send}
            disabled={!isConnected}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {status !== "disconnected" && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Status:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {status}
          </span>
        </p>
      )}

      {lastSent && (
        <p className="mt-2 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Sent: {lastSent}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
