import { migratePreferences } from "./preferenceMigration";

describe("migratePreferences", () => {
  it("maps legacy dark_mode to darkMode and removes the old key", () => {
    const result = migratePreferences({ dark_mode: true, sound: true });
    expect(result.darkMode).toBe(true);
    expect(result).not.toHaveProperty("dark_mode");
    expect(result.sound).toBe(true);
  });

  it("keeps an existing darkMode value over legacy dark_mode", () => {
    const result = migratePreferences({ darkMode: true, dark_mode: false });
    expect(result.darkMode).toBe(true);
  });

  it("does not clobber an explicit darkMode:false with a truthy dark_mode", () => {
    const result = migratePreferences({ darkMode: false, dark_mode: true });
    expect(result.darkMode).toBe(false);
  });

  it("falls back to the OS preference when neither key exists", () => {
    expect(migratePreferences({}, true).darkMode).toBe(true);
    expect(migratePreferences({}, false).darkMode).toBe(false);
  });

  it("returns a defaulted object when given null", () => {
    expect(migratePreferences(null, true).darkMode).toBe(true);
  });
});
