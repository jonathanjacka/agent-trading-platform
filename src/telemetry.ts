/**
 * Langfuse OpenTelemetry instrumentation for AI agent tracing
 *
 * Sets up the Langfuse span processor to capture all AI SDK
 * telemetry and send it to Langfuse for visualization.
 *
 * IMPORTANT: must be imported BEFORE any AI SDK calls.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { Logger } from './utils/logger.js';

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;

let sdk: NodeSDK | null = null;
let langfuseProcessor: LangfuseSpanProcessor | null = null;

if (publicKey && secretKey) {
  langfuseProcessor = new LangfuseSpanProcessor();

  sdk = new NodeSDK({
    spanProcessors: [langfuseProcessor],
  });

  sdk.start();
  Logger.success('Langfuse telemetry initialized');
} else {
  Logger.warn(
    'Langfuse keys not configured - telemetry disabled. Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable.'
  );
}

// Force flush all pending traces to Langfuse - call this before process exit to ensure all traces are sent
export async function flushTelemetry(): Promise<void> {
  if (langfuseProcessor) {
    await langfuseProcessor.forceFlush();
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

export { langfuseProcessor };
