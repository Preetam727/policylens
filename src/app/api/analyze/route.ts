import '@/lib/polyfill';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { anthropic } from '@/lib/anthropicClient';

export const maxDuration = 60; // Allow enough time for parallel LLM queries (standard Vercel limit up to 60s on Hobby/Pro)

// Helper utility to clean and parse JSON blocks returned by Claude
function cleanAndParseJSON(text: string) {
  let cleaned = text.trim();
  // Remove markdown JSON code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse JSON:', cleaned, error);
    return null;
  }
}

// Call a specialist agent
async function callAgent(systemPrompt: string, policyText: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      temperature: 0.1, // low temperature for precise extraction
      system: systemPrompt + '\nCRITICAL: Respond ONLY with a valid JSON object. Do not include markdown code fences, styling, or extra introductory text. Your entire response must be a single parseable JSON object.',
      messages: [
        {
          role: 'user',
          content: `Here is the insurance policy document text:\n\n${policyText.slice(0, 100000)}\n\nExtract and return the structured JSON object now.`,
        },
      ],
    });

    let rawContent = '';
    if (response.content[0].type === 'text') {
      rawContent = response.content[0].text.trim();
    }
    return cleanAndParseJSON(rawContent);
  } catch (err) {
    console.error('Agent call error:', err);
    return null;
  }
}

