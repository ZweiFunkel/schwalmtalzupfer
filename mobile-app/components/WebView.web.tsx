import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  source: { html?: string; uri?: string; baseUrl?: string };
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  // Nur für die native WebView relevant, hier bewusst ignoriert.
  allowsFullscreenVideo?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  originWhitelist?: string[];
}

// Brücke für Seiten, die window.ReactNativeWebView.postMessage nutzen (YouTube-Player in lib/videos.ts).
const BRIDGE = '<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({rnwv:m},"*")}};</script>';

export function WebView({ source, style, onMessage }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!onMessage) return;
    const handler = (ev: MessageEvent) => {
      if (ev.source !== ref.current?.contentWindow || typeof ev.data?.rnwv !== 'string') return;
      onMessage({ nativeEvent: { data: ev.data.rnwv } });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  const common = {
    ref,
    allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
    allowFullScreen: true,
    style: { border: 0, width: '100%', height: '100%', ...(style as object) } as React.CSSProperties,
  };
  if (source.html !== undefined) {
    return <iframe {...common} srcDoc={BRIDGE + source.html} />;
  }
  return <iframe {...common} src={source.uri} />;
}
