import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "br.com.euvoujogar.programar",
  appName: "Eu Vou Programar",
  webDir: "dist-mobile",
  backgroundColor: "#f5f7f6",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#f5f7f6",
    allowMixedContent: false,
  },
};

export default config;
