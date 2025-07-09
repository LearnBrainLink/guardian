import { type NextRequest, NextResponse } from "next/server";
import fs from 'fs/promises';
import path from 'path';

// This is a simple implementation that logs to a file.
// In a real production system, you would use a proper database.
const logFilePath = path.join(process.cwd(), 'feedback-log.jsonl');

export async function POST(request: NextRequest) {
  try {
    const { analysisResult, feedback } = await request.json();

    if (!analysisResult || !feedback) {
      return NextResponse.json({ error: "Missing analysisResult or feedback" }, { status: 400 });
    }
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        feedback: feedback, // 'helpful' or 'not_helpful'
        result: analysisResult,
    };

    // Log to console for immediate visibility
    console.log("Received feedback:", logEntry);

    // Append to a log file for persistence
    await fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\\n');

    return NextResponse.json({ message: "Feedback received" }, { status: 200 });

  } catch (error) {
    console.error("Failed to process feedback:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 