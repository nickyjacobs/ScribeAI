// src/utils/github.ts

export interface GitHubProfile {
  login:        string;
  name:         string;
  bio:          string;
  location:     string;
  blog:         string;
  company:      string;
  public_repos: number;
  followers:    number;
  html_url:     string;
}

export interface GitHubRepo {
  name:              string;
  description:       string;
  language:          string;
  stargazers_count:  number;
  html_url:          string;
  topics:            string[];
  fork:              boolean;
}

export async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: { 'User-Agent': 'ScribeAI/1.0' },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`GitHub gebruiker niet gevonden: "${username}"`);
    throw new Error(`GitHub API fout (${res.status}): ${res.statusText}`);
  }
  return res.json() as Promise<GitHubProfile>;
}

export async function fetchGitHubRepos(username: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=20&type=owner`,
    { headers: { 'User-Agent': 'ScribeAI/1.0' } }
  );
  if (!res.ok) throw new Error(`Kon repositories niet ophalen (${res.status})`);
  const repos = await res.json() as GitHubRepo[];
  // Filter forks, sorteer op stars
  return repos
    .filter(r => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
}

/**
 * Formatteert GitHub data als Markdown-context die de agent kan verwerken in het CV.
 */
export function formatGitHubContext(profile: GitHubProfile, repos: GitHubRepo[]): string {
  const languages = [...new Set(
    repos.filter(r => r.language).map(r => r.language)
  )].slice(0, 10);

  const topRepos = repos
    .filter(r => r.description)
    .slice(0, 8)
    .map(r => {
      const stars  = r.stargazers_count > 0 ? ` ⭐ ${r.stargazers_count}` : '';
      const lang   = r.language ? ` [${r.language}]` : '';
      const topics = r.topics?.length ? ` · ${r.topics.join(', ')}` : '';
      return `- **${r.name}**${lang}${stars}: ${r.description}${topics}`;
    })
    .join('\n');

  const lines: string[] = [
    `## GitHub Data — ${profile.login}`,
    '',
    `**Naam:** ${profile.name || profile.login}`,
  ];
  if (profile.bio)      lines.push(`**Bio:** ${profile.bio}`);
  if (profile.location) lines.push(`**Locatie:** ${profile.location}`);
  if (profile.company)  lines.push(`**Bedrijf:** ${profile.company}`);
  if (profile.blog)     lines.push(`**Website:** ${profile.blog}`);
  lines.push(`**Profiel:** ${profile.html_url}`);
  lines.push(`**Publieke repos:** ${profile.public_repos} | **Followers:** ${profile.followers}`);
  lines.push('');
  lines.push(`**Programmeertalen (uit repos):** ${languages.join(', ')}`);
  lines.push('');
  lines.push('**Meest relevante projecten:**');
  lines.push(topRepos || '_(geen repos met beschrijving)_');

  return lines.join('\n');
}
