import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The scenes lean on backdrop-filter and large blurred gradients; 2x the
// default concurrency chews through memory on a laptop, so leave it auto.
Config.setChromiumOpenGlRenderer("angle");
