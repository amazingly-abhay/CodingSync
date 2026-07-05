import { pluginManager } from '../core/PluginManager.js';
import { LeetCodePlugin } from './leetcode/LeetCodePlugin.js';
import { CodeforcesPlugin } from './codeforces/CodeforcesPlugin.js';
import { GFGPlugin } from './gfg/GFGPlugin.js';
import { CodeChefPlugin } from './codechef/CodeChefPlugin.js';
import { AtCoderPlugin } from './atcoder/AtCoderPlugin.js';

[LeetCodePlugin, CodeforcesPlugin, GFGPlugin, CodeChefPlugin, AtCoderPlugin]
  .forEach(P => pluginManager.register(new P()));
