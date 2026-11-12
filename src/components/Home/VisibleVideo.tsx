'use client';

import { useEffect, useRef } from 'react';

type Props = {
  src: string;
  poster: string;
  media?: string;
  className?: string;
  'aria-label'?: string;
};

// Keep the existing video/crop, but do not buffer or decode a hidden copy.
export default function VisibleVideo({ src, poster, media = 'all', ...props }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef<HTMLSourceElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const source = sourceRef.current;
    if (!video || !source) return;

    const query = window.matchMedia(media);
    let position = 0;
    let active: boolean | undefined;

    const restorePosition = () => {
      if (position > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(position, Math.max(0, video.duration - 0.01));
      }
    };
    const update = () => {
      const rect = video.getBoundingClientRect();
      const visible = query.matches && !document.hidden && rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.top < window.innerHeight
        && rect.right > 0 && rect.left < window.innerWidth;
      if (visible === active) return;
      active = visible;

      if (visible) {
        video.muted = true;
        if (!source.hasAttribute('src')) {
          source.src = src;
          video.load();
        }
        // Autoplay may be denied (for example by a device power-saving policy).
        // The existing poster remains the fallback; no controls or overlays change.
        void video.play().catch(() => {});
      } else {
        position = video.currentTime || position;
        video.pause();
        if (source.hasAttribute('src')) {
          source.removeAttribute('src');
          video.load(); // Abort buffering as well as playback.
        }
      }
    };

    video.addEventListener('loadedmetadata', restorePosition);
    const observer = new IntersectionObserver(update);
    observer.observe(video);
    query.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      query.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('resize', update);
      video.removeEventListener('loadedmetadata', restorePosition);
      video.pause();
    };
  }, [src, media]);

  return (
    <video ref={videoRef} autoPlay muted loop playsInline preload="metadata" poster={poster} {...props}>
      {/* Native selection also avoids the hidden breakpoint download before hydration. */}
      <source ref={sourceRef} src={src} type="video/mp4" media={media} />
    </video>
  );
}
