import { Composition } from "remotion";
import { Likhit } from "./Likhit";
import { END } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Likhit"
        component={Likhit}
        durationInFrames={Math.ceil(END * 30)}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
