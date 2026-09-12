import handler from 'vinext/server/fetch-handler';

type ScheduledController = unknown;
type ExecutionContext = unknown;

const worker = {
  fetch: handler.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    if (!env.APP_ORIGIN || !env.CRON_SECRET)
      throw new Error('BOUGHT scheduler is not configured.');
    const response = await handler.fetch(
      new Request(`${env.APP_ORIGIN}/api/bought/cron`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
      ctx,
    );
    if (!response.ok)
      throw new Error(`BOUGHT auction transition failed (${response.status}).`);
  },
};

export default worker;
