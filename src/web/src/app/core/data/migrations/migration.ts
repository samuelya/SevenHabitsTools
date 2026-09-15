/** One schema version step. `migrate()` receives the raw parsed document, not a typed `RootDocument`. */
export interface Migration {
  readonly from: number;
  readonly to: number;
  migrate(doc: Record<string, unknown>): Record<string, unknown>;
}
