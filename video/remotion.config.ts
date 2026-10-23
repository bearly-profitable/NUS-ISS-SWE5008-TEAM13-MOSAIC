import { Config } from "@remotion/cli/config";

// Frames are captured losslessly (PNG) and encoded at a low CRF with a slow
// x264 preset: the film is mostly fine UI text on flat light surfaces, which
// JPEG frame capture and the default CRF 18 visibly soften.
Config.setVideoImageFormat("png");
Config.setCrf(12);
Config.setX264Preset("slow");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
