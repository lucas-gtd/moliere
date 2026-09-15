# T-17 — Normalisation des erreurs cross-provider

> **Statut** : `TODO` · **Priorité** : `P0` · **Effort** : `M`

## But

Définir un type `ProviderError` unique (union discriminée par `kind`) ainsi que les helpers de fabrication `asProviderError(error, providerId)` et `providerErrorFromResponse(response, providerId)`, afin que **tous** les adaptateurs (`openai.ts`, `anthropic.ts`, `gemini.ts`, etc.) lèvent la même classe d'erreur. Les branches TUI (puces rouges, messages au modèle, retry) pourront alors `switch` sur `err.kind` sans connaître le provider.

## Pré-requis

- T-02 (DONE) — `ProviderId` et `ResolvedProvider` exportés depuis `src/llm/providers/registry.ts`.

## Fichiers touchés

- `src/llm/providers/errors.ts` — **nouveau** fichier, déclaration des types et helpers.
- `src/llm/providers/index.ts` — ré-export du module pour surface publique.
- `tests/provider-errors.test.ts` — **nouveau** : tests unitaires de la fonction de mappage.
- Chaque adaptateur livré par T-04 à T-13 — sera migré plus tard pour utiliser ces helpers (non requis ici, juste poser la fondation).

## Étapes

1. Créer `src/llm/providers/errors.ts` avec le contenu ci-dessous (type complet + helpers).
2. Implémenter `asProviderError(error: unknown, providerId: ProviderId): ProviderError` :
   - Si `error instanceof ProviderError` → retourner tel quel.
   - Si `error instanceof TypeError` (typique fetch : `Failed to fetch`, `network change`, etc.) → `{ kind: "network", message, providerId, cause }`.
   - Sinon → `{ kind: "unknown", message: String(message), providerId, cause }`.
3. Implémenter `providerErrorFromResponse(response: Response, providerId: ProviderId): Promise<ProviderError>` :
   - Lire `await response.text()` (tronquer à 500 caractères pour éviter `MAX_OUTPUT_CHARS`).
   - Mapper le code HTTP vers `kind` via la table :

     | Code | kind              |
     | ---- | ----------------- |
     | 400  | `content_filter` ou `unknown` selon body contenant `content_filter` / `policy` / `safety` |
     | 401  | `auth`            |
     | 403  | `auth`            |
     | 408  | `network`         |
     | 413  | `context_length`  |
     | 429  | `rate_limit`      |
     | 500+ | `upstream`        |
     | autre | `unknown`         |

   - Si le body contient `context_length_exceeded` / `maximum context length` / `too many tokens` → forcer `kind = "context_length"`.
   - Si le body contient `rate_limit` / `quota` / `tpm` → forcer `kind = "rate_limit"`.
4. Exporter en plus un `class ProviderError extends Error` avec discriminator `readonly kind: ProviderErrorKind` et `readonly providerId: ProviderId` pour permettre `instanceof` côté UI.
5. Écrire `tests/provider-errors.test.ts` couvrant :
   - `providerErrorFromResponse` sur 401, 403, 408, 413, 429, 500, 503, codes imprévus.
   - Détection `content_filter` dans le body pour 400.
   - `asProviderError` sur `Error` générique, sur `TypeError`, sur valeur non-Error (`null`, `"oops"`).
   - `instanceof ProviderError` retourné vrai.

## Spécification TypeScript (extrait à livrer)

