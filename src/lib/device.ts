/**
 * Device / PWA detection helpers for responsive shell and install UX.
 */

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches;
}

/** True when the app should use the full-screen mobile shell (phone / narrow / installed PWA). */
export function shouldUseCompactShell(viewMode: 'desktop' | 'mobile' | 'hub', isNarrowViewport: boolean): boolean {
  if (viewMode === 'mobile') return true;
  if (viewMode === 'desktop') return false;
  return isNarrowViewport || isMobileUserAgent() || isStandalonePwa();
}

export function isPhonePreviewOnDesktop(viewMode: 'desktop' | 'mobile' | 'hub', isNarrowViewport: boolean): boolean {
  return viewMode === 'mobile' && !isNarrowViewport && !isMobileUserAgent() && !isStandalonePwa();
}

export async function requestMicrophonePermission(): Promise<PermissionState | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state;
    }
    return 'granted';
  } catch {
    if (navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state;
      } catch {
        return 'denied';
      }
    }
    return 'denied';
  }
}

export function buildMotionAiSystemInstruction(workspaceName?: string): string {
  const space = workspaceName?.trim() || 'your workspace';
  return `You are a helpful, professional Workspace Assistant named **MotionAI** for ${space}.
- Answer user queries with professional poise and clarity in Markdown format.
- Assist with content generation, summarization, general questions, and technical advice.
- Keep your tone friendly, helpful, highly organized, and compact. Match the minimalist workspace aesthetic.
- Avoid preachy or overly verbose intros unless necessary. Deliver exact solutions directly.`;
}
