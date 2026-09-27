import { toast } from './toast';

const coarse = () => window.matchMedia('(pointer: coarse)').matches;

/** Native share sheet on touch devices; copy-to-clipboard everywhere else. */
export async function shareLink(data: { title: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share && coarse()) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const ok = await copyText(data.url);
  toast(ok ? 'Link copied — paste it anywhere' : 'Copy failed — select the address bar instead', {
    icon: ok ? 'check' : 'link',
  });
  return 'copied';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Trigger a client-side download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}
