import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import {join} from 'node:path';

const run = promisify(execFile);
const color = /^#[\da-f]{6}$/i;

// Only explicit desktop appearance fields can leave the host. Ghostty may also
// print commands, paths, environment variables and key bindings.
export function appearanceFromConfig(text, platform) {
  const profile = {};
  const families = [];
  for (const line of text.split('\n')) {
    const match = /^([a-z-]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'font-family' && value.length <= 120 && !/[\u0000-\u001f;{}]/.test(value)) families.push(value);
    if (key === 'font-size' && Number.isFinite(Number(value)) && Number(value) > 0) {
      const scale = platform === 'darwin' ? 1 : 96 / 72;
      profile.fontSize = Math.max(10, Math.min(20, Math.round(Number(value) * scale)));
    }
    if ((key === 'background' || key === 'foreground') && color.test(value)) profile[key] = value;
    if (key === 'window-padding-x' || key === 'window-padding-y') {
      const pair = /^(\d+)(?:\s*,\s*(\d+))?$/.exec(value);
      if (pair) profile[key.endsWith('x') ? 'paddingX' : 'paddingY'] = [pair[1],pair[2] ?? pair[1]].map(n => Math.min(64, Number(n)));
    }
  }
  profile.fontFamily = [...new Set(families)].join(', ').slice(0,200);
  return profile;
}

export async function readGhostty() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Ghostty.app/Contents/MacOS/ghostty', join(homedir(),'Applications/Ghostty.app/Contents/MacOS/ghostty'), '/opt/homebrew/bin/ghostty']
    : ['/usr/bin/ghostty', '/usr/local/bin/ghostty', '/run/current-system/sw/bin/ghostty'];
  for (const executable of candidates) {
    try {
      const {stdout} = await run(executable, ['+show-config','--changes-only=false'], {timeout:3500, maxBuffer:1024*1024});
      return appearanceFromConfig(stdout, process.platform);
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Ghostty 无法读取配置');
    }
  }
  throw new Error('未找到 Ghostty');
}
