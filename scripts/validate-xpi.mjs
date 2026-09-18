import fs from "node:fs";
import process from "node:process";
import AdmZip from "adm-zip";

const [, , xpiPath, expectedVersion] = process.argv;

if (!xpiPath || !expectedVersion) {
  console.error(
    "Usage: node scripts/validate-xpi.mjs <xpi-path> <expected-version>",
  );
  process.exit(2);
}

if (!fs.existsSync(xpiPath)) {
  console.error(`XPI not found: ${xpiPath}`);
  process.exit(1);
}

const stat = fs.statSync(xpiPath);
if (stat.size <= 0) {
  console.error(`XPI is empty: ${xpiPath}`);
  process.exit(1);
}

let zip;
try {
  zip = new AdmZip(xpiPath);
} catch (error) {
  console.error(`XPI is not a readable ZIP: ${error}`);
  process.exit(1);
}

const manifestEntry = zip.getEntry("manifest.json");
if (!manifestEntry || manifestEntry.header.size <= 0) {
  console.error("XPI manifest.json is missing or empty");
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
} catch (error) {
  console.error(`XPI manifest.json is invalid JSON: ${error}`);
  process.exit(1);
}

const zotero = manifest.applications?.zotero;
const checks = [
  [manifest.manifest_version === 2, "manifest_version must be 2"],
  [manifest.version === expectedVersion, `version must be ${expectedVersion}`],
  [
    typeof manifest.name === "string" && manifest.name.length > 0,
    "name is required",
  ],
  [
    typeof zotero?.id === "string" && zotero.id.length > 0,
    "Zotero addon id is required",
  ],
  [zotero?.strict_min_version === "10.0", "strict_min_version must be 10.0"],
  [
    zotero?.strict_max_version === "10.0.*",
    "strict_max_version must be 10.0.*",
  ],
];

const failed = checks.find(([passed]) => !passed);
if (failed) {
  console.error(`Invalid XPI manifest: ${failed[1]}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      xpiPath,
      size: stat.size,
      manifestBytes: manifestEntry.header.size,
      version: manifest.version,
      id: zotero.id,
      strictMinVersion: zotero.strict_min_version,
      strictMaxVersion: zotero.strict_max_version,
    },
    null,
    2,
  ),
);
