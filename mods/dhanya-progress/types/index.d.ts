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
    };
  }
}
