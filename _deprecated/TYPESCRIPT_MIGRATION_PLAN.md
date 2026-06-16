# TypeScript Migration Plan for Library, Resolvers, and API

## Overview
This document outlines the plan to migrate all JavaScript and CommonJS files in the `src/library`, `src/resolvers`, and `src/api` folders to TypeScript, ensuring type safety and consistent import/export patterns.

## Current State Analysis

### Dual File System Issue
The `src/api` folder currently has **BOTH** `.js` and `.ts` versions of the same files:
- `coords.js` & `coords.ts`
- `index.js` & `index.ts` 
- `mapmarkers.js` & `mapmarkers.ts`
- `studybuddy.js` & `studybuddy.ts`
- `translate.js` & `translate.ts`
- `utils.js` & `utils.ts`
- `virtualgroup.js` & `virtualgroup.ts`
- Plus: `virtualgroup_test.js` (only .js version)

**CRITICAL DISCOVERY:** The main application (`src/index.ts`) imports from `"./api/index"` which resolves to the **TypeScript version**, but the JavaScript files are still being used internally within the API folder.

## Files to Convert

### Library Files
1. **`src/library/ping.js`** ➔ `src/library/ping.ts`
2. **`src/library/sendbird.js`** ➔ `src/library/sendbird.ts`
3. **`src/library/gpt/index.js`** ➔ `src/library/gpt/index.ts`

### Resolver Files
4. **`src/resolvers/lib.js`** ➔ `src/resolvers/lib.ts`
5. **`src/resolvers/xlate.js`** ➔ `src/resolvers/xlate.ts`

### API Files (Decision Required)
**Current Status:** Dual system exists - both .js and .ts versions
**Main Entry Point:** `src/index.ts` imports from TypeScript version
**Internal Dependencies:** JavaScript files cross-reference each other

**Options:**
- **Option A:** Remove all .js files, ensure all references use .ts
- **Option B:** Remove all .ts files, convert everything to .js then migrate systematically  
- **Option C:** Gradual migration ensuring compatibility

**Recommended:** **Option A** - Eliminate JavaScript versions since TypeScript is already the main entry point.

## Current Dependencies and References

### API Folder Dependencies Analysis

**Key Finding:** The API folder has a complex cross-dependency pattern between .js files:
- `index.js` imports from ALL other .js files with explicit `.js` extensions
- `studybuddy.js` imports from `translate.js` 
- `virtualgroup.js` imports from `studybuddy.js`
- `mapmarkers.js` imports from `utils.js`
- `virtualgroup_test.js` imports from `virtualgroup.js`

**Import Pattern Issues:**
- JavaScript files use explicit `.js` extensions in imports
- TypeScript files use no extensions (proper ES6 style)
- This creates a **module resolution conflict** risk

### External References to API
- **`src/index.ts`** imports `{apis,endpoints}` from `"./api/index"` (resolves to .ts version)
- **No other external references found** - API is self-contained

### 1. `src/library/ping.js`
**Dependencies:**
- `axios` (external npm package)

**Referenced by:**
- `src/index.ts` (import {ping} from "./library/ping")

**Export style:** `module.exports = {ping}`
**Import issues:** Currently imported as ES6 import in TypeScript file

### 2. `src/library/sendbird.js`
**Dependencies:**
- `axios`, `form-data`, `fs`, `crypto`, `is-json` (external packages)
- `./utils/logger.ts` (already converted)

**Referenced by:**
- `src/api/index.js` (CommonJS require with .js extension)
- `src/api/studybuddy.js` (CommonJS require with .js extension)
- `src/api/virtualgroup.js` (CommonJS require with .js extension)
- `src/api/coords.js` (CommonJS require with .js extension)
- `src/resolvers/BomUtils.ts` (ES6 import without extension)
- `src/api/studybuddy.ts` (ES6 import without extension)
- `src/api/virtualgroup.ts` (ES6 import without extension)
- `src/api/coords.ts` (ES6 import without extension)
- `src/resolvers/BomCommunity.ts` (ES6 import without extension)
- `src/resolvers/BomUser.ts` (ES6 import without extension)

**Export style:** `module.exports = { sendbird, getFwdUrl }`
**Import issues:** Mixed import styles - some use .js extension, some don't

### 3. `src/library/gpt/index.js`
**Dependencies:**
- `axios`, `smartquotes`, `dotenv` (external packages)

**Referenced by:**
- `src/api/studybuddy.js` (CommonJS require)
- `src/api/virtualgroup.js` (CommonJS require)
- `src/api/studybuddy.ts` (ES6 import)
- `src/api/virtualgroup.ts` (ES6 import)

**Export style:** `module.exports = {GPT4, askGPT}`
**Import issues:** Mixed import styles between .js and .ts files

### 4. `src/resolvers/lib.js`
**Dependencies:**
- `./_common` (CommonJS require - mixed with ES6 imports! ⚠️)
- `../library/db` (ES6 import)
- `../config/database` (ES6 import)
- `scripture-guide`, `moment` (ES6 imports)

