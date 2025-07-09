import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Groq from "groq-sdk"

interface ArticleData {
  title: string
  content: string
  author: string
  publishDate: string
  url: string
  domain?: string
  images?: string[];
}

interface ExternalEvidence {
  title: string;
  url: string;
  snippet: string;
}

interface ImageAnalysisResult {
  imageUrl: string;
  finding: string;
  firstSeen?: string;
  matchingPages?: Array<{ url: string; title: string }>;
}

interface AnalysisResult {
  score: number
  confidence: number
  reasoning: string
  flags: string[]
  verdict: string
  sourceCredibility: {
    score: number // 0-100
    description: string
  }
  bias: {
    political: string // e.g., "Left-leaning", "Center", "Right-leaning"
    ideological: string
  }
  sentiment: {
    type: string // "Positive", "Negative", "Neutral"
    score: number // -1 to 1
  }
  claims: Array<{
    claim: string
    verification: string
  }>
  stance: {
    supports: number; // Count of supporting articles
    refutes: number;  // Count of refuting articles
    neutral: number; // Count of neutral articles
  }
  evidence: ExternalEvidence[],
  factCheckers: Array<{
    name: string
    url: string
  }>
  aigcScore: number // 0-100, likelihood of being AI-generated
  imageAnalysis: ImageAnalysisResult[];
  timestamp?: number;
}

function getApiKeysForProvider(provider: string): string[] {
  const prefix = `${provider.toUpperCase()}_API_KEY_`
  const keys: string[] = []
  for (const key in process.env) {
    if (key.startsWith(prefix)) {
      const value = process.env[key]
      if (value) {
        keys.push(value)
      }
    }
  }
  const singleKey = process.env[`${provider.toUpperCase()}_API_KEY`]
  if (singleKey && !keys.includes(singleKey)) {
    keys.push(singleKey)
  }
  return keys
}

function getRandomApiKey(provider: string): string | null {
  const keys = getApiKeysForProvider(provider)
  if (keys.length === 0) return null
  const randomIndex = Math.floor(Math.random() * keys.length)
  return keys[randomIndex]
}

