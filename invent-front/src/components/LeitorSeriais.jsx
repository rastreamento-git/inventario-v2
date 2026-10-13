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

// Helpers do Scanner incorporados diretamente para evitar falhas de importação
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
    return "Permissão negada. Libere a câmera nas configurações deste site e tente novamente.";
  if (/NotFound|DevicesNotFound/i.test(name))
    return "Nenhuma câmera encontrada. Conecte uma câmera ou importe uma foto.";
  if (/NotReadable|TrackStart/i.test(name))
    return "A câmera está ocupada ou indisponível. Feche os outros aplicativos que a utilizam.";
  if (/Overconstrained|ConstraintNotSatisfied/i.test(name))
    return "Essa câmera não está disponível. Selecione outra câmera e tente novamente.";
  return "Não foi possível abrir a câmera. Confira as permissões e tente novamente ou importe uma foto.";
}

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
      /* Som opcional */
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
          await scanner.start(
            device || { facingMode: "environment" },
            { fps: 10 },
            (code) => {
              if (!cancelled) addRef.current([code], true);
            },
            () => {},
          );
          if (cancelled) return;
          setStatus("active");
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
              ? "A câmera requer HTTPS ou
