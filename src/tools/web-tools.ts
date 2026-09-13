import * as cheerio from "cheerio";
import { DEFAULT_MAX_OUTPUT_CHARS, optionalInteger, optionalString, requireString, ToolInputError, truncateText } from "./utils";
import type { ToolDefinition } from "./types";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);
const USER_AGENT = "Molière/0.2 (coding-agent; +https://github.com/moliere)";
const MAX_BYTES = 1_500_000;

const webFetchTool: ToolDefinition = {
  name: "webFetch",
  description:
    "Récupère une URL HTTP(S) et extrait le contenu textuel principal. Bloqué par défaut — nécessite une autorisation explicite.",
  access: "web",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      url: { type: "string", description: "URL absolue http(s) à récupérer" },
      maxChars: { type: "integer", description: "Limite de caractères du texte extrait (défaut 20000)" },
      selector: {
        type: "string",
        description: "Sélecteur CSS optionnel pour cibler un élément précis",
      },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const url = requireString(args, "url");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ToolInputError(`URL invalide : ${url}`);
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new ToolInputError(`Schéma interdit : ${parsed.protocol}`);
    }

    const maxChars =
      optionalInteger(args, "maxChars", {
        defaultValue: DEFAULT_MAX_OUTPUT_CHARS,
        min: 500,
        max: 200_000,
      }) ?? DEFAULT_MAX_OUTPUT_CHARS;
    const selector = optionalString(args, "selector");

    const response = await fetch(parsed, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new ToolInputError(`HTTP ${response.status} sur ${parsed.href}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const reader = response.body?.getReader();
    if (!reader) throw new ToolInputError("Pas de flux de réponse.");
    const decoder = new TextDecoder("utf-8");
    let received = 0;
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      if (received >= MAX_BYTES) break;
    }

    if (!contentType.includes("html")) {
      return truncateText(buffer, maxChars);
    }

    const $ = cheerio.load(buffer);
    const root = selector ? $(selector).first() : $("body").first();
    if (root.length === 0) {
      throw new ToolInputError(`Sélecteur sans résultat : ${selector ?? "body"}`);
    }

    root.find("script,style,noscript,svg,canvas,iframe,nav,footer,aside").remove();
    const title = $("title").first().text().trim();
    const text = root
      .text()
      .replace(/ /g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const header = title ? `Titre : ${title}\nURL : ${parsed.href}\n\n` : `URL : ${parsed.href}\n\n`;
    return truncateText(header + text, maxChars);
  },
};

export const webTools: ToolDefinition[] = [webFetchTool];
