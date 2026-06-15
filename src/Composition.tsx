import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type PexelsAttribution = {
  provider: "pexels";
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
};

export type StockPhotoVideoProps = {
  title: string;
  subtitle: string;
  backgroundImage?: string;
  attribution?: PexelsAttribution;
};

export const MyComposition: React.FC<StockPhotoVideoProps> = ({
  title,
  subtitle,
  backgroundImage,
  attribution,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageScale = spring({
    frame,
    fps,
    from: 1.08,
    to: 1,
    durationInFrames: 75,
  });

  const textOpacity = interpolate(frame, [5, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textY = interpolate(frame, [5, 35], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b", overflow: "hidden" }}>
      {backgroundImage ? (
        <AbsoluteFill style={{ transform: `scale(${imageScale})` }}>
          <Img
            src={staticFile(backgroundImage)}
            style={{
              height: "100%",
              objectFit: "cover",
              opacity: 0.68,
              width: "100%",
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg, #111827 0%, #312e81 45%, #030712 100%)",
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82), rgba(0,0,0,0.22))",
        }}
      />

      <AbsoluteFill
        style={{
          color: "white",
          justifyContent: "center",
          opacity: textOpacity,
          padding: 88,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 999,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            marginBottom: 34,
            padding: "12px 22px",
            textTransform: "uppercase",
            width: "max-content",
          }}
        >
          NanoAgent + Pexels
        </div>

        <h1
          style={{
            fontSize: 82,
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 0.95,
            margin: 0,
            maxWidth: 900,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 34,
            lineHeight: 1.25,
            marginTop: 28,
            maxWidth: 760,
            opacity: 0.9,
          }}
        >
          {subtitle}
        </p>
      </AbsoluteFill>

      {attribution ? (
        <div
          style={{
            bottom: 28,
            color: "rgba(255,255,255,0.78)",
            fontSize: 18,
            left: 34,
            position: "absolute",
          }}
        >
          Photo by {attribution.photographer} on Pexels
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
