import { Command } from "commander";
import { intro, outro, text, spinner, isCancel } from "@clack/prompts";
import { loadConfig } from "./config";
import { streamChat, type Message } from "./llm/openrouter";
import { executeTool, isMutatingTool } from "./tools";

const MAX_TOOL_ROUNDS = 12;
const MAX_REPEATED_TOOL_BATCHES = 2;
type ToolCall = NonNullable<Message["tool_calls"]>[number];

const executeSingleToolCall = async (toolCall: ToolCall): Promise<Message> => {
  const toolName = toolCall.function.name;

  console.log(`\x1b[36m> Exécution de l'outil : ${toolName}\x1b[0m`);
  const resultatOutil = await executeTool(toolName, toolCall.function.arguments);

  return {
    role: "tool",
    content: resultatOutil,
    name: toolName,
    tool_call_id: toolCall.id,
  };
};

const executeToolCallsSafely = async (
  toolCalls: ToolCall[],
): Promise<Message[]> => {
  const results: Message[] = [];
  let index = 0;

  while (index < toolCalls.length) {
    const toolCall = toolCalls[index];
    if (!toolCall) break;

    if (isMutatingTool(toolCall.function.name)) {
      results.push(await executeSingleToolCall(toolCall));
      index += 1;
      continue;
    }

    const readOnlyBatch: ToolCall[] = [];
    while (index < toolCalls.length) {
      const nextToolCall = toolCalls[index];
      if (!nextToolCall || isMutatingTool(nextToolCall.function.name)) break;
      readOnlyBatch.push(nextToolCall);
      index += 1;
    }

    results.push(...(await Promise.all(readOnlyBatch.map(executeSingleToolCall))));
  }

  return results;
};

const program = new Command();
const config = loadConfig();

program
  .name("Molière")
  .description(
    "Molière - L'assistant de code 100% français indépendant d'autres pays.",
  )
  .version("0.1.0");

program.action(async () => {
  console.clear();
  intro(`Bienvenue chez Molière (Modèle: ${config.defaultModel})`);

  if (!config.apiKey) {
    console.error(
      "Erreur: Aucune clé API trouvée. Configure MOLIERE_API_KEY dans ton .env",
    );
    return;
  }

  const historiqueMessages: Message[] = [
    {
      role: "system",
      content:
        "Tu es Molière, un agent de codage expert, hautement performant, autonome et pragmatique. Tu t'exprimes en français de manière claire et concise. Tu peux explorer le projet avec tree, listDirectory, findFiles et searchInFiles; lire les fichiers avec readFile; créer avec writeFile; modifier avec editFile; inspecter Git avec gitStatus, gitDiff et gitLog; lancer des tests/builds avec runCommand. Préfère les chemins relatifs au projet, limite les sorties volumineuses, utilise editFile avec un bloc exact et unique, réserve writeFile aux nouveaux fichiers, et n'exécute jamais de commande destructive.",
    },
  ];

  let running = true;
  while (running) {
    const userInput = await text({
      message:
        'Que puis-je faire pour toi ? (Tape "quitter" ou "ctrl + c" pour sortir)',
      placeholder: "ex: Quel est le contenu de package.json ?",
    });

    if (
      isCancel(userInput) ||
      userInput.toString().toLowerCase() === "quitter"
    ) {
      running = false;
      break;
    }

    historiqueMessages.push({ role: "user", content: userInput.toString() });

    let agentAATermine = false;
    let toolRounds = 0;
    let lastToolSignature = "";
    let repeatedToolSignatureCount = 0;

    while (!agentAATermine) {
      if (toolRounds >= MAX_TOOL_ROUNDS) {
        console.warn(
          `Molière s'arrête après ${MAX_TOOL_ROUNDS} tours d'outils pour éviter une boucle coûteuse. Reformule ou demande une tâche plus ciblée.`,
        );
        agentAATermine = true;
        continue;
      }

      const s = spinner();
      s.start("Molière réfléchit...");

      try {
        let aCommenceAEcrire = false;

        const reponseAssistant = await streamChat(
          historiqueMessages,
          (chunk) => {
            if (!aCommenceAEcrire) {
              s.stop("Molière :");
              aCommenceAEcrire = true;
            }
            process.stdout.write(chunk);
          },
        );

        if (
          reponseAssistant.tool_calls &&
          reponseAssistant.tool_calls.length > 0
        ) {
          toolRounds += 1;

          const toolSignature = JSON.stringify(
            reponseAssistant.tool_calls.map((toolCall) => ({
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            })),
          );

          if (toolSignature === lastToolSignature) {
            repeatedToolSignatureCount += 1;
          } else {
            lastToolSignature = toolSignature;
            repeatedToolSignatureCount = 1;
          }

          if (repeatedToolSignatureCount > MAX_REPEATED_TOOL_BATCHES) {
            if (!aCommenceAEcrire) s.stop();
            console.warn(
              "Molière s'arrête: le modèle répète exactement les mêmes appels d'outils.",
            );
            agentAATermine = true;
            continue;
          }

          if (reponseAssistant.content && aCommenceAEcrire) {
            console.log("\n");
          } else if (!aCommenceAEcrire) {
            s.stop("Molière a décidé d'agir.");
          }

          historiqueMessages.push(reponseAssistant);
          const toolResults = await executeToolCallsSafely(
            reponseAssistant.tool_calls,
          );

          historiqueMessages.push(...toolResults);
        } else if (reponseAssistant.content) {
          if (aCommenceAEcrire) console.log("\n");
          else s.stop();

          historiqueMessages.push(reponseAssistant);
          agentAATermine = true;
        } else {
          s.stop();
          agentAATermine = true;
        }
      } catch (error) {
        s.stop("Une erreur est survenue.");
        console.error(error);
        agentAATermine = true;
      }
    }
  }

  outro("Au plaisir de vous revoir !");
});

program.parse(process.argv);
