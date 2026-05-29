#!/usr/bin/env node

import { mkdir, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const vitePort = 4178;
const appUrl = `http://${host}:${vitePort}/`;
const chromium = process.env.CHROMIUM_BIN || "/usr/bin/chromium-browser";
const tempDir = path.join(os.tmpdir(), `hermes-ui-smoke-${process.pid}`);
const children = new Set();

try {
  const browserProbe = await probeChromium(chromium);
  if (!browserProbe.ok) {
    await runSourceInvariantSmoke(browserProbe.reason);
  } else {
    await runBrowserSmoke();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  for (const child of [...children]) {
    stopChild(child);
  }
  await rm(tempDir, { recursive: true, force: true });
}

async function runBrowserSmoke() {
  await mkdir(tempDir, { recursive: true });
  const vite = spawnChild(path.join(root, "node_modules", ".bin", "vite"), ["--host", host, "--port", String(vitePort), "--strictPort"], { cwd: root });
  await waitForHttp(appUrl, 15_000);

  const browser = spawnChild(
    chromium,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      `--user-data-dir=${tempDir}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { cwd: root },
  );
  const browserWsUrl = await waitForDevToolsUrl(browser, 10_000);
  const debugBaseUrl = browserWsUrl.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/.*$/, "");
  const pageWsUrl = await waitForPageWebSocket(debugBaseUrl, 10_000);
  const page = await CdpSession.connect(pageWsUrl);

  await page.call("Runtime.enable");
  await page.call("Page.enable");
  await page.call("Page.addScriptToEvaluateOnNewDocument", { source: tauriMockSource() });

  for (const theme of ["dark", "light", "blue", "outline"]) {
    await setPersistedState(page, { selectedSection: "overview", appTheme: theme });
    await page.call("Page.navigate", { url: appUrl });
    await waitForRuntime(page, "document.querySelector('.app-shell')", 10_000);
    const result = await page.evaluateJson(`
      ({
        theme: document.documentElement.dataset.theme,
        accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
        shellWidth: Math.round(document.querySelector('.app-shell').getBoundingClientRect().width),
      })
    `);
    assert(result.theme === theme, `Expected theme ${theme}, got ${result.theme}.`);
    assert(result.shellWidth > 300, `App shell did not render for ${theme}.`);
    if (theme === "blue" || theme === "outline") {
      assert(result.accent.toLowerCase() === "#66a5fb", `${theme} accent must be #66a5fb, got ${result.accent}.`);
    }
  }

  await setPersistedState(page, { selectedSection: "overview", appTheme: "outline" });
  await page.call("Page.navigate", { url: appUrl });
  await waitForRuntime(page, "document.querySelector('[data-section=\"sessions\"]')", 10_000);
  await page.evaluate(`document.querySelector('[data-section="sessions"]').click()`);
  await waitForRuntime(page, "document.querySelector('.sessions-layout')", 10_000);

  await page.evaluate(`document.querySelector('[data-section="terminal"]').click()`);
  await waitForRuntime(page, "document.querySelector('.terminal-workspace')", 10_000);
  await waitForRuntime(page, "window.__HERMES_SMOKE_INVOCATIONS__.some((call) => call.cmd === 'start_terminal_session')", 10_000);
  const terminalStart = await page.evaluateJson(`
    window.__HERMES_SMOKE_INVOCATIONS__.find((call) => call.cmd === 'start_terminal_session')
  `);
  assert(terminalStart.args.startupCommandLine === "hermes chat", "Terminal nav should open Hermes Chat by default.");

  await page.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.call("Page.navigate", { url: appUrl });
  await waitForRuntime(page, "document.querySelector('.nav-list')", 10_000);
  const mobile = await page.evaluateJson(`
    ({
      width: window.innerWidth,
      navDisplay: getComputedStyle(document.querySelector('.nav-list')).display,
      hasSettings: Boolean(document.querySelector('[data-section="settings"]')),
    })
  `);
  assert(mobile.width === 390, `Mobile viewport was not applied: ${mobile.width}.`);
  assert(mobile.navDisplay === "flex", `Mobile nav should be horizontal flex, got ${mobile.navDisplay}.`);
  assert(mobile.hasSettings, "Settings nav item should render on mobile.");

  console.log("UI smoke OK: themes, sessions, terminal shell default, and mobile layout checked.");
  page.close();
  stopChild(browser);
  stopChild(vite);
}

async function setPersistedState(page, state) {
  await page.call("Page.navigate", { url: appUrl });
  await waitForRuntime(page, "window.localStorage", 10_000);
  await page.evaluate(`
    localStorage.setItem('hermes-desktop:tauri-ui-state:v1', ${JSON.stringify(JSON.stringify(state))});
  `);
}

async function runSourceInvariantSmoke(browserReason) {
  const [mainSource, stylesSource, themesSource] = await Promise.all([
    readFile(path.join(root, "src/main.ts"), "utf8"),
    readFile(path.join(root, "src/styles.css"), "utf8"),
    readFile(path.join(root, "src/themes.css"), "utf8"),
  ]);
  for (const theme of ['data-theme="dark"', 'data-theme="light"', 'data-theme="blue"', 'data-theme="outline"']) {
    assert(themesSource.includes(theme), `Missing theme selector ${theme}.`);
  }
  assert(themesSource.includes("--accent: #66a5fb"), "DarkBlue/Outline accent must stay #66a5fb.");
  assert(mainSource.includes('case "settings"') && mainSource.includes('case "changelog"'), "Settings and Changelog views must be routed.");
  assert(mainSource.includes("openDefaultShellTerminalTab") && mainSource.includes("openHermesChatTerminalTab({ switchToTerminal: true })"), "Terminal must keep shell button separate and open Hermes Chat by default.");
  assert(mainSource.includes("busyStatus") && mainSource.includes('appBanner(state.busyStatus, "status", "clear-status", true)'), "Long-running busy status must survive section navigation.");
  assert(stylesSource.includes(".settings-layout") && stylesSource.includes(".changelog-layout"), "Settings/Changelog layout styles are missing.");
  console.log(`UI smoke OK: source invariants checked; browser mode skipped (${browserReason}).`);
}

function spawnChild(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function probeChromium(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, reason: error.message });
    });
    child.on("exit", (code) => {
      resolve(code === 0 ? { ok: true } : { ok: false, reason: output.trim() || `${command} exited with code ${code}` });
    });
  });
}