// Call the synthesis agent to combine and summarize
async function runSynthesisAgent(coverage: any, exclusions: any, limits: any, redFlags: any, policyText: string) {
  const synthesisAgentPrompt = `You are a helpful insurance advisor. You will receive the extracted analyses from four specialized agents (Coverage details, Exclusions, Limits & Deductibles, and Red Flags) along with the first 4,000 characters of the policy document itself.
Your job is to:
1. Synthesize these inputs and write exactly a 3-sentence plain-English summary of the overall policy. Keep it clear, professional, and easy to understand.
2. Infer the insurer name (e.g. Progressive, Aetna, Geico, Blue Cross, Liberty Mutual, State Farm, Allstate, etc.) from the provided policy text and context. If not found, output "Unknown".
3. Infer the policy type (e.g. Auto, Health, Homeowners, Renters, Commercial, Travel, Life, etc.) from the provided policy text and context. If not found, output "Unknown".

Return JSON in this exact structure:
{
  "summary": "First sentence. Second sentence. Third sentence.",
  "insurer_name": "Inferred Insurer Name",
  "policy_type": "Inferred Policy Type"
}`;

  const promptContent = `
First 4000 characters of the policy document (for metadata inference like insurer name and policy type):
"""
${policyText.slice(0, 4000)}
"""

Coverage Agent Output:
${JSON.stringify(coverage)}

Exclusions Agent Output:
${JSON.stringify(exclusions)}

Limits Agent Output:
${JSON.stringify(limits)}

Red Flags Agent Output:
${JSON.stringify(redFlags)}
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0.2,
      system: synthesisAgentPrompt + '\nCRITICAL: Respond ONLY with a valid JSON object. Do not include markdown blocks, code fences, or any text other than the JSON.',
      messages: [
        {
          role: 'user',
          content: `Here are the reports from the 4 specialists. Synthesize them and return the requested JSON object now:\n\n${promptContent}`,
        },
      ],
    });

    let rawContent = '';
    if (response.content[0].type === 'text') {
      rawContent = response.content[0].text.trim();
    }
    return cleanAndParseJSON(rawContent);
  } catch (err) {
    console.error('Synthesis agent call error:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    // Create a deep copy of the buffer to prevent it from being neutered (zeroed out)
    // when arrayBuffer is parsed asynchronously by PDFParse.
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // 1. Text Extraction
    let extractedText = '';

    if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

        const { PDFParse } = await import('pdf-parse');
        PDFParse.setWorker(workerPath);

        const parser = new PDFParse({ data: arrayBuffer });
        const parsedTextResult = await parser.getText();
        extractedText = parsedTextResult.text || '';
      } catch (err: any) {
        console.error('PDF parsing error:', err);
        return NextResponse.json({ error: 'Failed to parse PDF document: ' + err.message }, { status: 500 });
      }
    } else if (fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
      try {
        // Use Claude Vision to extract text
        const base64Image = buffer.toString('base64');
        let mediaType = fileType;
        if (mediaType === 'image/jpg') mediaType = 'image/jpeg';
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
          mediaType = 'image/jpeg';
        }

        const ocrResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: 'You are a highly accurate document transcription system. Extract and return all text from the provided image of a document. Output ONLY the extracted text. Do not include any introductory or concluding remarks.',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType as any,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: 'Please transcribe all text from this image.',
                },
              ],
            },
          ],
        });

        if (ocrResponse.content[0].type === 'text') {
          extractedText = ocrResponse.content[0].text || '';
        }
      } catch (err: any) {
        console.error('Image OCR error:', err);
        return NextResponse.json({ error: 'Failed to extract text from image: ' + err.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file format. Please upload a PDF or an image (PNG, JPEG, WebP).' }, { status: 400 });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: 'No readable text could be extracted from the document.' }, { status: 422 });
    }

    // 2. Upload original file to Supabase Storage (policy-docs bucket)
    const fileExt = file.name.split('.').pop();
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `uploads/${uniqueFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('policy-docs')
      .upload(filePath, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload document to storage: ' + uploadError.message }, { status: 500 });
    }

    // Get the public URL of the uploaded document
    const { data: { publicUrl } } = supabase.storage
      .from('policy-docs')
      .getPublicUrl(filePath);

    // 3. Insert initial policy record into the "policies" table
    const { data: policyRecord, error: policyError } = await supabase
      .from('policies')
      .insert({
        file_name: file.name,
        file_url: publicUrl,
        insurer_name: 'Analyzing...',
        policy_type: 'Analyzing...',
        user_id: userId || null,
      })
      .select()
      .single();

    if (policyError) {
      console.error('Supabase policies insert error:', policyError);
      return NextResponse.json({ error: 'Failed to create policy entry: ' + policyError.message }, { status: 500 });
    }

    const policyId = policyRecord.id;

    // 4. Run the 4 parallel Claude API calls using Promise.all
    const coverageAgentPrompt = `You are an insurance coverage specialist. Extract what is covered in plain English. Return JSON: {coverages: [{item, description}]}`;
    const exclusionsAgentPrompt = `Extract all exclusions and fine print. Return JSON: {exclusions: [{item, risk_level: 'high'|'medium'|'low', description}]}`;
    const limitsAgentPrompt = `Extract all claim limits, sub-limits, deductibles, and excess amounts. Return JSON: {limits: [{item, amount, notes}]}`;
    const redFlagsAgentPrompt = `Identify unusual clauses a policyholder should question. Return JSON: {red_flags: [{flag, severity: 'high'|'medium', explanation}]}`;

    const [coverageRes, exclusionsRes, limitsRes, redFlagsRes] = await Promise.all([
      callAgent(coverageAgentPrompt, extractedText),
      callAgent(exclusionsAgentPrompt, extractedText),
      callAgent(limitsAgentPrompt, extractedText),
      callAgent(redFlagsAgentPrompt, extractedText),
    ]);

    // 5. Synthesis Agent combines outputs for a 3-sentence summary and meta info
    const synthesisRes = await runSynthesisAgent(
      coverageRes || { coverages: [] },
      exclusionsRes || { exclusions: [] },
      limitsRes || { limits: [] },
      redFlagsRes || { red_flags: [] },
      extractedText
    );

    const summaryStr = synthesisRes?.summary || 'Comprehensive policy report compiled successfully.';
    const insurerName = synthesisRes?.insurer_name || 'Unknown';
    const policyType = synthesisRes?.policy_type || 'Unknown';

    // 6. Save the structured JSON report to the "reports" table
    const { data: reportRecord, error: reportError } = await supabase
      .from('reports')
      .insert({
        policy_id: policyId,
        snapshot: { summary: summaryStr },
        coverages: coverageRes || { coverages: [] },
        exclusions: exclusionsRes || { exclusions: [] },
        limits: limitsRes || { limits: [] },
        red_flags: redFlagsRes || { red_flags: [] },
        status: 'completed',
      })
      .select()
      .single();

    if (reportError) {
      console.error('Supabase reports insert error:', reportError);
      return NextResponse.json({ error: 'Failed to save analysis report: ' + reportError.message }, { status: 500 });
    }

    // 7. Update policies table with deduced insurer name and policy type
    const { error: updatePolicyError } = await supabase
      .from('policies')
      .update({
        insurer_name: insurerName,
        policy_type: policyType,
      })
      .eq('id', policyId);

    if (updatePolicyError) {
      console.error('Supabase policies update error:', updatePolicyError);
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      policy: {
        id: policyId,
        file_name: file.name,
        file_url: publicUrl,
        insurer_name: insurerName,
        policy_type: policyType,
        created_at: policyRecord.created_at,
      },
      report: {
        id: reportRecord.id,
        policy_id: policyId,
        snapshot: { summary: summaryStr },
        coverages: coverageRes || { coverages: [] },
        exclusions: exclusionsRes || { exclusions: [] },
        limits: limitsRes || { limits: [] },
        red_flags: redFlagsRes || { red_flags: [] },
        status: 'completed',
        created_at: reportRecord.created_at,
      },
    });
  } catch (error: any) {
    console.error('API analyze route error:', error);
    return NextResponse.json({ error: 'An internal server error occurred: ' + error.message }, { status: 500 });
  }
}
