export const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Svelte: '#ff3e00',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  Nix: '#7e7eff',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dockerfile: '#384d54',
  Vue: '#41b883',
  Astro: '#ff5a03',
  Lua: '#000080',
  Zig: '#ec915c',
  Nim: '#ffc200',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Dart: '#00B4AB',
  Makefile: '#427819',
  Vim: '#199f4b',
  Perl: '#0298c3',
  Scala: '#c22d40',
  'Objective-C': '#438eff'
};

export function getLanguageColor(name: string): string {
  return GITHUB_LANGUAGE_COLORS[name] ?? '#909692';
}
