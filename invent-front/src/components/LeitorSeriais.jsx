import { useState, useEffect, useRef, useId } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats as Formats,
} from "html5-qrcode";
import {
  Camera,
  ImagePlus,
  FileText,
  Plus,
  ScanLine,
  Pause,
  Play,
  RotateCcw,
  CheckCheck,
  Keyboard,
  LoaderCircle,
  HelpCircle,
} from "lucide-react";
import { mergeSerials, MAX_BATCH } from "../lib/serials";

function scannerQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.catch(() => {}).then(task);
    tail = result;
    return result;
  };
}

async function releaseScanner(scanner, host) {
  if (!scanner) return;
  const video = host?.querySelector("video");
  if (video?.srcObject && video.readyState < 2) {
    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        video.removeEventListener("playing", done);
        video.removeEventListener("error", done);
        resolve();
      };
      const timer = setTimeout(done, 1500);
      video.addEventListener("playing", done, { once: true });
      video.addEventListener("error", done, { once: true });
    });
  }
  try {
    const state = scanner.getState?.();
    if (scanner.isScanning || state === 2 || state === 3) await scanner.stop();
  } finally {
    scanner.clear();
  }
}

function cameraError(error) {
  const name = error?.name || String(error);
  if (/NotAllowed|Permission|denied/i.test(name))
    return `Permissão negada. Conceda acesso à câmara nas definições do navegador.`;
  if (/NotFound|DevicesNotFound/i.test(name))
    return `Nenhuma câmara detetada. Ligue uma webcam ou envie uma fotografia.`;
  if (/NotReadable|TrackStart/i.test(name))
    return `A câmara está ocupada por outra aplicação. Feche outras abas ou programas.`;
  if (/Overconstrained|ConstraintNotSatisfied/i.test(name))
    return `A resolução desta câmara não é suportada. Selecione outra câmara na lista.`;
  return `Não foi possível abrir a câmara. Verifique as permissões ou envie uma fotografia.`;
}

// Configuração completa de formatos de etiquetas, IMEIs e QR Codes
const config = {
  formatsToSupport: [
    Formats.CODE_128,
    Formats.EAN_13,
    Formats.EAN_8,
    Formats.CODE_39,
    Formats.CODE_93,
    Formats.UPC_A,
    Formats.UPC_E,
    Formats.ITF,
    Formats.QR_CODE,
    Formats.DATA_MATRIX,
  ],
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true,
  },
  verbose: false,
};

