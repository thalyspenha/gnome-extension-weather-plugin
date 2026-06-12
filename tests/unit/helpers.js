// tests/unit/helpers.js
let _passed = 0;
let _failed = 0;

export function assert(condition, msg) {
    if (condition) {
        print(`  ✓ ${msg}`);
        _passed++;
    } else {
        print(`  ✗ ${msg}`);
        _failed++;
    }
}

export function assertEqual(actual, expected, msg) {
    const ok = actual === expected;
    if (!ok) print(`    got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    assert(ok, msg);
}

export function summary(suiteName) {
    print(`\n${suiteName}: ${_passed} passed, ${_failed} failed`);
    if (_failed > 0) imports.system.exit(1);
}
