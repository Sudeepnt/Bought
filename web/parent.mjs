// Loaded with --import when pipeline/server.py starts this server: it exits when the pipe from its parent closes,
// so however the parent stops it can't leave one behind holding the port (the same as backend/server.ts).
if (process.env.BOUGHT_WEB_PARENT) {
  process.stdin.on("end", () => process.exit(0));
  process.stdin.resume();
}
