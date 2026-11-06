// The type contract of the Dhanya progress pane: the values it keeps in $.state.

export type Status = 'done' | 'in-progress' | 'review' | 'blocked' | 'todo' | 'unknown';

export type Story = {
  /** Step id, for example S1.2. */
  id: string;
  title: string;
  /** Who builds it, as written in the tracker: H, S, S+R or OWNER. */
  tier: string;
  /** What the tracker says, normalised. 'unknown' for a word the pane does not know. */
  status: Status;
  /** The tracker's own status word, kept for display when status is 'unknown'. */
  rawStatus: string;
  note: string;
  /** A decision this step waits on, such as D-08. Empty when none. */
  needsDecision: string;
  /** Epic id taken from the step id: S3.2 belongs to E3. */
  epic: string;
};

export type NeedItem = {
  id: string;
  isOpen: boolean;
  title: string;
  why: string;
  how: string;
  when: string;
};

export type Snapshot = {
  stories: Story[];
  needs: NeedItem[];
  /** A calm sentence when the tracker could not be read, otherwise null. */
  storiesProblem: string | null;
  /** A calm sentence when the needs file could not be read, otherwise null. */
  needsProblem: string | null;
  /** Milliseconds since the epoch when the files were read. */
  at: number;
  /** Where the tracker came from: the remote main branch, the remote branch as last fetched (GitHub not reachable), or the local file. */
  source: SourceKind;
  /** Milliseconds since the epoch of the last good fetch from the remote (0 when unknown). */
  sourceAt: number;
};

export type SourceKind = 'origin' | 'origin-stale' | 'local';

export type PullRequest = { number: number; title: string; branch: string; isDraft: boolean };

export type WorkflowRun = {
  workflow: string;
  /** queued, in_progress or completed. */
  status: string;
  /** success, failure, cancelled ... Empty while the run is not finished. */
  conclusion: string;
  branch: string;
  /** Milliseconds since the epoch when the run was created. */
  at: number;
};

export type GitHubInfo = {
  /** Null when the list of pull requests could not be read. */
  prs: PullRequest[] | null;
  /** Null when the list of workflow runs could not be read. */
  runs: WorkflowRun[] | null;
  /** Milliseconds since the epoch when GitHub was last asked. */
  at: number;
};


export type CodexRun = {
  name: string;
  /** running, done or failed (as the bridge wrote it). */
  state: string;
  /** Minutes since it started (to now while running, to the end when finished). */
  minutes: number;
  /** What Codex is doing right now, in a few words. */
  lastAction: string;
  steps: number;
  files: string[];
  branch: string;
  /** Tokens, when the run has finished and reported them. */
  tokens: number | null;
};

declare module 'claude-code' {
  interface PluginState {
    'dhanya-progress': {
      /** The last reading of the two files. Null until the first reading. */
      snapshot: Shaped<Snapshot | null>;
      /** Epic ids the owner has expanded. */
      openEpics: Shaped<string[]>;
      /** Whether the Done section is expanded. */
      isDoneOpen: Shaped<boolean>;
      /** The latest reading of the Codex runs. */
      codexRuns: Shaped<CodexRun[]>;
      /** The latest reading of open pull requests and workflow runs. Null until the first reading. */
      github: Shaped<GitHubInfo | null>;
    };
  }
}
