import "./index.css";
import { Composition } from "remotion";
import { MyComposition, type StockPhotoVideoProps } from "./Composition";

const defaultProps: StockPhotoVideoProps = {
  title: "NanoAgent can use local Pexels assets",
  subtitle:
    "Run npm run assets:pexels to save an image and emit props for this Remotion template.",
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
