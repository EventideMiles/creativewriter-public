# CommonJS to ESM Migration Plan

## Current CommonJS Dependencies Analysis

### 1. **hammerjs** (SAFE TO REMOVE)
- **Current Usage**: Only imported in `main.ts`, no actual gesture handlers found
- **Risk**: LOW - Not actively used
- **Action**: Remove completely

### 2. **jszip** (NEEDS REPLACEMENT)
- **Current Usage**: Used in `novelcrafter-import.service.ts` for ZIP file handling
- **Risk**: MEDIUM - Critical for import functionality
- **Action**: Replace with `@progress/jszip-esm`

### 3. **html2canvas** (INDIRECT DEPENDENCY)
- **Current Usage**: Not directly used, only via jspdf
- **Risk**: LOW - Only affects PDF export
- **Action**: Keep as-is for now, monitor jspdf updates

### 4. **canvg & core-js** (INDIRECT DEPENDENCIES)
- **Current Usage**: Via html2canvas/jspdf chain
- **Risk**: LOW - Only affects PDF export
- **Action**: No immediate action needed

## Safe Migration Steps

### Phase 1: Remove Unused hammerjs (SAFE)
```bash
npm uninstall hammerjs
# Remove import from main.ts
```

### Phase 2: Replace jszip with ESM version (TESTED)
```bash
npm uninstall jszip
npm install @progress/jszip-esm
# Update imports in novelcrafter-import.service.ts
```

### Phase 3: Test Thoroughly
1. Test NovelCrafter import functionality
2. Test PDF export functionality
3. Run full test suite

## Rollback Plan

If any issues occur:

### Quick Rollback
```bash
git revert HEAD
npm install
```

### Manual Rollback
```bash
# Restore hammerjs if needed
npm install hammerjs@^2.0.8

# Restore original jszip if needed
npm uninstall @progress/jszip-esm
npm install jszip@^3.10.1
```

## Expected Performance Improvements

- **Bundle Size**: ~50-100KB reduction
- **Tree Shaking**: Better optimization
- **Build Speed**: Faster builds
- **Mobile Performance**: Less JavaScript to parse

## Risk Assessment

| Module | Risk Level | Impact if Fails | Rollback Time |
|--------|------------|-----------------|---------------|
| hammerjs | LOW | None | 1 minute |
| jszip | MEDIUM | Import broken | 5 minutes |
| html2canvas | LOW | PDF export broken | N/A (no change) |

## Testing Checklist

- [ ] NovelCrafter import works
- [ ] PDF export works
- [ ] No console errors
- [ ] Bundle size reduced
- [ ] Build succeeds without warnings