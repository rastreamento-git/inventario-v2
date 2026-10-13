// Serialize transitions, including closing while camera permission is pending.
export function scannerQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.catch(() => {}).then(task);
    tail = result;
    return result;
  };
}

export async function releaseScanner(scanner, host) {
  if (!scanner) return;
  const video = host?.querySelector("video");
  // The SDK does not catch play() rejection. Let its pending play settle
  // before removing the video when the user closes immediately after start.
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
    // start() can resolve before the first video frame sets isScanning.
    // The SDK state is already SCANNING (2) or PAUSED (3) at that point.
    const state = scanner.getState?.();
    if (scanner.isScanning || state === 2 || state === 3) await scanner.stop();
  } finally {
    scanner.clear();
  }
}

export function cameraError(error) {
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