export default function LeitorSeriais({ seriais, setSeriais }) {
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [paused, setPaused] = useState(false);
  const [device, setDevice] = useState("");
  const [devices, setDevices] = useState([]);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [lastCode, setLastCode] = useState("");
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cameraId = `camera-${id}`,
    fileId = `file-${id}`;
  const photoInput = useRef(null),
    txtInput = useRef(null);
  const current = useRef(seriais),
    setter = useRef(setSeriais);
  const enqueue = useRef(null),
    audio = useRef(null);
  const mounted = useRef(true),
    generation = useRef(0);
  const importing = useRef(false),
    recent = useRef({ code: "", at: 0 });
  const cameraWanted = useRef(camera);
  cameraWanted.current = camera;
  if (!enqueue.current) enqueue.current = scannerQueue();
  current.current = seriais;
  setter.current = setSeriais;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
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
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.07);
    } catch {
      /* Feedback sonoro opcional */
    }
  }

  function add(codes, fromCamera = false) {
    if (!mounted.current) return;
    if (fromCamera) {
      const now = Date.now();
      if (recent.current.code === codes[0] && now - recent.current.at < 2000)
        return;
      recent.current = { code: codes[0], at: now };
    }
    try {
      const next = mergeSerials(current.current, codes);
      const added = next.length - current.current.length;
      if (added) {
        current.current = next;
        setter.current(next);
        beep();
        setLastCode(next[0]);
      }
      if (!fromCamera) setManual("");
      setMessage(
        added
          ? `${added} serial(is) adicionado(s) à conferência.`
          : `Nenhum novo serial. Códigos repetidos foram ignorados.`,
      );
    } catch (e) {
      setMessage(e.message);
    }
  }
  const addRef = useRef(add);
  addRef.current = add;

  useEffect(() => {
    if (!camera || paused) return;
    let cancelled = false,
      scanner;
    setStatus("starting");
    recent.current = { code: "", at: 0 };
    enqueue
      .current(async () => {
        if (cancelled) return;
        try {
          if (
            !window.isSecureContext ||
            !navigator.mediaDevices?.getUserMedia
          ) {
            throw new Error("secure-context");
          }
          scanner = new Html5Qrcode(cameraId, config);

          // Configuração compatível com telemóvel e webcams de computador (sem min restritivo)
          const cameraConfig = device
            ? { deviceId: { exact: device } }
            : {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              };

          await scanner.start(
            cameraConfig,
            {
              fps: 12, // 12 FPS oferece equilíbrio ideal de processamento sem sobrecarregar a CPU
              // Área retangular ampla para acomodar códigos de barras longos (Code 128) e QR Codes
              qrbox: (viewfinderWidth, viewfinderHeight) => {
                const width = Math.floor(Math.min(viewfinderWidth * 0.9, 450));
                const height = Math.floor(Math.max(160, Math.min(viewfinderHeight * 0.55, 260)));
                return { width, height };
              },
            },
            (code) => {
              if (!cancelled) addRef.current([code], true);
            },
            () => {},
          );

          if (cancelled) return;
          setStatus("active");

          // Tenta aplicar focagem contínua por hardware se a câmara suportar
          try {
            const videoElement = document.querySelector(`#${cameraId} video`);
            const track = videoElement?.srcObject?.getVideoTracks?.()[0];
            const capabilities = track?.getCapabilities?.() || {};
            if (capabilities.focusMode?.includes("continuous")) {
              await track.applyConstraints({
                advanced: [{ focusMode: "continuous" }],
              });
            }
          } catch {
            /* Focagem automática nativa opcional */
          }

          navigator.mediaDevices
            .enumerateDevices()
            .then((available) => {
              if (!cancelled)
                setDevices(available.filter((d) => d.kind === "videoinput"));
            })
            .catch(() => {});
        } catch (e) {
          await releaseScanner(scanner).catch(() => {});
          scanner = null;
          if (cancelled) return;
          setStatus("error");
          setMessage(
            e?.message === "secure-context"
              ? `A câmara requer conexão HTTPS ou localhost.`
              : cameraError(e),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      enqueue
        .current(async () => {
          await releaseScanner(scanner, document.getElementById(cameraId));
          if (mounted.current && !cameraWanted.current) setStatus("idle");
        })
        .catch(() => {});
    };
  }, [camera, paused, device, retry, cameraId]);

  async function photos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || importing.current) return;
    if (files.length > 100) {
      setMessage(`Envie no máximo 100 fotos por vez.`);
      return;
    }
    importing.current = true;
    setBusy(true);
    const token = generation.current;
    const alive = () => mounted.current && token === generation.current;
    let scanner,
      failures = 0;
    const codes = [];
    try {
      scanner = new Html5Qrcode(fileId, config);
      for (const [index, file] of files.entries()) {
        if (!alive()) break;
        setProgress(`${index + 1}/${files.length}`);
        if (file.size > 10 * 1024 * 1024 || !file.type.startsWith("image/")) {
          failures++;
          continue;
        }
        try {
          codes.push(await scanner.scanFile(file, false));
        } catch {
          failures++;
        }
      }
      if (alive()) {
        let added = 0,
          rejected = 0;
        for (const code of codes) {
          try {
            const next = mergeSerials(current.current, [code]);
            added += next.length - current.current.length;
            current.current = next;
          } catch {
            rejected++;
          }
        }
        setter.current(current.current);
        if (added) {
          beep();
          setLastCode(current.current[0]);
        }
        setMessage(
          `${added} serial(is) adicionado(s); ${codes.length - added - rejected} repetido(s); ${failures} foto(s) sem leitura; ${rejected} código(s) inválido(s).`,
        );
      }
    } catch {
      if (alive())
        setMessage(`Não foi possível analisar as fotografias. Tente novamente.`);
    } finally {
      await releaseScanner(scanner).catch(() => {});
      importing.current = false;
      if (alive()) {
        setBusy(false);
        setProgress("");
      }
    }
  }

  async function txt(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setMessage(`O ficheiro TXT deve ter até 1 MB.`);
      return;
    }
    const token = generation.current;
    try {
      const lines = (await file.text()).split(/\r?\n/);
      if (mounted.current && token === generation.current)
        addRef.current(lines);
    } catch {
      if (mounted.current) setMessage(`Não foi possível ler o ficheiro TXT.`);
    }
  }

  return (
    <section
      className="serial-reader"
      aria-label="Leitor de QR Code e código de barras"
    >
      <div id={fileId} className="scanner-file-host" aria-hidden="true" />
      <div className="reader-heading">
        <span className="reader-symbol">
          <ScanLine size={20} />
        </span>
        <div>
          <h3>Adicionar equipamentos</h3>
          <p>QR Code, código de barras ou serial</p>
        </div>
        <span className="reader-count">
          {seriais.length}/{MAX_BATCH}
        </span>
      </div>
      <div className="reader-actions">
        <button
          type="button"
          className={`reader-action ${camera ? "is-selected" : ""}`}
          aria-pressed={camera}
          onClick={() => {
            setCamera((v) => !v);
            setPaused(false);
            setMessage("");
          }}
        >
          <Camera size={20} />
          <strong>{camera ? "Fechar câmara" : "Usar câmara / webcam"}</strong>
          <small>Leitura contínua</small>
        </button>
        <button
          type="button"
          className="reader-action"
          disabled={busy}
          onClick={() => photoInput.current?.click()}
        >
          {busy ? (
            <LoaderCircle size={20} className="is-spinning" />
          ) : (
            <ImagePlus size={20} />
          )}
          <strong>{busy ? `A analisar ${progress}` : "Enviar fotos"}</strong>
          <small>Uma etiqueta por foto</small>
        </button>
        <button
          type="button"
          className="reader-action"
          disabled={busy}
          onClick={() => txtInput.current?.click()}
        >
          <FileText size={20} />
          <strong>Importar lista</strong>
          <small>Ficheiro TXT</small>
        </button>
      </div>
      <input
        ref={photoInput}
        type="file"
        aria-label="Importar fotos de etiquetas"
        accept="image/*"
        multiple
        hidden
        disabled={busy}
        onChange={photos}
      />
      <input
        ref={txtInput}
        type="file"
        aria-label="Importar lista de seriais"
        accept=".txt,text/plain"
        hidden
        disabled={busy}
        onChange={txt}
      />
      <div className="reader-camera" hidden={!camera && status === "idle"}>
        <div className="reader-camera-toolbar">
          <label htmlFor={`device-${id}`}>Câmara:</label>
          <select
            id={`device-${id}`}
            value={device}
            disabled={status === "starting" && !paused}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">Automática (traseira ou webcam)</option>
            {devices.map((d, index) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Câmara ${index + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label={paused ? "Retomar leitura" : "Pausar leitura"}
            disabled={status !== "active" && !paused}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
        <div className="reader-viewfinder">
          <div id={cameraId} className="reader-video" />
          {status === "active" && !paused && (
            <div className="reader-frame" aria-hidden="true" />
          )}
          {(paused || status !== "active") && (
            <div className="reader-camera-placeholder">
              {status === "starting" && !paused ? (
                <LoaderCircle size={28} className="is-spinning" />
              ) : (
                <Camera size={28} />
              )}
              <span>
                {paused
                  ? "Leitura pausada"
                  : status === "error"
                    ? "Câmara indisponível"
                    : "A carregar feed da câmara…"}
              </span>
              {status === "error" && !paused && (
                <button type="button" onClick={() => setRetry((v) => v + 1)}>
                  <RotateCcw size={15} /> Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
        <div className="reader-camera-tip flex items-center justify-center gap-1.5 text-xs text-slate-500 py-1">
          <HelpCircle size={14} className="text-teal-600 flex-shrink-0" />
          <span>
            <strong>Dica de leitura:</strong> Em webcams, mantenha a etiqueta alinhada a cerca de <strong>15 a 25 cm</strong> da lente para foco nítido e sem reflexos.
          </span>
        </div>
      </div>
      <label className="reader-manual-label" htmlFor={`manual-${id}`}>
        <Keyboard size={15} /> Digitar ou usar leitor USB
      </label>
      <div className="reader-manual">
        <input
          id={`manual-${id}`}
          placeholder="IMEI ou serial do equipamento"
          autoComplete="off"
          spellCheck={false}
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
          type="button"
          disabled={!manual.trim()}
          onClick={() => add([manual])}
        >
          <Plus size={18} />
          <span>Adicionar</span>
        </button>
      </div>
      {lastCode && (
        <div className="reader-last">
          <CheckCheck size={16} />
          <span>
            Último adicionado: <code>{lastCode}</code>
          </span>
        </div>
      )}
      {message && (
        <p role="status" className="reader-message">
          {message}
        </p>
      )}
      <p className="reader-help">
        Até 100 fotos de 10 MB. No TXT, um serial por linha. Revise a lista
        antes de confirmar a movimentação.
      </p>
    </section>
  );
}
