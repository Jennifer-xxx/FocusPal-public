import { existsSync, rmSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const databaseNames = ["focuspal.db", "focuspal.db-shm", "focuspal.db-wal"];
const appDirectoryCandidates = getAppDirectoryCandidates();
const deleted = [];

for (const directory of appDirectoryCandidates) {
  for (const databaseName of databaseNames) {
    const filePath = join(directory, databaseName);

    if (!existsSync(filePath)) {
      continue;
    }

    rmSync(filePath, { force: true });
    deleted.push(filePath);
  }
}

if (deleted.length === 0) {
  console.log("No FocusPal demo database files found.");
} else {
  console.log("Deleted FocusPal demo database files:");
  for (const filePath of deleted) {
    console.log(`- ${filePath}`);
  }
}

function getAppDirectoryCandidates() {
  const home = homedir();

  switch (platform()) {
    case "darwin":
      return [
        join(home, "Library", "Application Support", "com.focuspal.app"),
        join(home, "Library", "Application Support", "FocusPal"),
      ];
    case "win32":
      return [
        join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "com.focuspal.app"),
        join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "FocusPal"),
      ];
    default:
      return [
        join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "com.focuspal.app"),
        join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "FocusPal"),
      ];
  }
}
