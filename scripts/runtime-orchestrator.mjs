import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const mode = process.argv[2] || 'standalone';
const isDockerMode = mode === 'docker';

const PORT_API = process.env.PORT_API || process.env.PORT || '9902';
const PORT_APP = process.env.PORT_APP || '9901';
const inheritedNpmExecPath = process.env.npm_execpath;
const npmRunner = inheritedNpmExecPath
  ? {
      command: process.execPath,
      argsPrefix: [inheritedNpmExecPath],
    }
  : {
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      argsPrefix: [],
    };

const managed = [];
let shuttingDown = false;

const prefixed = (prefix) => (chunk) => {
  process.stdout.write(`[${prefix}] ${chunk.toString()}`);
};

function spawnNpmScript(name, script, extraArgs, env) {
  return spawnManaged(
    name,
    npmRunner.command,
    [...npmRunner.argsPrefix, 'run', script, ...extraArgs],
    env
  );
}

function spawnManaged(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', prefixed(name));
  child.stderr.on('data', prefixed(name));

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[runtime] ${name} exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    shutdown(code ?? 1);
  });

  child.on('error', (err) => {
    if (shuttingDown) return;
    console.error(`[runtime] failed to start ${name}: ${err.message}`);
    shutdown(1);
  });

  managed.push({ name, child });
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of managed) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const { child } of managed) {
      if (!child.killed) child.kill('SIGKILL');
    }
    process.exit(exitCode);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[runtime] mode=${mode}`);
console.log(`[runtime] DATA_ROOT=${process.env.DATA_ROOT || '<unset>'}`);

const backendEnv = {
  ...process.env,
  PORT: PORT_API,
};
spawnNpmScript('backend', 'server', [], backendEnv);

if (!isDockerMode) {
  const websiteEnv = {
    ...process.env,
    PORT: PORT_APP,
  };
  spawnNpmScript('website', 'dev', ['--', '--clearScreen', 'false'], websiteEnv);
  console.log(`[runtime] website server on port ${PORT_APP}; backend on port ${PORT_API}`);
} else {
  console.log(`[runtime] docker mode: backend serves built website on port ${PORT_API}`);
}
