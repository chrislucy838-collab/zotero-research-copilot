export function isScreenshotUnsupportedModel(modelName: string): boolean {
  const normalized = modelName.trim().toLowerCase();
  return /^deepseek-(?:chat|reasoner)(?:$|[.-])/.test(normalized);
}

export function getScreenshotDisabledHint(modelName: string): string {
  const label = modelName.trim() || "current model";
  return `Screenshots are disabled for ${label}`;
}
