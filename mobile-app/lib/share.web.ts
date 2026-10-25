// Web: Teilen-Dialog des Geräts (iOS/Android), sonst Datei als Download speichern.
export async function canShareFile(): Promise<boolean> {
  return true;
}

export async function shareFile(uri: string, title?: string): Promise<void> {
  const blob = await (await fetch(uri)).blob();
  const name = title || 'datei';
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = uri;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
