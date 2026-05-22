import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropicClient';

export const maxDuration = 60; // Allow sufficient duration for LLM queries

export async function POST(request: NextRequest) {
  try {
    const { report, messages } = await request.json();

    if (!report) {
      return NextResponse.json({ error: 'Missing policy report context' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid chat messages history' }, { status: 400 });
    }

    const systemPrompt = `You are "PolicyLens AI", a professional and friendly insurance assistant.
You are helping the user understand their insurance policy based on the structured analysis report provided below.

Here is the structured analysis report of the policy:
${JSON.stringify(report, null, 2)}

Your instructions:
1. Answer the user's questions accurately, clearly, and concisely, relying ONLY on the facts and data contained in the structured report above.
2. If the user asks about something that is not mentioned in the report, politely explain that this information is not available in the extracted policy analysis, and recommend checking the original policy document.
3. Be professional, friendly, and objective. Do not make up or assume any coverage terms, exclusions, limits, or red flags that are not explicitly stated in the report.
4. Keep answers readable by using simple paragraph breaks or bullet points where appropriate.`;

    // Map messages to Anthropic format: role 'user' or 'assistant', content as string
    const formattedMessages = messages.map((m: any) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content || '',
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: formattedMessages,
    });

    let botMessage = '';
    if (response.content[0].type === 'text') {
      botMessage = response.content[0].text;
    }

    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content: botMessage,
      },
    });
  } catch (error: any) {
    console.error('API chat route error:', error);
    return NextResponse.json({ error: 'An error occurred: ' + error.message }, { status: 500 });
  }
}
