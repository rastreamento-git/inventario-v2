import { useState, useEffect, useRef, useId } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { Camera, ImagePlus, FileText, Plus, X } from "lucide-react";
import { mergeSerials } from "../lib/serials";
export default function LeitorSeriais({ seriais, setSeriais }) {
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cameraId = `camera-${id}`,
    fileId = `file-${id}`;
  const current = useRef(seriais),
    setter = useRef(setSeriais),
    chain = useRef(Promise.resolve()),
    audio = useRef(null),
    mounted = useRef(true);
  current.current = seriais;
  setter.current = setSeriais;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (audio.current) audio.current.close().catch(() => {});
    };
  }, []);
  function beep() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!audio.current || audio.current.state === "closed")
        audio.current = new Context();
      const ctx = audio.current;
      ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.07);
    } catch {
      /* scanning remains available without sound */
    }
  }
  function add(codes) {
    try {
      const next = mergeSerials(current.current, codes);
      const added = next.length - current.current.length;
      current.current = next;
      setter.current(next);
      if (added) beep();
      if (mounted.current) {
        setManual("");
        setMessage(
          `${added} novo(s) serial(is) adicionado(s). Duplicados foram ignorados.`,
        );
      }
    } catch (e) {
      if (mounted.current) setMessage(e.message);
    }
  }
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => {
    if (!camera) return;
    let cancelled = false,
      scanner;
    chain.current = chain.current
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        try {
          scanner = new Html5QrcodeScanner(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
              rememberLastUsedCamera: true,
            },
            false,
          );
          scanner.render(
            (code) => {
              if (!cancelled) addRef.current([code]);
            },
            () => {},
          );
        } catch {
          setMessage(
            "Não foi possível abrir a câmera. Use HTTPS, confira as permissões ou importe uma foto.",
          );
        }
      });
    return () => {
      cancelled = true;
      chain.current = chain.current
        .catch(() => {})
        .then(() => scanner?.clear())
        .catch(() => {});
    };
  }, [camera, cameraId]);
  async function photos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (files.length > 100) {
      setMessage("Envie no máximo 100 fotos por vez.");
      return;
    }
    setBusy(true);
    let scanner,
      failures = 0;
    const codes = [];
    try {
      scanner = new Html5Qrcode(fileId);
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          failures++;
          continue;
        }
        try {
          codes.push(await scanner.scanFile(file, false));
        } catch {
          failures++;
        }
      }
      if (mounted.current) {
        addRef.current(codes);
        if (failures)
          setMessage(
            `${failures} foto(s) ilegível(is) ou maior(es) que 10 MB; ${codes.length} código(s) lido(s).`,
          );
      }
    } catch {
      if (mounted.current) setMessage("Não foi possível analisar as fotos.");
    } finally {
      try {
        scanner?.clear();
      } catch {
        /* SDK cleanup */
      }
      if (mounted.current) setBusy(false);
    }
  }
  async function txt(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setMessage("O arquivo TXT deve ter até 1 MB.");
      return;
    }
    try {
      const lines = (await file.text()).split(/\r?\n/);
      if (mounted.current) addRef.current(lines);
    } catch {
      if (mounted.current) setMessage("Não foi possível ler o arquivo TXT.");
    }
  }
  return (
    <div className="pt-4 border-t flex flex-col gap-3 mt-4">
      <div id={fileId} className="hidden" />
      <div className="flex flex-col md:flex-row gap-3">
        <button
          type="button"
          onClick={() => setCamera((v) => !v)}
          className="bg-slate-800 text-white font-bold p-4 rounded-xl flex items-center justify-center flex-1"
        >
          {camera ? <X className="mr-2" /> : <Camera className="mr-2" />}
          {camera ? "Fechar Câmera" : "Câmera ao Vivo"}
        </button>
        <label className="bg-indigo-600 text-white font-bold p-4 rounded-xl flex items-center justify-center flex-1 cursor-pointer">
          <ImagePlus className="mr-2" />
          {busy ? "Analisando…" : "Enviar Fotos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={photos}
          />
        </label>
        <label className="bg-teal-600 text-white font-bold p-4 rounded-xl flex items-center justify-center flex-1 cursor-pointer">
          <FileText className="mr-2" />
          Importar TXT
          <input type="file" accept=".txt" className="hidden" onChange={txt} />
        </label>
      </div>
      {camera && (
        <div id={cameraId} className="rounded-xl border overflow-hidden" />
      )}
      <div className="flex gap-2">
        <input
          aria-label="IMEI ou serial"
          placeholder="Digite o IMEI/serial…"
          className="min-w-0 flex-1 p-4 border rounded-xl bg-gray-50"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add([manual]);
            }
          }}
        />
        <button
          aria-label="Adicionar serial"
          type="button"
          className="bg-slate-200 p-4 rounded-xl"
          onClick={() => add([manual])}
        >
          <Plus />
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Um serial por linha no TXT. Até 1.000 itens por operação. Câmera requer
        HTTPS ou localhost.
      </p>
    </div>
  );
}
