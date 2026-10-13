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
} from "lucide-react";
import { mergeSerials, MAX_BATCH } from "../lib/serials";
import { cameraError, releaseScanner, scannerQueue } from "../lib/scanner";

const config = {
  formatsToSupport: [
    Formats.QR_CODE,
    Formats.CODE_128,
    Formats.CODE_39,
    Formats.CODE_93,
    Formats.EAN_13,
    Formats.EAN_8,
    Formats.ITF,
    Formats.UPC_A,
    Formats.UPC_E,
    Formats.DATA_MATRIX,
    Formats.PDF_417,
  ],
  // Some browsers expose BarcodeDetector with only a subset of formats.
  // Use the bundled decoder consistently for all configured label formats.
  useBarCodeDetectorIfSupported: false,
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
      /* Sound is optional. */
    }
  }

  function add(codes, fromCamera = false) {
    if (!mounted.current) return;
    // Avoid beeps and React updates for every frame of the same label.
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
          : "Nenhum novo serial. Códigos repetidos foram ignorados.",
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
          // Scan the full frame: narrow fixed crops can truncate QR codes.
          await scanner.start(
            device || { facingMode: "environment" },
            { fps: 10 },
            (code) => {
              if (!cancelled) addRef.current([code], true);
            },
            () => {}, // A frame without a readable code is normal.
          );
          if (cancelled) return;
          setStatus("active");
          // Device enumeration must not delay a queued stop or camera switch.
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
              ? "A câmera requer HTTPS ou localhost e um navegador com acesso à câmera. Você pode importar fotos ou digitar o serial."
              : cameraError(e),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      // Wait for start() before stop(), even when the user closes immediately.
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
      setMessage("Envie no máximo 100 fotos por vez.");
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
        // Preserve successful labels if another decoded value is invalid.
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
          `${added} serial(is) adicionado(s); ${codes.length - added - rejected} repetido(s); ${failures} foto(s) sem leitura; ${rejected} código(s) inválido(s) ou acima do limite do lote.`,
        );
      }
    } catch {
      if (alive())
        setMessage("Não foi possível analisar as fotos. Tente novamente.");
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
      setMessage("O arquivo TXT deve ter até 1 MB.");
      return;
    }
    const token = generation.current;
    try {
      const lines = (await file.text()).split(/\r?\n/);
      if (mounted.current && token === generation.current)
        addRef.current(lines);
    } catch {
      if (mounted.current) setMessage("Não foi possível ler o arquivo TXT.");
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
          <strong>{camera ? "Fechar câmera" : "Usar câmera"}</strong>
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
          <strong>{busy ? `Analisando ${progress}` : "Enviar fotos"}</strong>
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
          <small>Arquivo TXT</small>
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
      {/* Keep the host mounted while queued cleanup releases the camera. */}
      <div className="reader-camera" hidden={!camera && status === "idle"}>
        <div className="reader-camera-toolbar">
          <label htmlFor={`device-${id}`}>Câmera</label>
          <select
            id={`device-${id}`}
            value={device}
            disabled={status === "starting" && !paused}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="">Automática (preferir traseira)</option>
            {devices.map((d, index) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Câmera ${index + 1}`}
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
                    ? "Câmera indisponível"
                    : "Aguardando acesso à câmera…"}
              </span>
              {status === "error" && !paused && (
                <button type="button" onClick={() => setRetry((v) => v + 1)}>
                  <RotateCcw size={15} /> Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
        <p className="reader-camera-tip">
          Mantenha a etiqueta inteira visível, com boa iluminação e sem
          reflexos.
        </p>
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
