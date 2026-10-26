#!/usr/bin/env node
import { main } from "./cli";

const code = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  log: (m) => console.log(m),
  error: (m) => console.error(m),
});
process.exit(code);
