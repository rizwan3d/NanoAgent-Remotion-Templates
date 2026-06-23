import "./index.css";
import { Composition } from "remotion";
import { MyComposition, type StockMediaVideoProps } from "./Composition";

const defaultProps: StockMediaVideoProps = {
  title: "NanoAgent can use local Pexels media",
  subtitle:
    "Run npm run assets:pexels to save a photo or video and emit props for this Remotion template.",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PexelsAssetDemo"
        component={MyComposition}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
        defaultProps={defaultProps}
      />
    </>
  );
};