**Referenced by:**
- `src/resolvers/BomNotes.ts` (CommonJS require)
- `src/resolvers/BomScripture.ts` (CommonJS require)
- `src/resolvers/BomUser.ts` (CommonJS require)
- `src/resolvers/BomCommunity.ts` (CommonJS require)
- `src/resolvers/BomPage.ts` (CommonJS require)

**Export style:** `module.exports = { getBlocksToQueue, ... }`
**Import issues:** ⚠️ **CRITICAL** - File already mixes CommonJS require with ES6 imports!

### 5. `src/resolvers/xlate.js`
**Dependencies:**
- None (standalone utility functions)

**Referenced by:**
- `src/resolvers/BomUtils.ts` (ES6 import)

**Export style:** `export const translateReferences = ...` (already ES6!)
**Import issues:** File already uses ES6 exports but has .js extension

### 6. API Folder Files Analysis

#### `src/api/index.js` vs `src/api/index.ts`
**Status:** Dual versions exist with nearly identical functionality
**Key Differences:**
- `.js`: Uses `module.exports = {apis,endpoints}`
- `.ts`: Uses `export {apis,endpoints}`
- `.js`: Imports with explicit `.js` extensions
- `.ts`: Imports without extensions
- `.js`: No type annotations
- `.ts`: Minimal type annotations (`req: any, res: any`)

#### `src/api/studybuddy.js` vs `src/api/studybuddy.ts`
**Status:** Both versions exist, .js has recent fixes we applied
**Issue:** Risk of version divergence

#### Other API Dual Files
- All follow similar pattern: .js uses CommonJS, .ts uses ES6
- TypeScript versions have basic type annotations
- JavaScript versions have explicit `.js` extension imports

## Critical Issues Identified

### 🚨 URGENT: Dual File System
**Most Critical Issue:** Both .js and .ts versions exist in API folder
- **Risk:** Code changes applied to only one version
- **Current State:** Recent logger fixes applied only to .js versions
- **Module Resolution:** Potential for importing wrong file version
- **Maintenance Nightmare:** Changes must be made twice

### 🚨 High Priority Issues
1. **Mixed import/export styles** - `lib.js` uses both `require()` and `import` statements
2. **Import path inconsistencies** - Some files import with .js extension, others without
3. **Type safety gaps** - No TypeScript interfaces for complex objects
4. **Module resolution conflicts** - Risk of importing wrong file version
5. **API folder confusion** - Unclear which file version is authoritative

### ⚠️ Medium Priority Issues
1. **External package types** - Missing @types packages for better type safety
2. **Error handling** - Inconsistent error types across catch blocks
3. **API response validation** - No runtime type checking for external API responses
4. **Cross-dependency complexity** - API files have circular dependency patterns

## Migration Strategy

### Phase 0: Resolve API Dual File System (URGENT)
**Priority:** Immediate - must be done first
1. **Audit differences** between .js and .ts versions in API folder
2. **Merge any recent changes** from .js to .ts versions
3. **Remove all .js files** from API folder
4. **Update any remaining .js imports** to reference library/resolver files correctly
5. **Test main application** to ensure it still works

### Phase 1: Fix Critical Mixed Import Issue  
1. **Convert `src/resolvers/lib.js` first** - It already mixes import styles
2. Update all its imports to be consistent ES6 imports
3. Convert exports to ES6 export statements
4. Add TypeScript types for all function parameters and returns

### Phase 2: Convert Library Files
1. **Convert `src/library/gpt/index.js`**
   - Add types for OpenAI API responses
   - Convert to ES6 imports/exports
2. **Convert `src/library/sendbird.js`**
   - Add comprehensive TypeScript interfaces for Sendbird API
   - Convert to ES6 imports/exports
3. **Convert `src/library/ping.js`**
   - Add types for request/response objects
   - Convert to ES6 imports/exports

### Phase 3: Convert Remaining Resolver Files
1. **Convert `src/resolvers/xlate.js`**
   - Already uses ES6 exports, just needs .ts extension and types

### Phase 4: Final Cleanup and Validation
1. Update all files that import these modules to use consistent import paths
2. Remove .js extensions from imports in TypeScript files  
3. Add explicit .js extensions for JavaScript files that still import these
4. Ensure no remaining .js files in src/api, src/library, src/resolvers

## Detailed Migration Steps

### Step 0: Resolve API Dual File Crisis (IMMEDIATE)
```bash
# 1. Audit differences
for file in coords index mapmarkers studybuddy translate utils virtualgroup; do
  echo "=== Checking $file ==="
  diff src/api/$file.js src/api/$file.ts || echo "Files differ"
done

# 2. Merge recent changes (manual review required)
# - Check for any recent fixes in .js that aren't in .ts
# - Particularly check logger imports we recently fixed

# 3. Remove .js files (after merge)
rm src/api/*.js

# 4. Update any remaining internal references
```

