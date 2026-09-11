// MediaStreamTrackProcessor (Chrome/Edge) isn't in TypeScript's lib.dom yet.
// Only the surface the Loop recorder uses — see components/loops/LoopRecorder.tsx.
interface MediaStreamTrackProcessor {
  readonly readable: ReadableStream<VideoFrame>;
}

declare const MediaStreamTrackProcessor: {
  prototype: MediaStreamTrackProcessor;
  new (init: { track: MediaStreamTrack }): MediaStreamTrackProcessor;
};

interface Window {
  MediaStreamTrackProcessor?: typeof MediaStreamTrackProcessor;
}
