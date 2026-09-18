#!/usr/bin/env node

import { runCli } from "../src/cli.mjs";
import { printCliError } from "../src/ui.mjs";

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  printCliError(error);
  process.exitCode = 1;
}
