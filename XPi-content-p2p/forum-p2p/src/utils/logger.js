export function log(scope, message, extra) {
  const line = `[${new Date().toISOString()}] [${scope}] ${message}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}
