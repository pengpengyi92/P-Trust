import { expect, it } from 'vitest';
import { GitHubReader, parseRepository } from '../src/core/github';
it('rejects upstream redirects using the Workers-supported manual mode', async () => {
  let calls = 0;
  const reader = new GitHubReader(async (_url, init) => {
    calls++; expect(init?.redirect).toBe('manual');
    return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
  });
  await expect(reader.metadata(parseRepository('https://github.com/a/b'))).rejects.toMatchObject({ code: 'REDIRECT_REJECTED' });
  expect(calls).toBe(1);
});