function stopChild(child) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (response) => {
          response.resume();
          resolve();
        })
        .on("error", (error) => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}: ${error.message}`));
            return;
          }
          setTimeout(check, 150);
        });
    };
    check();
  });
}

function waitForDevToolsUrl(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Chromium DevTools URL.")), timeoutMs);
    const onData = (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) {
        return;
      }
      clearTimeout(timeout);
      child.stderr.off("data", onData);
      resolve(match[1]);
    };
    child.stderr.on("data", onData);
  });
}

async function waitForPageWebSocket(debugBaseUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const targets = await readJson(`${debugBaseUrl}/json/list`).catch(() => []);
    const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (page) {
      return page.webSocketDebuggerUrl;
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for Chromium page target.");
}

function readJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForRuntime(page, expression, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const found = await page.evaluateJson(`Boolean(${expression})`);
    if (found) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class CdpSession {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpSession(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) {
        return;
      }
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    return this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      userGesture: true,
    });
  }

  async evaluateJson(expression) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text);
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

function tauriMockSource() {
  return `
    (() => {
      const now = new Date().toISOString();
      const profile = {
        id: 'smoke-host',
        label: 'Smoke Host',
        sshAlias: 'smoke-host',
        sshHost: '127.0.0.1',
        sshPort: null,
        sshUser: 'tester',
        hermesProfile: 'default',
        customHermesHomePath: null,
        createdAt: now,
        updatedAt: now,
        lastConnectedAt: now,
      };
      const snapshot = {
        connections: [profile],
        preferences: {
          activeConnectionId: profile.id,
          appLocale: 'en',
          automaticallyChecksForUpdates: false,
          lastAutomaticUpdateCheckAt: null,
          pinnedSessions: [],
          workspaceFileBookmarks: [],
          workflows: [],
        },
      };
      const discovery = {
        ok: true,
        remote_home: '/home/tester',
        hermes_home: '/home/tester/.hermes',
        active_profile: { name: 'default', path: '/home/tester/.hermes', is_default: true, exists: true },
        available_profiles: [{ name: 'default', path: '/home/tester/.hermes', is_default: true, exists: true }],
        paths: {
          user: '/home/tester/.hermes/USER.md',
          memory: '/home/tester/.hermes/MEMORY.md',
          soul: '/home/tester/.hermes/SOUL.md',
          sessions_dir: '/home/tester/.hermes/sessions',
          cron_jobs: '/home/tester/.hermes/cron',
          kanban_database: null,
        },
        exists: { user: true, memory: true, soul: true, sessions_dir: true, cron_jobs: true, kanban_database: null },
        session_store: null,
        kanban: null,
      };
      window.__HERMES_SMOKE_INVOCATIONS__ = [];
      let callbackId = 1;
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' } },
        convertFileSrc: (path) => path,
        transformCallback: () => callbackId++,
        invoke: async (cmd, args = {}) => {
          window.__HERMES_SMOKE_INVOCATIONS__.push({ cmd, args });
          if (cmd === 'plugin:event|listen') return 1;
          if (cmd === 'plugin:event|unlisten') return null;
          if (cmd === 'app_snapshot') return snapshot;
          if (cmd === 'list_pinned_sessions') return [];
          if (cmd === 'list_workspace_file_bookmarks') return [];
          if (cmd === 'discover_connection') return discovery;
          if (cmd === 'list_sessions') return { ok: true, items: [], total_count: 0 };
          if (cmd === 'start_terminal_session') {
            return {
              id: 'smoke-terminal',
              title: args.startupCommandLine ? 'Smoke Host · chat' : 'Smoke Host · shell',
              profileId: profile.id,
              profileLabel: profile.label,
              hermesProfileName: 'default',
              destination: 'tester@smoke-host',
              workspaceScopeFingerprint: 'smoke',
              hermesHomePath: '/home/tester/.hermes',
              startupCommandLine: args.startupCommandLine,
              initialInput: args.initialInput,
              startedAt: now,
            };
          }
          if (cmd === 'resize_terminal_session') return null;
          if (cmd === 'write_terminal_session') return null;
          if (cmd === 'stop_terminal_session') return null;
          if (cmd === 'session_tui_startup_command') return 'hermes chat';
          throw new Error('Unhandled Tauri command in UI smoke: ' + cmd);
        },
      };
    })();
  `;
}
