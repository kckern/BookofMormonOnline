import { test, expect } from '@playwright/test'
import { safeJson } from '../../app/_components/JsonLd'

test.describe('safeJson escaping', () => {
  test('escapes < so a </script> in content cannot break out', () => {
    const out = safeJson({ description: 'closes </script> here' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
    // round-trips: JSON parsers decode < back to <
    expect(JSON.parse(out).description).toBe('closes </script> here')
  })
})
