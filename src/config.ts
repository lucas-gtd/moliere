import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

interface MoliereConfig {
  apiKey?: string;
  defaultModel: string;
}

export const loadConfig = (): MoliereConfig => {
  let config: MoliereConfig = {
    apiKey: process.env.MOLIERE_API_KEY,
    defaultModel: process.env.MOLIERE_DEFAULT_MODEL || "mistral-large-latest",
  };

  const globalConfigPath = path.join(os.homedir(), ".moliere", "config.json");
  if (fs.existsSync(globalConfigPath)) {
    try {
      const globalConfig = JSON.parse(
        fs.readFileSync(globalConfigPath, "utf-8"),
      );
      config = { ...config, ...globalConfig };
    } catch (error) {
      console.error(
        "Erreur de lecture du fichier de configuration global.",
        error,
      );
    }
  }

  return config;
};
