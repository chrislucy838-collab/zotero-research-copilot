import { bootstrapProviderSettings } from "./modules/cpaSettings";

declare const document: Document;

async function renderProviderSettings(): Promise<void> {
  const container = document.getElementById("zrc-provider-settings");
  if (!(container instanceof HTMLElement)) return;
  await bootstrapProviderSettings(document, container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void renderProviderSettings();
  }, { once: true });
} else {
  void renderProviderSettings();
}
