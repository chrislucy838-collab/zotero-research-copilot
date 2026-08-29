import { config } from "../../package.json";
import { fetchCustomEndpointModels } from "../utils/cpaModels";
import { getProviderConfig, parseProviderHeaders, setProviderConfig } from "../utils/providerConfig";

function prefKey(name: string): string {
  return `${config.prefsPrefix}.${name}`;
}

function setPref(name: string, value: string): void {
  Zotero.Prefs.set(prefKey(name), value, true);
}

function el<T extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: T,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[T] {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "textContent") node.textContent = value;
    else node.setAttribute(key, value);
  }
  return node;
}

export async function bootstrapProviderSettings(
  doc: Document,
  container: HTMLElement,
): Promise<void> {
  container.replaceChildren();
  const root = el(doc, "div", { class: "zrc-provider-settings" });
  const title = el(doc, "h2", { textContent: "OpenAI-compatible provider" });
  const hint = el(doc, "p", {
    textContent:
      "Configure any OpenAI-compatible API. API keys and custom headers stay in Zotero preferences.",
  });
  const provider = getProviderConfig();
  const savedModel = String(Zotero.Prefs.get(prefKey("model"), true) ?? "").trim();
  const form = el(doc, "div");
  form.style.cssText = "display:grid;gap:10px;max-width:760px;padding:16px;";

  const baseLabel = el(doc, "label", { textContent: "API base URL" });
  const base = el(doc, "input", {
    type: "url",
    value: provider.apiBase,
    placeholder: "https://api.example.com/v1",
  });
  const nameLabel = el(doc, "label", { textContent: "Provider name" });
  const name = el(doc, "input", { type: "text", value: provider.name });
  const headersLabel = el(doc, "label", { textContent: "Custom headers (JSON)" });
  const headers = el(doc, "textarea", { type: "text" });
  headers.value = JSON.stringify(provider.headers, null, 2);
  const keyLabel = el(doc, "label", { textContent: "API key" });
  const key = el(doc, "input", { type: "password", value: provider.apiKey });
  const modelLabel = el(doc, "label", { textContent: "Model" });
  const model = el(doc, "select", { id: "zrc-cpa-model" });
  model.style.cssText = "min-height:2em;";
  const manualModel = el(doc, "input", {
    type: "text",
    placeholder: "Enter a model ID manually",
  });
  manualModel.style.display = "none";
  const renderModels = (entries: Array<{ id: string; label?: string }>) => {
    model.replaceChildren();
    for (const entry of entries) {
      model.append(el(doc, "option", {
        value: entry.id,
        textContent: entry.label || entry.id,
      }));
    }
    if (savedModel && !entries.some((entry) => entry.id === savedModel)) {
      model.append(el(doc, "option", { value: savedModel, textContent: `${savedModel} (saved)` }));
    }
    model.append(el(doc, "option", { value: "__manual__", textContent: "Enter model ID manually…" }));
    if (savedModel && entries.some((entry) => entry.id === savedModel)) {
      model.value = savedModel;
    } else if (savedModel) {
      model.value = savedModel;
    } else {
      model.value = entries[0]?.id || "__manual__";
    }
    manualModel.style.display = model.value === "__manual__" ? "block" : "none";
    if (model.value === "__manual__") manualModel.value = savedModel;
  };
  renderModels([]);
  const status = el(doc, "div", { role: "status" });
  status.style.cssText = "min-height:1.4em;";
  const actions = el(doc, "div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  const fetchButton = el(doc, "button", { type: "button", textContent: "Fetch models" });
  const saveButton = el(doc, "button", { type: "button", textContent: "Save" });
  actions.append(fetchButton, saveButton);

  const persist = () => {
    const apiBase = base.value.trim().replace(/\/+$/, "");
    const customHeaders = parseProviderHeaders(headers.value);
    setProviderConfig({ name: name.value, apiBase, apiKey: key.value, headers: customHeaders });
    const selectedModel = model.value === "__manual__" ? manualModel.value : model.value;
    setPref("model", selectedModel.trim());
    setPref("modelPrimary", selectedModel.trim());
    status.textContent = "Saved.";
  };

  fetchButton.addEventListener("click", async () => {
    persist();
    fetchButton.disabled = true;
    status.textContent = "Fetching models…";
    try {
      const models = await fetchCustomEndpointModels(base.value, key.value, parseProviderHeaders(headers.value));
      renderModels(models);
      setPref("providerModelCache", JSON.stringify(models));
      setPref("cpaModelCache", JSON.stringify(models));
      persist();
      status.textContent = `Found ${models.length} model${models.length === 1 ? "" : "s"}.`;
    } catch (error) {
      status.textContent = `Model fetch failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      fetchButton.disabled = false;
    }
  });
  saveButton.addEventListener("click", persist);
  model.addEventListener("change", () => {
    manualModel.style.display = model.value === "__manual__" ? "block" : "none";
    persist();
  });
  manualModel.addEventListener("change", persist);
  for (const input of [base, key]) input.addEventListener("change", persist);

  form.append(nameLabel, name, baseLabel, base, keyLabel, key, headersLabel, headers, modelLabel, model, manualModel, actions, status);
  root.append(title, hint, form);
  container.append(root);
}

