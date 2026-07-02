import { eventBus } from '@/lib/eventEmitter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 1000\n\n'));

      const onUpdate = (eventData: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
        } catch (e) {
          // ignore
        }
      };

      eventBus.on('features_updated', onUpdate);

      request.signal.addEventListener('abort', () => {
        eventBus.off('features_updated', onUpdate);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
  eventBus.emit('features_updated', { time: Date.now() });
  return Response.json({ success: true });
}