```ts
// src/llm/providers/errors.ts
import type { ProviderId } from "./registry";

export type ProviderErrorKind =
  | "auth"
  | "rate_limit"
  | "context_length"
  | "content_filter"
  | "upstream"
  | "network"
  | "unknown";

export const PROVIDER_ERROR_CODES: Readonly<Record<ProviderErrorKind, number>> = {
  auth: 1001,
  rate_limit: 1002,
  context_length: 1003,
  content_filter: 1004,
  upstream: 1005,
  network: 1006,
  unknown: 1099,
};

export interface ProviderErrorShape {
  readonly kind: ProviderErrorKind;
  readonly providerId: ProviderId;
  readonly status?: number;
  readonly message: string;
  readonly cause?: unknown;
}

export class ProviderError extends Error implements ProviderErrorShape {
  public readonly kind: ProviderErrorKind;
  public readonly providerId: ProviderId;
  public readonly status?: number;
  public readonly cause?: unknown;
  public readonly code: number;

  constructor(shape: ProviderErrorShape) {
    super(`[${shape.providerId}] ${shape.kind}: ${shape.message}`);
    this.name = "ProviderError";
    this.kind = shape.kind;
    this.providerId = shape.providerId;
    this.status = shape.status;
    this.cause = shape.cause;
    this.code = PROVIDER_ERROR_CODES[shape.kind];
  }
}

export const isProviderError = (value: unknown): value is ProviderError =>
  value instanceof ProviderError;

export const asProviderError = (
  error: unknown,
  providerId: ProviderId,
): ProviderError => {
  if (isProviderError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError) {
    return new ProviderError({ kind: "network", providerId, message, cause: error });
  }
  return new ProviderError({
    kind: "unknown",
    providerId,
    message,
    cause: error instanceof Error ? error : undefined,
  });
};

export const providerErrorFromResponse = async (
  response: Response,
  providerId: ProviderId,
): Promise<ProviderError> => {
  let body = "";
  try {
    body = (await response.text()).slice(0, 500);
  } catch {
    body = "";
  }
  const lowered = body.toLowerCase();
  const status = response.status;

  if (status === 401 || status === 403) {
    return new ProviderError({ kind: "auth", providerId, status, message: body || `HTTP ${status}` });
  }
  if (status === 408) {
    return new ProviderError({ kind: "network", providerId, status, message: body || "timeout" });
  }
  if (status === 413) {
    return new ProviderError({ kind: "context_length", providerId, status, message: body });
  }
  if (status === 429) {
    return new ProviderError({ kind: "rate_limit", providerId, status, message: body });
  }
  if (status >= 500) {
    return new ProviderError({ kind: "upstream", providerId, status, message: body || `HTTP ${status}` });
  }

  if (lowered.includes("context_length") || lowered.includes("too many tokens")) {
    return new ProviderError({ kind: "context_length", providerId, status, message: body });
  }
  if (lowered.includes("rate_limit") || lowered.includes("quota") || lowered.includes("tpm")) {
    return new ProviderError({ kind: "rate_limit", providerId, status, message: body });
  }
  if (lowered.includes("content_filter") || lowered.includes("policy") || lowered.includes("safety")) {
    return new ProviderError({ kind: "content_filter", providerId, status, message: body });
  }

  return new ProviderError({ kind: "unknown", providerId, status, message: body || `HTTP ${status}` });
};
```

## Critères d'acceptation

- [ ] `bun test tests/provider-errors.test.ts` passe avec 12 cas minimum.
- [ ] `ProviderError extends Error`, `err.code` numérique défini pour chaque `kind`, `err.kind` ∈ 7 valeurs listées.
- [ ] `asProviderError` accepte `unknown` sans `as any` (typage strict).
- [ ] `bunx tsc --noEmit` retourne 0.
- [ ] Aucune chaîne « MiniMax » dans le nouveau fichier.

## Pièges & anti-patterns

- ❌ `as unknown as ProviderError` pour forcer la conversion — utiliser `asProviderError` qui construit une instance propre.
- ❌ Ne pas mettre `cause` en `any` : typer `unknown` (R3 strict).
- ❌ Logger le body brut dans `message` s'il dépasse 500 caractères (risque `MAX_OUTPUT_CHARS`).
- ❌ Mélanger logique HTTP et logique provider — le mappage HTTP→kind reste **neutre** vis-à-vis du provider ; le provider n'intervient que comme étiquette.
- ✅ Penser au consommateur TUI : un `switch(err.kind)` couvre toutes les branches sans `default` à trous.

## Références

- `AGENTS.md` R3 — TypeScript strict, pas de `any`.
- `AGENTS.md` R9 — sorties d'outils en `string`.
- Spéc [OpenAI — Error codes](https://platform.openai.com/docs/guides/error-codes/api-errors) pour le mapping 401/429.
- Spéc [Anthropic — Errors](https://docs.anthropic.com/en/api/errors) pour les codes 400/413.
