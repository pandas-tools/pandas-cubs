"use client";

import MuxPlayer from "@mux/mux-player-react";

export default function MuxPlayerClient({
  playbackId,
  title,
  subtitlesEnabled,
}: {
  playbackId: string;
  title?: string;
  subtitlesEnabled?: boolean;
}) {
  return (
    <MuxPlayer
      streamType="on-demand"
      playbackId={playbackId}
      metadata={{
        video_title: title,
      }}
      accentColor="#10b981"
      defaultShowRemainingTime
      defaultHiddenCaptions={!subtitlesEnabled}
      style={{ aspectRatio: "16/9", width: "100%" }}
    />
  );
}
