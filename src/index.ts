import { Command } from "commander";
import { intro, outro, text, spinner, isCancel } from "@clack/prompts";
import { loadConfig } from "./config";
import { streamChat, type Message } from "./llm/openrouter";
import { executeTool } from "./tools";

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
        "Tu es Molière, un agent de codage expert, hautement performant, autonome et pragmatique. Tu t'exprimes en français de manière claire et concise. Tu as accès à des outils pour lire le système de fichiers et exécuter des commandes. Utilise-les si nécessaire pour accomplir les tâches demandées.",
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

    while (!agentAATermine) {
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

        if (reponseAssistant.content) {
          if (aCommenceAEcrire) console.log("\n");
          else s.stop();

          historiqueMessages.push(reponseAssistant);
          agentAATermine = true;
        } else if (
          reponseAssistant.tool_calls &&
          reponseAssistant.tool_calls.length > 0
        ) {
          if (aCommenceAEcrire) {
            console.log("\n");
          } else {
            s.stop("Molière a décidé d'agir.");
          }

          historiqueMessages.push(reponseAssistant);

          const toolCall = reponseAssistant.tool_calls[0];

          if (!toolCall) {
            agentAATermine = true;
            continue;
          }

          const toolName = toolCall.function.name;
          const toolArgs = toolCall.function.arguments;

          console.log(
            `\x1b[36m> Exécution de l'outil : ${toolName} (${toolArgs})\x1b[0m`,
          );

          const resultatOutil = await executeTool(toolName, toolArgs);

          historiqueMessages.push({
            role: "tool",
            content: resultatOutil,
            name: toolName,
            tool_call_id: toolCall.id,
          });
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