function getVerdict(score: number, confidence: number): string {
  if (score >= 75 && confidence >= 75) return "TRUSTWORTHY"
  if (score >= 50 && confidence >= 50) return "QUESTIONABLE"
  return "FAKE"
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    const { articleData, provider } = await request.json()
    console.log(`Analyzing with ${provider}...`)

    if (!articleData.content || articleData.content.length < 50) {
      return NextResponse.json({ error: "Article content too short." }, { status: 400, headers: corsHeaders })
    }

    const evidence = await searchGoogle(`fact check ${articleData.title}`);
    const imageAnalysisResults = await analyzeImages(articleData.images || []);
    const analysis = await analyzeArticle(articleData, provider, evidence, imageAnalysisResults)
    
    const result: AnalysisResult = {
      ...analysis,
      verdict: getVerdict(analysis.score, analysis.confidence),
      timestamp: Date.now(),
    }

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

async function analyzeArticle(article: ArticleData, provider: string, evidence: ExternalEvidence[], imageAnalysis: ImageAnalysisResult[]): Promise<Omit<AnalysisResult, 'verdict'>> {
  const imageAnalysisText = imageAnalysis.length > 0 ? `
    The following images were found in the article. Cross-reference them with where they appeared before to see if they are used out of context. An image being found on older pages may indicate it's being reused.
    ${imageAnalysis.map(img => `
      - Image URL: ${img.imageUrl}
      - This image may be related to: "${img.firstSeen || 'N/A'}"
      - It has also been found on pages like: ${img.matchingPages?.map((p: any) => p.url).join(', ') || 'N/A'}
    `).join('')}
    ` : "No significant images found to analyze.";

  const prompt = `
    Analyze the news article below with extreme scrutiny. Use the provided external evidence to inform your analysis.

    Article Title: ${article.title}
    Source Domain: ${article.domain || "Unknown"}
    Content:
    ${article.content.substring(0, 5000)}

    External Evidence:
    ${evidence.map(e => `
        - Title: ${e.title}
        - URL: ${e.url}
        - Snippet: ${e.snippet}
      `).join('')}

    Image Analysis Results:
    ${imageAnalysisText}

    Based on ALL available information (the article's text, external evidence, AND image analysis), return a JSON object. Your reasoning MUST incorporate the image analysis.
    
    {
      "score": <number 0-100, overall authenticity score>,
      "confidence": <number 0-100, your confidence in the score>,
      "reasoning": "<string, detailed explanation, referencing the article's text AND the external evidence AND image analysis>",
      "flags": ["<array of strings, list of specific issues found, e.g., 'Sensationalist Language', 'Contradicted by Evidence'>"],
      "sourceCredibility": {
        "score": <number 0-100, estimated credibility score of the source domain>,
        "description": "<string, justification for the source's score, considering its reputation>"
      },
      "bias": {
        "political": "<string, e.g., 'Left-leaning', 'Center', 'Right-leaning', 'N/A'>",
        "ideological": "<string, any other detected ideological slant or 'N/A'>"
      },
      "sentiment": {
        "type": "<string, 'Positive', 'Negative', 'Neutral'>",
        "score": <number -1 to 1, from very negative to very positive>
      },
      "claims": [
        {
          "claim": "<string, extract a major claim from the article>",
          "verification": "<string, your verification or analysis of this specific claim>"
        }
      ],
      "stance": {
        "supports": <number, count of external articles supporting the main claim>,
        "refutes": <number, count of external articles refuting the main claim>,
        "neutral": <number, count of neutral or unrelated articles>
      },
      "factCheckers": [
        { "name": "Snopes", "url": "https://www.snopes.com" },
        { "name": "PolitiFact", "url": "https://www.politifact.com" },
        { "name": "AP Fact Check", "url": "https://apnews.com/hub/ap-fact-check" }
      ],
      "aigcScore": <number 0-100, the likelihood this article was AI-generated>,
      "imageAnalysis": [
        {
          "imageUrl": "<string, URL of the image>",
          "finding": "<string, your conclusion about this image, e.g., 'Appears to be original to this article.', 'WARNING: Image is from an unrelated 2018 event and is used out of context here.'>"
        }
      ]
    }
  `

  const systemPrompt = "You are a world-class investigative journalist and digital forensics expert. Your task is to analyze news articles for authenticity, bias, and manipulation. Your response must be a single, valid JSON object and nothing else."

  const apiKey = getRandomApiKey(provider)
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}.`)

  console.log(`Calling ${provider.toUpperCase()} API...`)
  let text: string

  try {
    switch (provider) {
      case "openai": {
        const openai = new OpenAI({ apiKey })
        const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
        text = response.choices[0].message.content!
        break
      }
      case "gemini": {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
        const result = await model.generateContent([systemPrompt, prompt])
        text = result.response.text()
        break
      }
      case "groq": {
        const groq = new Groq({ apiKey })
        const response = await groq.chat.completions.create({ model: "llama3-8b-8192", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
        text = response.choices[0].message.content!
        break
      }
      case "deepseek": {
        const deepseek = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" })
        const response = await deepseek.chat.completions.create({ model: "deepseek-coder", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
        text = response.choices[0].message.content!
        break
      }
      case "xai": {
        const xai = new OpenAI({ apiKey, baseURL: "https://api.xai.com/v1" })
        const response = await xai.chat.completions.create({ model: "grok-1", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], response_format: { type: "json_object" } })
        text = response.choices[0].message.content!
        break
      }
      default: throw new Error(`Unsupported provider: ${provider}`)
    }

    console.log(`${provider.toUpperCase()} response received.`)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonString = jsonMatch ? jsonMatch[0] : text
    const parsed = JSON.parse(jsonString)

    // Basic validation
    if (typeof parsed.score !== "number" || typeof parsed.confidence !== "number" || !parsed.reasoning) {
      throw new Error("Invalid or incomplete response structure from AI.")
    }

    return {
      score: Math.max(0, Math.min(100, parsed.score)),
      confidence: Math.max(0, Math.min(100, parsed.confidence)),
      reasoning: parsed.reasoning,
      flags: parsed.flags || [],
      sourceCredibility: parsed.sourceCredibility || { score: 50, description: "Could not be determined." },
      bias: parsed.bias || { political: "N/A", ideological: "N/A" },
      sentiment: parsed.sentiment || { type: "Neutral", score: 0 },
      claims: parsed.claims || [],
      stance: parsed.stance || { supports: 0, refutes: 0, neutral: 0 },
      evidence: evidence, // Add evidence to the final result object
      factCheckers: parsed.factCheckers || [],
      aigcScore: parsed.aigcScore || 0,
      imageAnalysis: parsed.imageAnalysis || [],
    }
  } catch (apiError) {
    console.error(`Error with ${provider.toUpperCase()} API:`, apiError)
    throw new Error(`Failed to get response from ${provider.toUpperCase()}: ${apiError instanceof Error ? apiError.message : "Unknown API error"}`)
  }
}

async function searchGoogle(query: string): Promise<ExternalEvidence[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_SEARCH_API_KEY not found. Skipping external evidence search.");
    return [];
  }
  
  const cx = process.env.GOOGLE_CX_ID; // Programmable Search Engine ID
  if (!cx) {
    console.warn("GOOGLE_CX_ID not found. Skipping external evidence search.");
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items) {
      return data.items.slice(0, 5).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet
      }));
    }
  } catch (error) {
    console.error("Google Search API call failed:", error);
  }
  return [];
}

async function analyzeImages(imageUrls: string[]): Promise<ImageAnalysisResult[]> {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    if (!apiKey || !imageUrls || imageUrls.length === 0) return [];
    
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const requests = imageUrls.map(imageUri => ({
        image: { source: { imageUri } },
        features: [{ type: 'WEB_DETECTION' }],
    }));

    try {
        const response = await fetch(visionApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests }),
        });
        if (!response.ok) {
            console.error("Google Vision API Error:", await response.text());
            return [];
        }
        const { responses } = await response.json();
        return responses.map((res: any, index: number) => {
            if (res.webDetection && res.webDetection.pagesWithMatchingImages) {
                return {
                    imageUrl: imageUrls[index],
                    firstSeen: res.webDetection.bestGuessLabels?.[0]?.label,
                    matchingPages: res.webDetection.pagesWithMatchingImages.slice(0, 3).map((page: any) => ({
                        url: page.url,
                        title: page.pageTitle,
                    })),
                };
            }
            return { imageUrl: imageUrls[index], finding: "No matches found." };
        });
    } catch (error) {
        console.error("Failed to call Vision API:", error);
        return [];
    }
}

async function searchNewsAPIs(query: string) {
  return []
}

async function searchFactCheckAPIs(query:string) {
  return []
}