### Step 1: Install Required Type Packages
```bash
npm install --save-dev @types/axios @types/form-data @types/crypto @types/fs-extra
```

### Step 2: Convert `src/resolvers/lib.js` ➔ `src/resolvers/lib.ts`
- Fix mixed import syntax
- Add TypeScript interfaces for database models
- Add return types for all functions
- Convert `module.exports` to individual `export` statements

### Step 3: Convert `src/library/gpt/index.js` ➔ `src/library/gpt/index.ts`
- Add OpenAI API response interfaces
- Add type safety for GPT model selection
- Convert exports to ES6

### Step 4: Convert `src/library/sendbird.js` ➔ `src/library/sendbird.ts`
- Add comprehensive Sendbird API interfaces
- Add error handling types
- Convert to ES6 imports/exports
- Add class-based approach for better type safety

### Step 5: Convert `src/library/ping.js` ➔ `src/library/ping.ts`
- Add Express request/response types
- Convert to ES6 exports

### Step 6: Convert `src/resolvers/xlate.js` ➔ `src/resolvers/xlate.ts`
- Add proper function parameter types
- Keep existing ES6 export style

### Step 7: Final API Cleanup and Validation
- Verify no .js files remain in src/api
- Ensure all TypeScript files in API compile correctly
- Test main application functionality
- Run comprehensive type checking

### Step 8: Update All Import References
- Update 15+ files that import these modules
- Ensure consistent import patterns
- Test all imports work correctly

## API Folder Specific Considerations

### Files to Remove (After Merge)
- `src/api/coords.js`
- `src/api/index.js` 
- `src/api/mapmarkers.js`
- `src/api/studybuddy.js`
- `src/api/translate.js`
- `src/api/utils.js`
- `src/api/virtualgroup.js`
- `src/api/virtualgroup_test.js` (convert to .ts or remove if not needed)

### Changes Needed in Remaining .ts Files
1. **Ensure logger imports are correct** (import from `../library/utils/logger`)
2. **Verify all internal imports work** without .js extensions
3. **Add comprehensive TypeScript types** for all functions
4. **Standardize error handling patterns**

## Risk Assessment

### Critical Risk
- **API Dual File System** - Immediate risk of code divergence and maintenance issues

### High Risk
- **Sendbird.js conversion** - Most complex file with many dependencies
- **Lib.js conversion** - Already has mixed import syntax, widely used
- **API file removal** - Risk of breaking internal dependencies

### Medium Risk
- **Import path updates** - Need to update many files consistently
- **Type compatibility** - Ensuring all type definitions are compatible

### Low Risk
- **Ping.js conversion** - Simple file with minimal dependencies
- **Xlate.js conversion** - Already uses ES6 exports

## Testing Strategy
1. **FIRST:** Resolve API dual file issue and test main application
2. Convert one file at a time  
3. Run TypeScript compilation after each conversion
4. Test all dependent files still import correctly
5. Run application to ensure no runtime errors
6. Use `npx tsc --noEmit` to check for type errors
7. **API-specific:** Test all webhook endpoints and API functionality

## Success Criteria
- [ ] **URGENT:** API dual file system resolved - only .ts files remain
- [ ] All .js files in src/library and src/resolvers converted to .ts  
- [ ] No TypeScript compilation errors
- [ ] All imports work correctly
- [ ] Application runs without runtime import errors
- [ ] Consistent ES6 import/export patterns throughout
- [ ] Proper TypeScript types for all functions and interfaces
- [ ] API endpoints continue to function correctly

## Post-Migration Benefits
1. **Type safety** - Catch errors at compile time
2. **Better IDE support** - IntelliSense and autocompletion
3. **Consistent imports** - All files use same import style
4. **Documentation** - Types serve as inline documentation
5. **Refactoring safety** - TypeScript helps catch breaking changes
6. **Elimination of dual file confusion** - Clear single source of truth
7. **Improved maintainability** - No more parallel file updates

## Rollback Plan
If issues arise, each file conversion can be rolled back individually by:
1. Renaming .ts file back to .js
2. Reverting import statements to original CommonJS style
3. Reverting export statements to module.exports
4. Updating dependent files to use original import paths

**API-specific rollback:** If API cleanup causes issues:
1. Restore .js files from git history
2. Update main index.ts to import from .js version
3. Revert to dual file system temporarily until issues resolved

## Immediate Action Required

### URGENT: API Dual File Audit
Before any other migration work, we must:

1. **Audit each API file pair** for differences
2. **Merge any missing changes** from .js to .ts versions
3. **Particularly check** the logger import fixes we recently applied
4. **Remove .js files** only after confirming .ts versions are complete
5. **Test main application** to ensure functionality is preserved

This dual file system is a **maintenance liability** and must be resolved first to prevent further code divergence.
